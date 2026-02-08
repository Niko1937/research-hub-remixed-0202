"""
Test Data Loader for OpenSearch

生成したテストデータをOpenSearchに投入するスクリプト

使用例:
  python load_test_data.py --all          # 全インデックス投入
  python load_test_data.py --employees    # employeesのみ
  python load_test_data.py --summary      # oipf-summaryのみ
  python load_test_data.py --details      # oipf-detailsのみ
  python load_test_data.py --clear --all  # クリアしてから投入
  python load_test_data.py --dry-run      # ドライラン
"""

import sys
import json
import csv
import argparse
import asyncio
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.config import config
from embeddings.opensearch_client import get_opensearch_client

# パス設定
DATA_DIR = Path(__file__).parent / "data"
EMPLOYEES_FILE = DATA_DIR / "employees_test.csv"
SUMMARY_FILE = DATA_DIR / "oipf_summary_test.ndjson"
DETAILS_FILE = DATA_DIR / "oipf_details_test.ndjson"


class TestDataLoader:
    """テストデータ投入クラス"""

    def __init__(self, dry_run: bool = False, verbose: bool = True):
        self.dry_run = dry_run
        self.verbose = verbose
        self.client = None

    def _log(self, message: str):
        if self.verbose:
            print(message)

    async def init_client(self):
        """OpenSearchクライアントを初期化"""
        if self.dry_run:
            self._log("[DRY RUN] OpenSearchクライアントをスキップ")
            return

        try:
            self.client = get_opensearch_client()
            self._log(f"OpenSearch接続先: {config.opensearch.url}")
        except Exception as e:
            raise RuntimeError(f"OpenSearch接続エラー: {e}")

    async def clear_index(self, index_name: str):
        """インデックスをクリア（全ドキュメント削除）"""
        if self.dry_run:
            self._log(f"[DRY RUN] {index_name}のクリアをスキップ")
            return

        self._log(f"  {index_name}をクリア中...")
        try:
            result = await self.client.delete_by_query(
                index=index_name,
                query={"match_all": {}},
            )
            deleted = result.get("deleted", 0)
            self._log(f"    削除したドキュメント数: {deleted}")
        except Exception as e:
            self._log(f"    クリア失敗（インデックスが存在しない可能性）: {e}")

    async def load_employees(self):
        """従業員データを投入"""
        self._log("\n[1/3] Employees データを投入")

        if not EMPLOYEES_FILE.exists():
            self._log(f"  エラー: ファイルが見つかりません: {EMPLOYEES_FILE}")
            self._log("  先に generate_employees.py を実行してください")
            return 0, 0

        # CSVを読み込み
        employees = []
        with open(EMPLOYEES_FILE, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                employees.append(row)

        self._log(f"  読み込んだ従業員数: {len(employees)}")

        if self.dry_run:
            self._log(f"  [DRY RUN] {len(employees)}件の投入をスキップ")
            return len(employees), 0

        # 投入
        success = 0
        errors = 0

        for emp in employees:
            try:
                # job_levelを整数に変換
                job_level = int(emp.get("job_level", 0))

                doc = {
                    "employee_id": emp["employee_id"],
                    "display_name": emp["display_name"],
                    "mail": emp["mail"],
                    "job_title": emp["job_title"],
                    "department": emp["department"],
                    "job_level": job_level,
                    "manager_employee_id": self._get_manager_id(employees, emp.get("manager_mail", "")),
                    "profile": {
                        "research_summary": "",
                        "expertise": [],
                        "keywords": [],
                        "bio": "",
                    }
                }

                result = await self.client.index_document(
                    index_name="employees",
                    doc_id=emp["employee_id"],
                    document=doc,
                )

                if result.success:
                    success += 1
                else:
                    errors += 1
                    self._log(f"    エラー: {emp['employee_id']}: {result.error}")

            except Exception as e:
                errors += 1
                self._log(f"    エラー: {emp['employee_id']}: {e}")

        self._log(f"  完了: 成功={success}, エラー={errors}")
        return success, errors

    def _get_manager_id(self, employees: list, manager_mail: str) -> str:
        """manager_mailからemployee_idを取得"""
        if not manager_mail:
            return None

        for emp in employees:
            if emp["mail"].lower() == manager_mail.lower():
                return emp["employee_id"]

        return None

    async def load_oipf_summary(self):
        """OIPF Summaryデータを投入"""
        self._log("\n[2/3] OIPF Summary データを投入")

        if not SUMMARY_FILE.exists():
            self._log(f"  エラー: ファイルが見つかりません: {SUMMARY_FILE}")
            self._log("  先に generate_oipf_summary.py を実行してください")
            return 0, 0

        # NDJSONを読み込み
        summaries = []
        with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    summaries.append(json.loads(line))

        self._log(f"  読み込んだSummary数: {len(summaries)}")

        if self.dry_run:
            self._log(f"  [DRY RUN] {len(summaries)}件の投入をスキップ")
            return len(summaries), 0

        # 投入
        success = 0
        errors = 0

        for summary in summaries:
            try:
                doc_id = summary["oipf_id"]

                result = await self.client.index_document(
                    index_name="oipf-summary",
                    doc_id=doc_id,
                    document=summary,
                )

                if result.success:
                    success += 1
                else:
                    errors += 1
                    self._log(f"    エラー: {doc_id}: {result.error}")

            except Exception as e:
                errors += 1
                self._log(f"    エラー: {summary.get('oipf_id', 'unknown')}: {e}")

        self._log(f"  完了: 成功={success}, エラー={errors}")
        return success, errors

    async def load_oipf_details(self):
        """OIPF Detailsデータを投入"""
        self._log("\n[3/3] OIPF Details データを投入")

        if not DETAILS_FILE.exists():
            self._log(f"  エラー: ファイルが見つかりません: {DETAILS_FILE}")
            self._log("  先に generate_oipf_details.py を実行してください")
            return 0, 0

        # NDJSONを読み込み
        details = []
        with open(DETAILS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    details.append(json.loads(line))

        self._log(f"  読み込んだDetails数: {len(details)}")

        if self.dry_run:
            self._log(f"  [DRY RUN] {len(details)}件の投入をスキップ")
            return len(details), 0

        # 投入
        success = 0
        errors = 0

        for detail in details:
            try:
                doc_id = detail["detail_id"]

                result = await self.client.index_document(
                    index_name="oipf-details",
                    doc_id=doc_id,
                    document=detail,
                )

                if result.success:
                    success += 1
                else:
                    errors += 1
                    if errors <= 3:  # 最初の数件だけログ出力
                        self._log(f"    エラー: {doc_id}: {result.error}")

            except Exception as e:
                errors += 1
                if errors <= 3:
                    self._log(f"    エラー: {detail.get('detail_id', 'unknown')}: {e}")

        self._log(f"  完了: 成功={success}, エラー={errors}")
        return success, errors


async def main_async(args):
    """メイン処理（非同期）"""
    loader = TestDataLoader(dry_run=args.dry_run, verbose=True)

    print("=" * 60)
    print("Test Data Loader for OpenSearch")
    print("=" * 60)

    if args.dry_run:
        print("\n[DRY RUN MODE] 実際の投入は行いません\n")

    # クライアント初期化
    await loader.init_client()

    total_success = 0
    total_errors = 0

    # クリア処理
    if args.clear:
        print("\nインデックスをクリア中...")
        if args.all or args.employees:
            await loader.clear_index("employees")
        if args.all or args.summary:
            await loader.clear_index("oipf-summary")
        if args.all or args.details:
            await loader.clear_index("oipf-details")

    # 投入処理
    if args.all or args.employees:
        success, errors = await loader.load_employees()
        total_success += success
        total_errors += errors

    if args.all or args.summary:
        success, errors = await loader.load_oipf_summary()
        total_success += success
        total_errors += errors

    if args.all or args.details:
        success, errors = await loader.load_oipf_details()
        total_success += success
        total_errors += errors

    # 結果サマリー
    print("\n" + "=" * 60)
    print("完了")
    print("=" * 60)
    print(f"合計: 成功={total_success}, エラー={total_errors}")

    if total_errors > 0:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="テストデータをOpenSearchに投入",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python load_test_data.py --all          # 全インデックス投入
  python load_test_data.py --employees    # employeesのみ
  python load_test_data.py --summary      # oipf-summaryのみ
  python load_test_data.py --details      # oipf-detailsのみ
  python load_test_data.py --clear --all  # クリアしてから投入
  python load_test_data.py --dry-run --all  # ドライラン

事前準備:
  1. generate_employees.py を実行
  2. generate_oipf_summary.py を実行
  3. generate_oipf_details.py を実行
  4. 環境変数でOpenSearch接続情報を設定
        """
    )

    parser.add_argument("--all", action="store_true", help="全インデックスに投入")
    parser.add_argument("--employees", action="store_true", help="employeesに投入")
    parser.add_argument("--summary", action="store_true", help="oipf-summaryに投入")
    parser.add_argument("--details", action="store_true", help="oipf-detailsに投入")
    parser.add_argument("--clear", action="store_true", help="投入前にインデックスをクリア")
    parser.add_argument("--dry-run", "-n", action="store_true", help="ドライラン（実際には投入しない）")

    args = parser.parse_args()

    # 何も指定されていない場合はヘルプを表示
    if not any([args.all, args.employees, args.summary, args.details]):
        parser.print_help()
        print("\nエラー: 投入対象を指定してください（--all, --employees, --summary, --details）")
        sys.exit(1)

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
