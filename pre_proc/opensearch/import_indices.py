"""
OpenSearch Index Import Script

エクスポートされたデータを別のOpenSearchにインポートするスクリプト
- NDJSON形式のデータをバルクAPIでインポート
- インデックスマッピングを事前に作成可能

前提条件:
- 対象インデックスが作成済みであること（create_indices.py で作成）
- または --create-index オプションでマッピングファイルから作成
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional, Iterator

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import httpx
from dotenv import load_dotenv

# Load .env from project root
env_file = project_root / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"Loaded .env from: {env_file}")
else:
    print("Warning: .env file not found")


def get_opensearch_client_kwargs() -> dict:
    """Get httpx client kwargs including OpenSearch-specific proxy if configured"""
    kwargs = {"timeout": 60.0}

    proxy_enabled = os.getenv("OPENSEARCH_PROXY_ENABLED", "false").lower() == "true"
    proxy_url = os.getenv("OPENSEARCH_PROXY_URL", "")

    if proxy_enabled and proxy_url:
        kwargs["proxy"] = proxy_url
        print(f"Using proxy for OpenSearch: {proxy_url}")

    return kwargs


def get_opensearch_url() -> str:
    """Get OpenSearch URL from environment"""
    url = os.getenv("OPENSEARCH_URL", "")
    if not url:
        raise ValueError("OPENSEARCH_URL environment variable is not set")
    return url.rstrip("/")


def get_opensearch_auth() -> Optional[tuple[str, str]]:
    """Get OpenSearch authentication credentials"""
    username = os.getenv("OPENSEARCH_USERNAME", "")
    password = os.getenv("OPENSEARCH_PASSWORD", "")

    if username and password:
        return (username, password)
    return None


def read_ndjson(file_path: Path, batch_size: int = 500) -> Iterator[list[dict]]:
    """
    Read NDJSON file and yield batches of documents

    Args:
        file_path: Path to NDJSON file
        batch_size: Number of documents per batch

    Yields:
        List of documents
    """
    batch = []

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            try:
                doc = json.loads(line)
                batch.append(doc)

                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            except json.JSONDecodeError as e:
                print(f"  Warning: Skipping invalid JSON line: {e}")
                continue

    # Yield remaining documents
    if batch:
        yield batch


def check_index_exists(
    client: httpx.Client,
    opensearch_url: str,
    index_name: str,
) -> bool:
    """Check if an index exists"""
    url = f"{opensearch_url}/{index_name}"
    response = client.head(url)
    return response.status_code == 200


def create_index_from_mapping(
    client: httpx.Client,
    opensearch_url: str,
    index_name: str,
    mapping_file: Path,
) -> bool:
    """
    Create index from mapping file

    Args:
        client: httpx client
        opensearch_url: OpenSearch base URL
        index_name: Name of the index
        mapping_file: Path to mapping JSON file

    Returns:
        bool: True if successful
    """
    url = f"{opensearch_url}/{index_name}"

    try:
        with open(mapping_file, "r", encoding="utf-8") as f:
            mapping_data = json.load(f)

        # Extract settings and mappings
        index_body = {}
        if "settings" in mapping_data:
            index_body["settings"] = mapping_data["settings"]
        if "mappings" in mapping_data:
            index_body["mappings"] = mapping_data["mappings"]

        response = client.put(
            url,
            json=index_body,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code in [200, 201]:
            print(f"  Created index: {index_name}")
            return True
        elif response.status_code == 400 and "already exists" in response.text:
            print(f"  Index already exists: {index_name}")
            return True
        else:
            print(f"  Failed to create index: {response.status_code}")
            print(f"  Response: {response.text}")
            return False

    except Exception as e:
        print(f"  Error creating index: {e}")
        return False


def import_documents(
    client: httpx.Client,
    opensearch_url: str,
    index_name: str,
    data_file: Path,
    batch_size: int = 500,
) -> tuple[int, int]:
    """
    Import documents using bulk API

    Args:
        client: httpx client
        opensearch_url: OpenSearch base URL
        index_name: Name of the index
        data_file: Path to NDJSON data file
        batch_size: Number of documents per bulk request

    Returns:
        tuple: (success_count, error_count)
    """
    bulk_url = f"{opensearch_url}/_bulk"
    success_count = 0
    error_count = 0
    total_processed = 0

    for batch in read_ndjson(data_file, batch_size):
        # Build bulk request body
        bulk_lines = []

        for doc in batch:
            doc_id = doc.get("_id")
            source = doc.get("_source", doc)  # Fallback to doc itself if no _source

            # Action line
            action = {"index": {"_index": index_name}}
            if doc_id:
                action["index"]["_id"] = doc_id

            bulk_lines.append(json.dumps(action, ensure_ascii=False))
            bulk_lines.append(json.dumps(source, ensure_ascii=False))

        bulk_body = "\n".join(bulk_lines) + "\n"

        try:
            response = client.post(
                bulk_url,
                content=bulk_body.encode("utf-8"),
                headers={"Content-Type": "application/x-ndjson"},
            )

            if response.status_code == 200:
                result = response.json()

                if result.get("errors", False):
                    # Count individual errors
                    for item in result.get("items", []):
                        index_result = item.get("index", {})
                        if index_result.get("status", 200) >= 300:
                            error_count += 1
                        else:
                            success_count += 1
                else:
                    success_count += len(batch)
            else:
                print(f"  Bulk request failed: {response.status_code}")
                error_count += len(batch)

        except Exception as e:
            print(f"  Bulk request error: {e}")
            error_count += len(batch)

        total_processed += len(batch)
        if total_processed % 1000 == 0:
            print(f"    Processed {total_processed} documents...")

    return success_count, error_count


def import_index(
    index_name: str,
    export_dir: Path,
    create_index: bool = False,
    batch_size: int = 500,
) -> tuple[int, int, bool]:
    """
    Import a single index

    Args:
        index_name: Name of the index
        export_dir: Directory containing exported files
        create_index: If True, create index from mapping file
        batch_size: Number of documents per bulk request

    Returns:
        tuple: (success_count, error_count, overall_success)
    """
    opensearch_url = get_opensearch_url()
    auth = get_opensearch_auth()
    client_kwargs = get_opensearch_client_kwargs()

    mapping_file = export_dir / f"{index_name}_mapping.json"
    data_file = export_dir / f"{index_name}_data.ndjson"

    print(f"\nImporting index: {index_name}")
    print(f"  OpenSearch URL: {opensearch_url}")
    print(f"  Export directory: {export_dir}")

    # Check files exist
    if not data_file.exists():
        print(f"  Data file not found: {data_file}")
        return 0, 0, False

    with httpx.Client(**client_kwargs, auth=auth, verify=False) as client:
        # Create index if requested
        if create_index:
            if not mapping_file.exists():
                print(f"  Mapping file not found: {mapping_file}")
                return 0, 0, False

            if not create_index_from_mapping(
                client, opensearch_url, index_name, mapping_file
            ):
                return 0, 0, False
        else:
            # Check index exists
            if not check_index_exists(client, opensearch_url, index_name):
                print(f"  Index does not exist: {index_name}")
                print(f"  Use --create-index or create index first with create_indices.py")
                return 0, 0, False

        # Import documents
        success_count, error_count = import_documents(
            client, opensearch_url, index_name, data_file, batch_size
        )

        return success_count, error_count, error_count == 0


def import_from_manifest(
    export_dir: Path,
    create_index: bool = False,
    batch_size: int = 500,
) -> dict[str, tuple[int, int, bool]]:
    """
    Import all indices from manifest

    Args:
        export_dir: Directory containing exported files and manifest
        create_index: If True, create indices from mapping files
        batch_size: Number of documents per bulk request

    Returns:
        dict: {index_name: (success_count, error_count, success)}
    """
    manifest_file = export_dir / "manifest.json"

    if not manifest_file.exists():
        print(f"Manifest file not found: {manifest_file}")
        return {}

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    results = {}
    indices = manifest.get("indices", {})

    for index_name in indices.keys():
        success_count, error_count, success = import_index(
            index_name, export_dir, create_index, batch_size
        )
        results[index_name] = (success_count, error_count, success)

    return results


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="OpenSearch Index Import Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # マニフェストから全インデックスをインポート
  python import_indices.py --dir ./exports/export_20240101_120000

  # 特定のインデックスをインポート
  python import_indices.py --dir ./exports/export_20240101_120000 --index oipf-summary

  # インデックスをマッピングファイルから作成してインポート
  python import_indices.py --dir ./exports/export_20240101_120000 --create-index

  # バッチサイズを指定
  python import_indices.py --dir ./exports/export_20240101_120000 --batch-size 1000

注意:
  - インポート先のインデックスが存在する必要があります
  - --create-index オプションでマッピングファイルからインデックスを作成できます
  - 既存のドキュメントは同じIDで上書きされます
        """
    )

    parser.add_argument(
        "--dir", "-d",
        required=True,
        help="エクスポートディレクトリ（export_indices.py の出力先）"
    )
    parser.add_argument(
        "--index", "-i",
        help="インポートするインデックス名（省略時は全インデックス）"
    )
    parser.add_argument(
        "--create-index", "-c",
        action="store_true",
        help="マッピングファイルからインデックスを作成"
    )
    parser.add_argument(
        "--batch-size", "-b",
        type=int,
        default=500,
        help="バルクリクエストのバッチサイズ（デフォルト: 500）"
    )

    args = parser.parse_args()

    export_dir = Path(args.dir)
    if not export_dir.exists():
        print(f"Export directory not found: {export_dir}")
        sys.exit(1)

    print("=" * 60)
    print("OpenSearch Index Import")
    print("=" * 60)
    print(f"Export directory: {export_dir}")
    print(f"Create index: {args.create_index}")
    print(f"Batch size: {args.batch_size}")

    try:
        if args.index:
            # Import single index
            success_count, error_count, success = import_index(
                args.index, export_dir, args.create_index, args.batch_size
            )

            print("\n" + "=" * 60)
            print("Import Summary")
            print("=" * 60)
            status = "✓ OK" if success else "✗ FAILED"
            print(f"  {args.index}: {status}")
            print(f"    Success: {success_count}, Errors: {error_count}")
            print("=" * 60)

            sys.exit(0 if success else 1)

        else:
            # Import all from manifest
            results = import_from_manifest(
                export_dir, args.create_index, args.batch_size
            )

            if not results:
                print("No indices found to import")
                sys.exit(1)

            print("\n" + "=" * 60)
            print("Import Summary")
            print("=" * 60)

            total_success = 0
            total_errors = 0
            all_success = True

            for index_name, (success_count, error_count, success) in results.items():
                status = "✓ OK" if success else "✗ FAILED"
                print(f"  {index_name}: {status}")
                print(f"    Success: {success_count}, Errors: {error_count}")
                total_success += success_count
                total_errors += error_count
                if not success:
                    all_success = False

            print("-" * 60)
            print(f"  Total: {total_success} success, {total_errors} errors")
            print("=" * 60)

            sys.exit(0 if all_success else 1)

    except ValueError as e:
        print(f"\nConfiguration error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
