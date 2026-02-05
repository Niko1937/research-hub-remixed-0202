"""
OpenSearch Index Export Script

OpenSearchの各インデックスからデータをエクスポートするスクリプト
- NDJSON形式（1行1ドキュメント）でエクスポート
- インデックスマッピング・設定も別ファイルでエクスポート
- スクロールAPIで大量データに対応

出力形式:
- {index_name}_data.ndjson: ドキュメントデータ
- {index_name}_mapping.json: インデックスマッピング・設定
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

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


# Available indices
AVAILABLE_INDICES = ["oipf-summary", "oipf-details", "employees"]


def get_opensearch_client_kwargs() -> dict:
    """Get httpx client kwargs including OpenSearch-specific proxy if configured"""
    kwargs = {"timeout": 60.0}

    # Use OpenSearch-specific proxy settings
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


def export_index_mapping(
    client: httpx.Client,
    opensearch_url: str,
    index_name: str,
    output_dir: Path,
) -> bool:
    """
    Export index mapping and settings

    Args:
        client: httpx client
        opensearch_url: OpenSearch base URL
        index_name: Name of the index
        output_dir: Output directory

    Returns:
        bool: True if successful
    """
    url = f"{opensearch_url}/{index_name}"

    try:
        response = client.get(url)

        if response.status_code == 200:
            mapping_data = response.json()

            # Extract the index data (remove the index name wrapper)
            if index_name in mapping_data:
                index_data = mapping_data[index_name]
            else:
                index_data = mapping_data

            output_file = output_dir / f"{index_name}_mapping.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)

            print(f"  Mapping exported: {output_file}")
            return True
        elif response.status_code == 404:
            print(f"  Index '{index_name}' does not exist")
            return False
        else:
            print(f"  Failed to get mapping: {response.status_code}")
            print(f"  Response: {response.text}")
            return False

    except Exception as e:
        print(f"  Error exporting mapping: {e}")
        return False


def export_index_data(
    client: httpx.Client,
    opensearch_url: str,
    index_name: str,
    output_dir: Path,
    scroll_time: str = "5m",
    batch_size: int = 1000,
    exclude_embeddings: bool = False,
) -> tuple[int, bool]:
    """
    Export index data using scroll API

    Args:
        client: httpx client
        opensearch_url: OpenSearch base URL
        index_name: Name of the index
        output_dir: Output directory
        scroll_time: Scroll context time (default: 5m)
        batch_size: Number of documents per scroll batch
        exclude_embeddings: If True, exclude embedding fields from export

    Returns:
        tuple: (document_count, success)
    """
    output_file = output_dir / f"{index_name}_data.ndjson"
    total_docs = 0

    # Build source filter if excluding embeddings
    source_filter = None
    if exclude_embeddings:
        source_filter = {
            "excludes": [
                "*_embedding",  # Matches any field ending with _embedding
                "oipf_research_abstract_embedding",
                "oipf_abstract_embedding",
            ]
        }

    try:
        # Initial search with scroll
        search_url = f"{opensearch_url}/{index_name}/_search?scroll={scroll_time}"
        search_body = {
            "size": batch_size,
            "query": {"match_all": {}},
            "sort": ["_doc"],  # Efficient sorting for scroll
        }

        if source_filter:
            search_body["_source"] = source_filter

        response = client.post(
            search_url,
            json=search_body,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code != 200:
            print(f"  Initial search failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return 0, False

        result = response.json()
        scroll_id = result.get("_scroll_id")
        hits = result.get("hits", {}).get("hits", [])

        # Open output file and write documents
        with open(output_file, "w", encoding="utf-8") as f:
            while hits:
                for hit in hits:
                    # Create document with _id and _source
                    doc = {
                        "_id": hit["_id"],
                        "_source": hit["_source"],
                    }
                    f.write(json.dumps(doc, ensure_ascii=False) + "\n")
                    total_docs += 1

                # Progress update
                if total_docs % 1000 == 0:
                    print(f"    Exported {total_docs} documents...")

                # Get next batch
                scroll_url = f"{opensearch_url}/_search/scroll"
                scroll_body = {
                    "scroll": scroll_time,
                    "scroll_id": scroll_id,
                }

                response = client.post(
                    scroll_url,
                    json=scroll_body,
                    headers={"Content-Type": "application/json"},
                )

                if response.status_code != 200:
                    print(f"  Scroll failed: {response.status_code}")
                    break

                result = response.json()
                scroll_id = result.get("_scroll_id")
                hits = result.get("hits", {}).get("hits", [])

        # Clear scroll context
        if scroll_id:
            try:
                client.delete(
                    f"{opensearch_url}/_search/scroll",
                    json={"scroll_id": scroll_id},
                )
            except Exception:
                pass  # Ignore errors when clearing scroll

        print(f"  Data exported: {output_file} ({total_docs} documents)")
        return total_docs, True

    except Exception as e:
        print(f"  Error exporting data: {e}")
        return total_docs, False


def export_index(
    index_name: str,
    output_dir: Path,
    exclude_embeddings: bool = False,
) -> tuple[int, bool]:
    """
    Export a single index (mapping + data)

    Args:
        index_name: Name of the index
        output_dir: Output directory
        exclude_embeddings: If True, exclude embedding fields

    Returns:
        tuple: (document_count, success)
    """
    opensearch_url = get_opensearch_url()
    auth = get_opensearch_auth()
    client_kwargs = get_opensearch_client_kwargs()

    print(f"\nExporting index: {index_name}")
    print(f"  OpenSearch URL: {opensearch_url}")
    print(f"  Output directory: {output_dir}")

    if exclude_embeddings:
        print(f"  Excluding embedding fields")

    with httpx.Client(**client_kwargs, auth=auth, verify=False) as client:
        # Export mapping
        mapping_success = export_index_mapping(
            client, opensearch_url, index_name, output_dir
        )

        if not mapping_success:
            return 0, False

        # Export data
        doc_count, data_success = export_index_data(
            client,
            opensearch_url,
            index_name,
            output_dir,
            exclude_embeddings=exclude_embeddings,
        )

        return doc_count, data_success


def export_all_indices(
    output_dir: Path,
    exclude_embeddings: bool = False,
) -> dict[str, tuple[int, bool]]:
    """
    Export all available indices

    Args:
        output_dir: Output directory
        exclude_embeddings: If True, exclude embedding fields

    Returns:
        dict: {index_name: (doc_count, success)}
    """
    results = {}

    for index_name in AVAILABLE_INDICES:
        doc_count, success = export_index(index_name, output_dir, exclude_embeddings)
        results[index_name] = (doc_count, success)

    return results


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="OpenSearch Index Export Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 全インデックスをエクスポート
  python export_indices.py --all

  # 特定のインデックスをエクスポート
  python export_indices.py --index oipf-summary

  # 出力ディレクトリを指定
  python export_indices.py --all --output ./exports

  # エンベディングを除外（ファイルサイズ削減）
  python export_indices.py --all --exclude-embeddings

出力ファイル:
  {index_name}_mapping.json  - インデックスマッピング・設定
  {index_name}_data.ndjson   - ドキュメントデータ（NDJSON形式）

インポート方法:
  1. create_indices.py でインデックスを作成
  2. import_indices.py でデータをインポート
        """
    )

    parser.add_argument(
        "--index", "-i",
        choices=AVAILABLE_INDICES,
        help="エクスポートするインデックス名"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="全インデックスをエクスポート"
    )
    parser.add_argument(
        "--output", "-o",
        default="./exports",
        help="出力ディレクトリ（デフォルト: ./exports）"
    )
    parser.add_argument(
        "--exclude-embeddings", "-e",
        action="store_true",
        help="エンベディングフィールドを除外（ファイルサイズ削減）"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.all and not args.index:
        parser.error("--all または --index を指定してください")

    # Create output directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_base = Path(args.output)
    output_dir = output_base / f"export_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("OpenSearch Index Export")
    print("=" * 60)
    print(f"Output directory: {output_dir}")
    print(f"Exclude embeddings: {args.exclude_embeddings}")

    try:
        if args.all:
            results = export_all_indices(output_dir, args.exclude_embeddings)

            # Print summary
            print("\n" + "=" * 60)
            print("Export Summary")
            print("=" * 60)

            total_docs = 0
            all_success = True

            for index_name, (doc_count, success) in results.items():
                status = "✓ OK" if success else "✗ FAILED"
                print(f"  {index_name}: {status} ({doc_count} documents)")
                total_docs += doc_count
                if not success:
                    all_success = False

            print("-" * 60)
            print(f"  Total: {total_docs} documents")
            print("=" * 60)

            # Create manifest file
            manifest = {
                "exported_at": datetime.now().isoformat(),
                "indices": {
                    name: {
                        "documents": count,
                        "success": success,
                        "mapping_file": f"{name}_mapping.json",
                        "data_file": f"{name}_data.ndjson",
                    }
                    for name, (count, success) in results.items()
                },
                "exclude_embeddings": args.exclude_embeddings,
            }

            manifest_file = output_dir / "manifest.json"
            with open(manifest_file, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
            print(f"\nManifest: {manifest_file}")

            sys.exit(0 if all_success else 1)

        else:
            doc_count, success = export_index(
                args.index, output_dir, args.exclude_embeddings
            )

            print("\n" + "=" * 60)
            print("Export Summary")
            print("=" * 60)
            status = "✓ OK" if success else "✗ FAILED"
            print(f"  {args.index}: {status} ({doc_count} documents)")
            print("=" * 60)

            sys.exit(0 if success else 1)

    except ValueError as e:
        print(f"\nConfiguration error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
