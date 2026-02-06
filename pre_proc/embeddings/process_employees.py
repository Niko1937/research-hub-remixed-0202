"""
Employees Index Processing Pipeline

CSVファイルから従業員データを読み込み、OpenSearchのemployeesインデックスに登録するスクリプト

処理フロー:
1. CSVファイルを読み込み
2. manager_mail → manager_employee_id のルックアップ
3. oipf-summaryからrelated_researchersとマッチングしてprofile生成
4. employeesインデックスに登録
"""

import sys
import csv
import argparse
import asyncio
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.config import config
from embeddings.opensearch_client import OpenSearchClient, get_opensearch_client


@dataclass
class EmployeeProfile:
    """Employee profile data"""
    research_summary: str = ""
    expertise: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    bio: str = ""


@dataclass
class EmployeeRecord:
    """Employee record from CSV"""
    employee_id: str
    display_name: str
    mail: str
    job_title: str
    department: str
    manager_employee_id: Optional[str] = None
    job_level: int = 0  # 0: 一般, 1: 課長級, 2: 部長級
    profile: EmployeeProfile = field(default_factory=EmployeeProfile)

    def to_dict(self) -> dict:
        """Convert to dictionary for OpenSearch"""
        return {
            "employee_id": self.employee_id,
            "display_name": self.display_name,
            "mail": self.mail,
            "job_title": self.job_title,
            "department": self.department,
            "manager_employee_id": self.manager_employee_id,
            "job_level": self.job_level,
            "profile": {
                "research_summary": self.profile.research_summary,
                "expertise": self.profile.expertise,
                "keywords": self.profile.keywords,
                "bio": self.profile.bio,
            }
        }


class EmployeesPipeline:
    """
    Employees Index Processing Pipeline
    """

    def __init__(
        self,
        opensearch_client: Optional[OpenSearchClient] = None,
        dry_run: bool = False,
        verbose: bool = True,
    ):
        self.opensearch_client = opensearch_client
        self.dry_run = dry_run
        self.verbose = verbose
        self.mail_to_employee_id: dict[str, str] = {}
        self.oipf_summary_data: list[dict] = []

    def _log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(message)

    def read_csv(self, csv_path: str) -> list[dict]:
        """
        Read CSV file and return list of records

        Args:
            csv_path: Path to CSV file

        Returns:
            List of dictionaries with CSV data
        """
        self._log(f"\n[1/5] Reading CSV file: {csv_path}")

        records = []
        # Note: utf-8-sig must come BEFORE utf-8 to properly handle BOM on Windows
        encodings = ['utf-8-sig', 'utf-8', 'cp932', 'shift_jis']

        for encoding in encodings:
            try:
                with open(csv_path, 'r', encoding=encoding) as f:
                    reader = csv.DictReader(f)
                    records = list(reader)
                self._log(f"  Encoding: {encoding}")
                self._log(f"  Records: {len(records)}")
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                raise e

        if not records:
            raise ValueError(f"Could not read CSV file with any encoding: {csv_path}")

        # Validate required columns
        required_columns = ['display_name', 'mail', 'employee_id', 'job_title', 'department']
        first_record = records[0]
        actual_columns = list(first_record.keys())
        missing_columns = [col for col in required_columns if col not in first_record]

        if missing_columns:
            # Show actual columns for debugging
            raise ValueError(
                f"Missing required columns: {missing_columns}\n"
                f"  Actual columns found: {actual_columns}\n"
                f"  Hint: If first column looks like '\\ufeffdisplay_name', "
                f"the file has a BOM issue. Try re-saving as UTF-8 without BOM."
            )

        self._log(f"  Columns: {actual_columns}")

        return records

    def build_mail_lookup(self, records: list[dict]) -> dict[str, str]:
        """
        Build mail → employee_id lookup dictionary

        Args:
            records: List of CSV records

        Returns:
            Dictionary mapping mail to employee_id
        """
        self._log(f"\n[2/5] Building mail → employee_id lookup...")

        mail_to_id = {}
        for record in records:
            mail = record.get('mail', '').strip().lower()
            employee_id = record.get('employee_id', '').strip()

            if mail and employee_id:
                mail_to_id[mail] = employee_id

        self._log(f"  Lookup entries: {len(mail_to_id)}")
        self.mail_to_employee_id = mail_to_id

        return mail_to_id

    def get_manager_employee_id(self, manager_mail: str) -> Optional[str]:
        """
        Get manager's employee_id from their mail

        Args:
            manager_mail: Manager's email address

        Returns:
            Manager's employee_id or None
        """
        if not manager_mail:
            return None

        manager_mail_lower = manager_mail.strip().lower()
        return self.mail_to_employee_id.get(manager_mail_lower)

    async def fetch_oipf_summary_data(self) -> list[dict]:
        """
        Fetch all data from oipf-summary index

        Returns:
            List of oipf-summary documents
        """
        self._log(f"\n[3/5] Fetching oipf-summary data from OpenSearch...")

        if not self.opensearch_client:
            self._log("  OpenSearch client not available, skipping profile enrichment")
            return []

        try:
            # Search all documents in oipf-summary
            response = await self.opensearch_client.search(
                index="oipf-summary",
                query={"match_all": {}},
                size=1000,  # Adjust as needed
            )

            hits = response.get("hits", {}).get("hits", [])
            self.oipf_summary_data = [hit.get("_source", {}) for hit in hits]

            self._log(f"  Found {len(self.oipf_summary_data)} research records")

            return self.oipf_summary_data

        except Exception as e:
            self._log(f"  Error fetching oipf-summary: {e}")
            return []

    def _normalize_name(self, name: str) -> str:
        """Normalize name for comparison (remove spaces, convert to lowercase)"""
        return name.replace(" ", "").replace("　", "").lower()

    def _name_matches(self, name1: str, name2: str) -> bool:
        """
        Check if two names match (exact or partial)

        Args:
            name1: First name
            name2: Second name

        Returns:
            True if names match
        """
        n1 = self._normalize_name(name1)
        n2 = self._normalize_name(name2)

        # Exact match
        if n1 == n2:
            return True

        # Partial match (one contains the other)
        if len(n1) >= 2 and len(n2) >= 2:
            if n1 in n2 or n2 in n1:
                return True

        return False

    def find_matching_research(self, display_name: str) -> list[dict]:
        """
        Find research records where related_researchers contains the employee name

        Args:
            display_name: Employee's display name

        Returns:
            List of matching research records
        """
        matching = []

        for research in self.oipf_summary_data:
            researchers = research.get("related_researchers", [])

            if not researchers:
                continue

            for researcher in researchers:
                if self._name_matches(display_name, researcher):
                    matching.append(research)
                    break

        return matching

    def generate_profile(self, display_name: str) -> EmployeeProfile:
        """
        Generate employee profile from matching oipf-summary data

        Args:
            display_name: Employee's display name

        Returns:
            EmployeeProfile with data from matching research
        """
        matching_research = self.find_matching_research(display_name)

        if not matching_research:
            return EmployeeProfile()

        # Collect data from matching research
        summaries = []
        expertise_set = set()
        keywords_set = set()

        for research in matching_research:
            # Research summary
            abstract = research.get("oipf_research_abstract", "")
            if abstract:
                summaries.append(abstract[:200])

            # Tags → expertise and keywords
            tags = research.get("oipf_research_themetags", [])
            for tag in tags[:10]:  # Limit tags
                if len(tag) <= 10:
                    expertise_set.add(tag)
                else:
                    keywords_set.add(tag)

        # Build profile
        profile = EmployeeProfile(
            research_summary="; ".join(summaries[:3]) if summaries else "",
            expertise=list(expertise_set)[:5],
            keywords=list(keywords_set)[:10],
            bio="",
        )

        return profile

    def convert_records(self, csv_records: list[dict]) -> list[EmployeeRecord]:
        """
        Convert CSV records to EmployeeRecord objects

        Args:
            csv_records: List of CSV dictionaries

        Returns:
            List of EmployeeRecord objects
        """
        self._log(f"\n[4/5] Converting records and generating profiles...")

        employees = []
        profile_count = 0
        skipped_count = 0

        for record in csv_records:
            employee_id = record.get('employee_id', '').strip()

            # Skip records with empty employee_id
            if not employee_id:
                skipped_count += 1
                continue

            display_name = record.get('display_name', '').strip()
            manager_mail = record.get('manager_mail', '').strip()

            # Get manager_employee_id from lookup
            manager_employee_id = self.get_manager_employee_id(manager_mail)

            # Get job_level (0: 一般, 1: 課長級, 2: 部長級)
            job_level_str = record.get('job_level', '0').strip()
            try:
                job_level = int(job_level_str) if job_level_str else 0
                job_level = max(0, min(2, job_level))  # Clamp to 0-2
            except ValueError:
                job_level = 0

            # Generate profile from oipf-summary
            profile = self.generate_profile(display_name)
            if profile.research_summary or profile.expertise:
                profile_count += 1

            employee = EmployeeRecord(
                employee_id=employee_id,
                display_name=display_name,
                mail=record.get('mail', '').strip(),
                job_title=record.get('job_title', '').strip(),
                department=record.get('department', '').strip(),
                manager_employee_id=manager_employee_id,
                job_level=job_level,
                profile=profile,
            )

            employees.append(employee)

        self._log(f"  Converted: {len(employees)} employees")
        self._log(f"  With profile data: {profile_count} employees")
        if skipped_count > 0:
            self._log(f"  Skipped (empty employee_id): {skipped_count} records")

        return employees

    async def index_employees(self, employees: list[EmployeeRecord]) -> tuple[int, int]:
        """
        Index employees to OpenSearch

        Args:
            employees: List of EmployeeRecord objects

        Returns:
            Tuple of (success_count, error_count)
        """
        self._log(f"\n[5/5] Indexing to OpenSearch...")

        if self.dry_run:
            self._log(f"  [DRY RUN] Would index {len(employees)} employees")
            return len(employees), 0

        if not self.opensearch_client:
            self._log("  OpenSearch client not available")
            return 0, len(employees)

        success_count = 0
        error_count = 0

        for employee in employees:
            # Skip if employee_id is empty (safety check)
            if not employee.employee_id:
                error_count += 1
                self._log(f"  Skipping employee with empty ID: {employee.display_name}")
                continue

            try:
                result = await self.opensearch_client.index_document(
                    index_name="employees",
                    doc_id=employee.employee_id,
                    document=employee.to_dict(),
                )

                if result.success:
                    success_count += 1
                else:
                    error_count += 1
                    self._log(f"  Error indexing {employee.employee_id}: {result.error}")

            except Exception as e:
                error_count += 1
                self._log(f"  Error indexing {employee.employee_id}: {e}")

        self._log(f"  Success: {success_count}, Errors: {error_count}")

        return success_count, error_count

    async def process(self, csv_path: str) -> tuple[int, int]:
        """
        Main processing pipeline

        Args:
            csv_path: Path to CSV file

        Returns:
            Tuple of (success_count, error_count)
        """
        self._log("=" * 60)
        self._log("Employees Index Processing Pipeline")
        self._log("=" * 60)

        # 1. Read CSV
        csv_records = self.read_csv(csv_path)

        # 2. Build mail lookup
        self.build_mail_lookup(csv_records)

        # 3. Fetch oipf-summary data
        await self.fetch_oipf_summary_data()

        # 4. Convert records
        employees = self.convert_records(csv_records)

        # 5. Index to OpenSearch
        success, errors = await self.index_employees(employees)

        self._log("\n" + "=" * 60)
        self._log("Processing Complete")
        self._log("=" * 60)
        self._log(f"Total: {len(employees)}, Success: {success}, Errors: {errors}")

        return success, errors


async def main_async(args):
    """Async main function"""

    # Initialize OpenSearch client
    opensearch_client = None

    if not args.dry_run:
        try:
            opensearch_client = get_opensearch_client()
            print(f"OpenSearch: {config.opensearch.url}")
        except Exception as e:
            print(f"Warning: OpenSearch not available: {e}")
            if not args.dry_run:
                print("Use --dry-run to test without OpenSearch")
                return
    else:
        # Try to get client for fetching oipf-summary even in dry-run
        try:
            opensearch_client = get_opensearch_client()
        except Exception:
            pass

    # Create pipeline
    pipeline = EmployeesPipeline(
        opensearch_client=opensearch_client,
        dry_run=args.dry_run,
        verbose=not args.quiet,
    )

    # Process
    success, errors = await pipeline.process(args.csv_file)

    if errors > 0:
        sys.exit(1)


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="CSVファイルから従業員データをOpenSearchのemployeesインデックスに登録",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 基本的な使用方法
  python process_employees.py /path/to/employees.csv

  # ドライラン（登録せずに確認）
  python process_employees.py /path/to/employees.csv --dry-run

  # 静かなモード
  python process_employees.py /path/to/employees.csv --quiet

必要なCSV列:
  - display_name: 従業員名
  - mail: メールアドレス
  - employee_id: 従業員ID
  - job_title: 役職
  - department: 部署
  - manager_mail: 上司のメールアドレス（オプション）
        """
    )

    parser.add_argument(
        "csv_file",
        help="従業員データのCSVファイルパス"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="ドライラン（OpenSearchに登録しない）"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="進捗表示を抑制"
    )

    args = parser.parse_args()

    # Validate file path
    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"Error: File not found: {args.csv_file}", file=sys.stderr)
        sys.exit(1)

    if not csv_path.is_file():
        print(f"Error: Not a file: {args.csv_file}", file=sys.stderr)
        sys.exit(1)

    # Run async main
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
