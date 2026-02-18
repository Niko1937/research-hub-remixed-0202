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

    async def hybrid_vector_search(
        self,
        index: str,
        query_vector: list[float],
        abstract_field: str,
        tags_field: str,
        abstract_weight: float = 0.5,
        tags_weight: float = 0.5,
        k: int = 10,
        filters: Optional[dict] = None,
    ) -> dict:
        """
        Execute hybrid KNN vector similarity search using two vector fields.

        Combines scores from abstract embedding and tags embedding searches
        using the specified weights.

        Args:
            index: Index name (e.g., "oipf-summary", "oipf-details")
            query_vector: Query embedding vector
            abstract_field: Name of the abstract vector field
            tags_field: Name of the tags vector field
            abstract_weight: Weight for abstract field (0.0 - 1.0)
            tags_weight: Weight for tags field (0.0 - 1.0)
            k: Number of results to return
            filters: Optional filter query

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        # Build should clauses for hybrid search
        should_clauses = []

        # Abstract vector search (if weight > 0)
        if abstract_weight > 0:
            abstract_knn = {
                "knn": {
                    abstract_field: {
                        "vector": query_vector,
                        "k": k,
                        "boost": abstract_weight,
                    }
                }
            }
            if filters:
                abstract_knn["knn"][abstract_field]["filter"] = filters
            should_clauses.append(abstract_knn)

        # Tags vector search (if weight > 0)
        if tags_weight > 0:
            tags_knn = {
                "knn": {
                    tags_field: {
                        "vector": query_vector,
                        "k": k,
                        "boost": tags_weight,
                    }
                }
            }
            if filters:
                tags_knn["knn"][tags_field]["filter"] = filters
            should_clauses.append(tags_knn)

        # Build final query
        if len(should_clauses) == 1:
            # Single vector search
            query = should_clauses[0]
        else:
            # Hybrid search with bool should
            query = {
                "bool": {
                    "should": should_clauses,
                }
            }

        body = {
            "size": k,
            "query": query,
        }

        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()

    async def triple_hybrid_vector_search(
        self,
        index: str,
        query_vector: list[float],
        abstract_field: str,
        tags_field: str,
        proper_nouns_field: str,
        abstract_weight: float = 0.4,
        tags_weight: float = 0.3,
        proper_nouns_weight: float = 0.3,
        k: int = 10,
        filters: Optional[dict] = None,
    ) -> dict:
        """
        Execute triple hybrid KNN vector similarity search using three vector fields.

        Combines scores from abstract, tags, and proper nouns embedding searches
        using the specified weights.

        Args:
            index: Index name (e.g., "oipf-summary", "oipf-details")
            query_vector: Query embedding vector
            abstract_field: Name of the abstract vector field
            tags_field: Name of the tags vector field
            proper_nouns_field: Name of the proper nouns vector field
            abstract_weight: Weight for abstract field (0.0 - 1.0)
            tags_weight: Weight for tags field (0.0 - 1.0)
            proper_nouns_weight: Weight for proper nouns field (0.0 - 1.0)
            k: Number of results to return
            filters: Optional filter query

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

        # Build should clauses for triple hybrid search
        should_clauses = []

        # Abstract vector search (if weight > 0)
        if abstract_weight > 0:
            abstract_knn = {
                "knn": {
                    abstract_field: {
                        "vector": query_vector,
                        "k": k,
                        "boost": abstract_weight,
                    }
                }
            }
            if filters:
                abstract_knn["knn"][abstract_field]["filter"] = filters
            should_clauses.append(abstract_knn)

        # Tags vector search (if weight > 0)
        if tags_weight > 0:
            tags_knn = {
                "knn": {
                    tags_field: {
                        "vector": query_vector,
                        "k": k,
                        "boost": tags_weight,
                    }
                }
            }
            if filters:
                tags_knn["knn"][tags_field]["filter"] = filters
            should_clauses.append(tags_knn)

        # Proper nouns vector search (if weight > 0)
        if proper_nouns_weight > 0:
            proper_nouns_knn = {
                "knn": {
                    proper_nouns_field: {
                        "vector": query_vector,
                        "k": k,
                        "boost": proper_nouns_weight,
                    }
                }
            }
            if filters:
                proper_nouns_knn["knn"][proper_nouns_field]["filter"] = filters
            should_clauses.append(proper_nouns_knn)

        # Build final query
        if len(should_clauses) == 1:
            # Single vector search
            query = should_clauses[0]
        else:
            # Triple hybrid search with bool should
            query = {
                "bool": {
                    "should": should_clauses,
                }
            }

        body = {
            "size": k,
            "query": query,
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
