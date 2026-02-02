"""
OpenSearch Index Creation Script

OpenSearchのインデックスを作成する前処理スクリプト
- oipf-summary: 研究概要用インデックス
- oipf-details: ファイル詳細用インデックス（RAG向け）
"""

import os
import sys
from pathlib import Path

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
    kwargs = {"timeout": 30.0}

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


def get_opensearch_auth() -> tuple[str, str] | None:
    """Get OpenSearch authentication credentials"""
    username = os.getenv("OPENSEARCH_USERNAME", "")
    password = os.getenv("OPENSEARCH_PASSWORD", "")

    if username and password:
        return (username, password)
    return None


def _create_index(index_name: str, index_body: dict) -> bool:
    """
    Create an OpenSearch index

    Args:
        index_name: Name of the index
        index_body: Index settings and mappings

    Returns:
        bool: True if successful, False otherwise
    """
    opensearch_url = get_opensearch_url()
    auth = get_opensearch_auth()
    client_kwargs = get_opensearch_client_kwargs()

    url = f"{opensearch_url}/{index_name}"

    print(f"\nCreating index: {index_name}")
    print(f"OpenSearch URL: {opensearch_url}")

    try:
        with httpx.Client(**client_kwargs, auth=auth, verify=False) as client:
            # Check if index already exists
            check_response = client.head(url)
            if check_response.status_code == 200:
                print(f"Index '{index_name}' already exists. Skipping creation.")
                return True

            # Create index
            response = client.put(
                url,
                json=index_body,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 201]:
                print(f"Successfully created index: {index_name}")
                print(f"Response: {response.json()}")
                return True
            else:
                print(f"Failed to create index: {response.status_code}")
                print(f"Response: {response.text}")
                return False

    except httpx.ConnectError as e:
        print(f"Connection error: {e}")
        print("Please check OPENSEARCH_URL and network connectivity.")
        return False
    except Exception as e:
        print(f"Error creating index: {e}")
        return False


def create_oipf_summary_index() -> bool:
    """
    Create oipf-summary index for research data with KNN vector support

    研究概要用インデックス（フォルダ単位の要約）

    Returns:
        bool: True if successful, False otherwise
    """
    index_name = "oipf-summary"

    index_body = {
        "settings": {
            "index": {
                "knn": True,
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        },
        "mappings": {
            "properties": {
                "id": {
                    "type": "keyword"
                },
                "oipf_research_id": {
                    "type": "keyword"
                },
                "related_researchers": {
                    "type": "keyword"
                },
                "oipf_research_abstract": {
                    "type": "text"
                },
                "oipf_research_abstract_embedding": {
                    "type": "knn_vector",
                    "dimension": 1024,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "faiss"
                    }
                },
                "oipf_spo_folderstructure_summary": {
                    "type": "text"
                },
                "oipf_research_richtext": {
                    "type": "text"
                },
                "oipf_research_themetags": {
                    "type": "keyword"
                }
            }
        }
    }

    return _create_index(index_name, index_body)


def create_oipf_details_index() -> bool:
    """
    Create oipf-details index for file-level details with KNN vector support

    ファイル詳細用インデックス（RAG向け、ファイル単位）
    - oipf_file_path: ファイルパス（質問内容との類似度検索用）
    - oipf_file_abstract: ファイル要約
    - oipf_abstract_embedding: 要約のエンベディング（1024次元）

    Returns:
        bool: True if successful, False otherwise
    """
    index_name = "oipf-details"

    index_body = {
        "settings": {
            "index": {
                "knn": True,
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        },
        "mappings": {
            "properties": {
                "id": {
                    "type": "keyword"
                },
                "oipf_research_id": {
                    "type": "keyword"
                },
                "oipf_file_path": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 1024
                        }
                    }
                },
                "oipf_file_name": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "oipf_file_type": {
                    "type": "keyword"
                },
                "oipf_file_abstract": {
                    "type": "text"
                },
                "oipf_abstract_embedding": {
                    "type": "knn_vector",
                    "dimension": 1024,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "faiss"
                    }
                },
                "oipf_file_richtext": {
                    "type": "text"
                },
                "oipf_file_tags": {
                    "type": "keyword"
                },
                "oipf_folder_path": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 1024
                        }
                    }
                },
                "oipf_file_author": {
                    "type": "keyword"
                },
                "oipf_file_editor": {
                    "type": "keyword"
                },
                "created_at": {
                    "type": "date"
                },
                "updated_at": {
                    "type": "date"
                },
                "is_content_extracted": {
                    "type": "boolean"
                }
            }
        }
    }

    return _create_index(index_name, index_body)


def delete_index(index_name: str) -> bool:
    """
    Delete an OpenSearch index

    Args:
        index_name: Name of the index to delete

    Returns:
        bool: True if successful, False otherwise
    """
    opensearch_url = get_opensearch_url()
    auth = get_opensearch_auth()
    client_kwargs = get_opensearch_client_kwargs()

    url = f"{opensearch_url}/{index_name}"

    print(f"\nDeleting index: {index_name}")

    try:
        with httpx.Client(**client_kwargs, auth=auth, verify=False) as client:
            response = client.delete(url)

            if response.status_code in [200, 404]:
                print(f"Index '{index_name}' deleted (or did not exist).")
                return True
            else:
                print(f"Failed to delete index: {response.status_code}")
                print(f"Response: {response.text}")
                return False

    except Exception as e:
        print(f"Error deleting index: {e}")
        return False


def create_all_indices() -> bool:
    """
    Create all OIPF indices

    Returns:
        bool: True if all successful, False otherwise
    """
    print("\nCreating all OIPF indices...")

    results = []
    results.append(("oipf-summary", create_oipf_summary_index()))
    results.append(("oipf-details", create_oipf_details_index()))

    print("\n" + "=" * 50)
    print("Index Creation Summary")
    print("=" * 50)
    for name, success in results:
        status = "✓ OK" if success else "✗ FAILED"
        print(f"  {name}: {status}")
    print("=" * 50)

    return all(success for _, success in results)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="OpenSearch Index Management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 全インデックスを作成
  python create_indices.py --all

  # oipf-details インデックスのみ作成
  python create_indices.py --index oipf-details

  # oipf-summary インデックスのみ作成
  python create_indices.py --index oipf-summary

  # インデックスを削除
  python create_indices.py --action delete --index oipf-details

  # インデックスを再作成（削除→作成）
  python create_indices.py --action recreate --index oipf-details
        """
    )
    parser.add_argument(
        "--action",
        choices=["create", "delete", "recreate"],
        default="create",
        help="Action to perform (default: create)"
    )
    parser.add_argument(
        "--index",
        choices=["oipf-summary", "oipf-details"],
        default="oipf-details",
        help="Index name (default: oipf-details)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Create all indices (oipf-summary and oipf-details)"
    )

    args = parser.parse_args()

    print("=" * 50)
    print("OpenSearch Index Management")
    print("=" * 50)

    try:
        if args.all and args.action == "create":
            success = create_all_indices()
        elif args.action == "delete":
            success = delete_index(args.index)
        elif args.action == "recreate":
            delete_index(args.index)
            if args.index == "oipf-summary":
                success = create_oipf_summary_index()
            else:
                success = create_oipf_details_index()
        else:  # create
            if args.index == "oipf-summary":
                success = create_oipf_summary_index()
            else:
                success = create_oipf_details_index()

        if success:
            print("\nOperation completed successfully.")
            sys.exit(0)
        else:
            print("\nOperation failed.")
            sys.exit(1)

    except ValueError as e:
        print(f"\nConfiguration error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
