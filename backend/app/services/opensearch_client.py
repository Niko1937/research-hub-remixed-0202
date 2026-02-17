"""
OpenSearch Client for Research Hub

社内研究検索用のOpenSearchクライアント
"""

import httpx
from typing import Optional

from app.config import get_settings


class OpenSearchClient:
    """OpenSearch client for internal research search"""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if OpenSearch is properly configured"""
        return self.settings.is_opensearch_configured()

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {
            "timeout": httpx.Timeout(60.0),
            "verify": self.settings.opensearch_verify_ssl,
        }

        # Add auth if configured
        if self.settings.opensearch_username and self.settings.opensearch_password:
            kwargs["auth"] = (
                self.settings.opensearch_username,
                self.settings.opensearch_password,
            )

        # Add proxy if configured
        if self.settings.opensearch_proxy_enabled and self.settings.opensearch_proxy_url:
            kwargs["proxy"] = self.settings.opensearch_proxy_url

        return kwargs

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async client"""
        if self._client is None:
            self._client = httpx.AsyncClient(**self._get_client_kwargs())
        return self._client

    async def close(self):
        """Close the client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def search(
        self,
        index: str,
        query: dict,
        size: int = 10,
    ) -> dict:
        """
        Execute search query on OpenSearch

        Args:
            index: Index name (e.g., "oipf-summary", "oipf-details")
            query: OpenSearch query DSL
            size: Number of results to return

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        body = {
            "size": size,
            "query": query,
        }

        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()

    async def vector_search(
        self,
        index: str,
        vector_field: str,
        query_vector: list[float],
        k: int = 10,
        filters: Optional[dict] = None,
    ) -> dict:
        """
        Execute KNN vector similarity search

        Args:
            index: Index name (e.g., "oipf-summary")
            vector_field: Name of the vector field (e.g., "oipf_research_abstract_embedding")
            query_vector: Query embedding vector
            k: Number of results to return
            filters: Optional filter query

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        # Build KNN query
        knn_query = {
            "knn": {
                vector_field: {
                    "vector": query_vector,
                    "k": k,
                }
            }
        }

        # Add filter if provided
        if filters:
            knn_query["knn"][vector_field]["filter"] = filters

        body = {
            "size": k,
            "query": knn_query,
        }

        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()

    async def get_document(
        self,
        index: str,
        doc_id: str,
    ) -> Optional[dict]:
        """
        Get a single document by ID

        Args:
            index: Index name (e.g., "employees")
            doc_id: Document ID

        Returns:
            Document as dict with _id and _source, or None if not found
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_doc/{doc_id}"

        try:
            response = await client.get(url)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def search_with_query_string(
        self,
        index: str,
        query_string: str,
        fields: Optional[list[str]] = None,
        filters: Optional[dict] = None,
        size: int = 10,
    ) -> dict:
        """
        Execute full-text search with query string

        Args:
            index: Index name
            query_string: Search query string
            fields: Fields to search in (default: all)
            filters: Optional filter query
            size: Number of results to return

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        # Build query
        if fields:
            match_query = {
                "multi_match": {
                    "query": query_string,
                    "fields": fields,
                }
            }
        else:
            match_query = {
                "query_string": {
                    "query": query_string,
                }
            }

        # Combine with filters if provided
        if filters:
            query = {
                "bool": {
                    "must": [match_query],
                    "filter": [filters],
                }
            }
        else:
            query = match_query

        body = {
            "size": size,
            "query": query,
        }

        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()

    async def get_unique_field_values(
        self,
        index: str,
        field: str,
        size: int = 10000,
    ) -> list[str]:
        """
        Get unique values for a field using aggregation

        Args:
            index: Index name (e.g., "oipf-summary")
            field: Field name to aggregate (e.g., "oipf_research_id")
            size: Maximum number of unique values to return

        Returns:
            List of unique field values
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        body = {
            "size": 0,
            "aggs": {
                "unique_values": {
                    "terms": {
                        "field": field,
                        "size": size,
                    }
                }
            }
        }

        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()

        result = response.json()
        buckets = result.get("aggregations", {}).get("unique_values", {}).get("buckets", [])
        return [bucket["key"] for bucket in buckets]


# Global client instance
opensearch_client = OpenSearchClient()
