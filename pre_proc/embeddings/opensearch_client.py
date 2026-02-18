"""
OpenSearch Client Module

OpenSearchへのドキュメント投入クライアント
プロキシ環境にも対応
"""

import sys
import json
from pathlib import Path
from typing import Optional, Any
from dataclasses import dataclass
import asyncio

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from common.config import config, OpenSearchConfig


@dataclass
class IndexResult:
    """Index operation result"""
    success: bool
    doc_id: str
    error: Optional[str] = None
    response: Optional[dict] = None


@dataclass
class BulkResult:
    """Bulk operation result"""
    success: bool
    total: int
    succeeded: int
    failed: int
    errors: list[str]


class OpenSearchClient:
    """
    OpenSearch Client

    OpenSearchへのドキュメント投入を行うクライアント
    プロキシ環境にも対応
    """

    def __init__(
        self,
        url: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        verify_ssl: Optional[bool] = None,
        timeout: int = 30,
        opensearch_config: Optional[OpenSearchConfig] = None,
    ):
        """
        Initialize OpenSearch client

        Args:
            url: OpenSearch URL (default: from env)
            username: Username (default: from env)
            password: Password (default: from env)
            verify_ssl: Whether to verify SSL certificates (default: from env)
            timeout: Request timeout in seconds
            opensearch_config: OpenSearch configuration including proxy (default: from env)
        """
        self._config = opensearch_config or config.opensearch
        self.url = (url or self._config.url).rstrip("/")
        self.username = username or self._config.username
        self.password = password or self._config.password
        self.verify_ssl = verify_ssl if verify_ssl is not None else self._config.verify_ssl
        self.timeout = timeout

        if not self.url:
            raise ValueError("OPENSEARCH_URL is not configured")

    @property
    def auth(self) -> Optional[tuple[str, str]]:
        """Get auth tuple if credentials are configured"""
        if self.username and self.password:
            return (self.username, self.password)
        return None

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs including proxy if configured"""
        kwargs = {
            "timeout": self.timeout,
            "verify": self.verify_ssl,
        }
        if self.auth:
            kwargs["auth"] = self.auth

        # Use OpenSearch-specific proxy settings
        proxy_kwargs = self._config.get_httpx_kwargs()
        kwargs.update(proxy_kwargs)
        return kwargs

    def _get_headers(self) -> dict:
        """Get request headers"""
        return {"Content-Type": "application/json"}

    async def index_exists(self, index_name: str) -> bool:
        """
        Check if index exists

        Args:
            index_name: Index name

        Returns:
            True if index exists
        """
        url = f"{self.url}/{index_name}"

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.head(url)
                return response.status_code == 200
        except Exception:
            return False

    async def index_document(
        self,
        index_name: str,
        doc_id: str,
        document: dict,
    ) -> IndexResult:
        """
        Index a single document

        Args:
            index_name: Index name
            doc_id: Document ID
            document: Document to index

        Returns:
            IndexResult with operation status
        """
        url = f"{self.url}/{index_name}/_doc/{doc_id}"

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.put(
                    url,
                    headers=self._get_headers(),
                    json=document,
                )

                if response.status_code in [200, 201]:
                    return IndexResult(
                        success=True,
                        doc_id=doc_id,
                        response=response.json(),
                    )
                else:
                    return IndexResult(
                        success=False,
                        doc_id=doc_id,
                        error=f"HTTP {response.status_code}: {response.text}",
                    )

        except httpx.ConnectError as e:
            return IndexResult(
                success=False,
                doc_id=doc_id,
                error=f"Connection error: {e}. Check OPENSEARCH_URL and network/proxy settings.",
            )
        except Exception as e:
            return IndexResult(
                success=False,
                doc_id=doc_id,
                error=f"Index error: {str(e)}",
            )

    def index_document_sync(
        self,
        index_name: str,
        doc_id: str,
        document: dict,
    ) -> IndexResult:
        """Synchronous version of index_document"""
        return asyncio.run(self.index_document(index_name, doc_id, document))

    async def bulk_index(
        self,
        index_name: str,
        documents: list[tuple[str, dict]],
        on_progress: Optional[callable] = None,
    ) -> BulkResult:
        """
        Bulk index documents

        Args:
            index_name: Index name
            documents: List of (doc_id, document) tuples
            on_progress: Progress callback (current, total)

        Returns:
            BulkResult with operation status
        """
        if not documents:
            return BulkResult(
                success=True,
                total=0,
                succeeded=0,
                failed=0,
                errors=[],
            )

        # Build bulk request body
        bulk_body_lines = []
        for doc_id, document in documents:
            action = {"index": {"_index": index_name, "_id": doc_id}}
            bulk_body_lines.append(json.dumps(action))
            bulk_body_lines.append(json.dumps(document))

        bulk_body = "\n".join(bulk_body_lines) + "\n"

        url = f"{self.url}/_bulk"

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.post(
                    url,
                    headers={"Content-Type": "application/x-ndjson"},
                    content=bulk_body,
                )

                if response.status_code not in [200, 201]:
                    return BulkResult(
                        success=False,
                        total=len(documents),
                        succeeded=0,
                        failed=len(documents),
                        errors=[f"HTTP {response.status_code}: {response.text}"],
                    )

                result = response.json()

                # Parse response
                succeeded = 0
                failed = 0
                errors = []

                for item in result.get("items", []):
                    action_result = item.get("index", {})
                    status = action_result.get("status", 0)

                    if status in [200, 201]:
                        succeeded += 1
                    else:
                        failed += 1
                        error_info = action_result.get("error", {})
                        if error_info:
                            errors.append(f"{action_result.get('_id')}: {error_info.get('reason', 'Unknown error')}")

                return BulkResult(
                    success=failed == 0,
                    total=len(documents),
                    succeeded=succeeded,
                    failed=failed,
                    errors=errors,
                )

        except httpx.ConnectError as e:
            return BulkResult(
                success=False,
                total=len(documents),
                succeeded=0,
                failed=len(documents),
                errors=[f"Connection error: {e}. Check OPENSEARCH_URL and network/proxy settings."],
            )
        except Exception as e:
            return BulkResult(
                success=False,
                total=len(documents),
                succeeded=0,
                failed=len(documents),
                errors=[f"Bulk index error: {str(e)}"],
            )

    def bulk_index_sync(
        self,
        index_name: str,
        documents: list[tuple[str, dict]],
        on_progress: Optional[callable] = None,
    ) -> BulkResult:
        """Synchronous version of bulk_index"""
        return asyncio.run(self.bulk_index(index_name, documents, on_progress))

    async def search(
        self,
        index_name: str,
        query: dict,
        size: int = 10,
    ) -> dict:
        """
        Search documents

        Args:
            index_name: Index name
            query: OpenSearch query
            size: Maximum results

        Returns:
            Search response
        """
        url = f"{self.url}/{index_name}/_search"

        body = {
            "query": query,
            "size": size,
        }

        async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
            response = await client.post(
                url,
                headers=self._get_headers(),
                json=body,
            )
            response.raise_for_status()
            return response.json()

    async def knn_search(
        self,
        index_name: str,
        vector_field: str,
        vector: list[float],
        k: int = 10,
    ) -> dict:
        """
        KNN vector search

        Args:
            index_name: Index name
            vector_field: Vector field name
            vector: Query vector
            k: Number of results

        Returns:
            Search response
        """
        url = f"{self.url}/{index_name}/_search"

        body = {
            "size": k,
            "query": {
                "knn": {
                    vector_field: {
                        "vector": vector,
                        "k": k,
                    }
                }
            }
        }

        async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
            response = await client.post(
                url,
                headers=self._get_headers(),
                json=body,
            )
            response.raise_for_status()
            return response.json()

    async def delete_document(
        self,
        index_name: str,
        doc_id: str,
    ) -> bool:
        """
        Delete a document

        Args:
            index_name: Index name
            doc_id: Document ID

        Returns:
            True if successful
        """
        url = f"{self.url}/{index_name}/_doc/{doc_id}"

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.delete(url)
                return response.status_code in [200, 404]
        except Exception:
            return False

    async def get_document(
        self,
        index_name: str,
        doc_id: str,
    ) -> Optional[dict]:
        """
        Get a document by ID

        Args:
            index_name: Index name
            doc_id: Document ID

        Returns:
            Document or None if not found
        """
        url = f"{self.url}/{index_name}/_doc/{doc_id}"

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json().get("_source")
                return None
        except Exception:
            return None

    async def find_document_by_file_path(
        self,
        index_name: str,
        file_path: str,
        file_name: str,
    ) -> Optional[str]:
        """
        Find existing document by oipf_file_path and oipf_file_name

        Args:
            index_name: Index name
            file_path: File path to match (oipf_file_path)
            file_name: File name to match (oipf_file_name)

        Returns:
            Document ID if found, None otherwise
        """
        url = f"{self.url}/{index_name}/_search"

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"oipf_file_path.keyword": file_path}},
                        {"term": {"oipf_file_name.keyword": file_name}},
                    ]
                }
            },
            "size": 1,
            "_source": False,
        }

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json=query,
                )

                if response.status_code != 200:
                    return None

                result = response.json()
                hits = result.get("hits", {}).get("hits", [])

                if hits:
                    return hits[0].get("_id")
                return None

        except Exception:
            return None

    async def find_document_with_embedding(
        self,
        index_name: str,
        file_path: str,
        file_name: str,
    ) -> Optional[tuple[str, list[float]]]:
        """
        Find existing document by oipf_file_path and oipf_file_name,
        returning both ID and embedding vector.

        Args:
            index_name: Index name
            file_path: File path to match (oipf_file_path)
            file_name: File name to match (oipf_file_name)

        Returns:
            Tuple of (doc_id, embedding) if found, None otherwise
        """
        url = f"{self.url}/{index_name}/_search"

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"oipf_file_path.keyword": file_path}},
                        {"term": {"oipf_file_name.keyword": file_name}},
                    ]
                }
            },
            "size": 1,
            "_source": ["oipf_abstract_embedding"],
        }

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json=query,
                )

                if response.status_code != 200:
                    return None

                result = response.json()
                hits = result.get("hits", {}).get("hits", [])

                if hits:
                    doc_id = hits[0].get("_id")
                    source = hits[0].get("_source", {})
                    embedding = source.get("oipf_abstract_embedding", [])
                    if doc_id and embedding:
                        return (doc_id, embedding)
                return None

        except Exception:
            return None

    def find_document_by_file_path_sync(
        self,
        index_name: str,
        file_path: str,
        file_name: str,
    ) -> Optional[str]:
        """Synchronous version of find_document_by_file_path"""
        return asyncio.run(self.find_document_by_file_path(index_name, file_path, file_name))

    async def folder_has_indexed_files(
        self,
        index_name: str,
        folder_path: str,
    ) -> bool:
        """
        Check if any files from a folder path exist in the index

        Uses prefix match on oipf_file_path to find any documents
        that belong to the specified folder or its subfolders.

        Args:
            index_name: Index name
            folder_path: Folder path prefix to check (relative path)

        Returns:
            True if any documents exist for this folder path
        """
        url = f"{self.url}/{index_name}/_search"

        # Use prefix query to match folder path
        # Ensure folder_path ends without trailing slash for consistent matching
        folder_prefix = folder_path.rstrip("/")

        query = {
            "query": {
                "bool": {
                    "should": [
                        # Exact match for files directly in the folder
                        {"prefix": {"oipf_file_path.keyword": f"{folder_prefix}/"}},
                        # Also match the folder path itself (for edge cases)
                        {"term": {"oipf_folder_path.keyword": folder_prefix}},
                    ],
                    "minimum_should_match": 1,
                }
            },
            "size": 0,  # We only need the count, not the documents
            "track_total_hits": True,
        }

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json=query,
                )

                if response.status_code != 200:
                    return False

                result = response.json()
                total = result.get("hits", {}).get("total", {})

                # Handle both old and new format for total hits
                if isinstance(total, dict):
                    count = total.get("value", 0)
                else:
                    count = total

                return count > 0

        except Exception:
            return False

    def folder_has_indexed_files_sync(
        self,
        index_name: str,
        folder_path: str,
    ) -> bool:
        """Synchronous version of folder_has_indexed_files"""
        return asyncio.run(self.folder_has_indexed_files(index_name, folder_path))


def get_opensearch_client() -> OpenSearchClient:
    """Get configured OpenSearch client instance"""
    return OpenSearchClient()


if __name__ == "__main__":
    # Test
    print("OpenSearch Client Configuration:")
    print(f"  URL: {config.opensearch.url or 'NOT SET'}")
    print(f"  Username: {config.opensearch.username or 'NOT SET'}")
    print(f"  Verify SSL: {config.opensearch.verify_ssl}")
    print(f"  Proxy: {'Enabled (' + config.opensearch.proxy_url + ')' if config.opensearch.proxy_enabled else 'Disabled'}")
