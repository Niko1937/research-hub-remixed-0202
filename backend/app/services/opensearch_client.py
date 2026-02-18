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

    async def unified_search(
        self,
        index: str,
        query_text: str,
        query_vector: Optional[list[float]] = None,
        weights: Optional[dict] = None,
        field_mapping: Optional[dict] = None,
        k: int = 10,
        filters: Optional[dict] = None,
    ) -> dict:
        """
        Execute unified search combining text and vector searches.

        Combines 6 search methods with configurable weights:
        - abstract_text: BM25 text search on abstract field
        - abstract_vector: KNN vector search on abstract embedding
        - tags_text: Keyword match on tags field
        - tags_vector: KNN vector search on tags embedding
        - proper_nouns_text: Keyword match on proper_nouns field
        - proper_nouns_vector: KNN vector search on proper_nouns embedding

        Args:
            index: Index name (e.g., "oipf-details")
            query_text: Query text for text searches
            query_vector: Query embedding vector for vector searches (required if any vector weight > 0)
            weights: Dict with weights for each search method (default: all 0 except abstract_vector=100)
                {
                    "abstract_text": 0,
                    "abstract_vector": 40,
                    "tags_text": 0,
                    "tags_vector": 30,
                    "proper_nouns_text": 0,
                    "proper_nouns_vector": 30,
                }
            field_mapping: Dict mapping search methods to field names (uses defaults if not provided)
                {
                    "abstract_text": "oipf_abstract",
                    "abstract_vector": "oipf_abstract_embedding",
                    "tags_text": "oipf_tags",
                    "tags_vector": "oipf_tags_embedding",
                    "proper_nouns_text": "oipf_proper_nouns",
                    "proper_nouns_vector": "oipf_proper_nouns_embedding",
                }
            k: Number of results to return
            filters: Optional filter query

        Returns:
            OpenSearch response as dict
        """
        if not self.is_configured:
            raise RuntimeError("OpenSearch is not configured")

        # Default weights
        default_weights = {
            "abstract_text": 0,
            "abstract_vector": 100,
            "tags_text": 0,
            "tags_vector": 0,
            "proper_nouns_text": 0,
            "proper_nouns_vector": 0,
        }
        weights = {**default_weights, **(weights or {})}

        # Default field mapping for oipf-details
        default_fields = {
            "abstract_text": "oipf_abstract",
            "abstract_vector": "oipf_abstract_embedding",
            "tags_text": "oipf_tags",
            "tags_vector": "oipf_tags_embedding",
            "proper_nouns_text": "oipf_proper_nouns",
            "proper_nouns_vector": "oipf_proper_nouns_embedding",
        }
        fields = {**default_fields, **(field_mapping or {})}

        # Check if vector search is needed but no vector provided
        vector_methods = ["abstract_vector", "tags_vector", "proper_nouns_vector"]
        needs_vector = any(weights.get(m, 0) > 0 for m in vector_methods)
        if needs_vector and not query_vector:
            raise ValueError("query_vector is required when any vector search weight > 0")

        # Calculate total weight for normalization
        total_weight = sum(w for w in weights.values() if w > 0)
        if total_weight == 0:
            raise ValueError("At least one search weight must be greater than 0")

        # Build should clauses
        should_clauses = []

        # Abstract text search (BM25)
        if weights["abstract_text"] > 0:
            boost = weights["abstract_text"] / total_weight
            should_clauses.append({
                "match": {
                    fields["abstract_text"]: {
                        "query": query_text,
                        "boost": boost,
                    }
                }
            })

        # Abstract vector search (KNN)
        if weights["abstract_vector"] > 0 and query_vector:
            boost = weights["abstract_vector"] / total_weight
            knn_clause = {
                "knn": {
                    fields["abstract_vector"]: {
                        "vector": query_vector,
                        "k": k,
                        "boost": boost,
                    }
                }
            }
            if filters:
                knn_clause["knn"][fields["abstract_vector"]]["filter"] = filters
            should_clauses.append(knn_clause)

        # Tags text search (keyword match)
        if weights["tags_text"] > 0:
            boost = weights["tags_text"] / total_weight
            # Use multi_match for tags as they can be multiple values
            should_clauses.append({
                "match": {
                    fields["tags_text"]: {
                        "query": query_text,
                        "boost": boost,
                    }
                }
            })

        # Tags vector search (KNN)
        if weights["tags_vector"] > 0 and query_vector:
            boost = weights["tags_vector"] / total_weight
            knn_clause = {
                "knn": {
                    fields["tags_vector"]: {
                        "vector": query_vector,
                        "k": k,
                        "boost": boost,
                    }
                }
            }
            if filters:
                knn_clause["knn"][fields["tags_vector"]]["filter"] = filters
            should_clauses.append(knn_clause)

        # Proper nouns text search (partial match using text field)
        if weights["proper_nouns_text"] > 0:
            boost = weights["proper_nouns_text"] / total_weight
            # Use match query for partial matching on text field
            should_clauses.append({
                "match": {
                    fields["proper_nouns_text"]: {
                        "query": query_text,
                        "boost": boost,
                    }
                }
            })

        # Proper nouns vector search (KNN)
        if weights["proper_nouns_vector"] > 0 and query_vector:
            boost = weights["proper_nouns_vector"] / total_weight
            knn_clause = {
                "knn": {
                    fields["proper_nouns_vector"]: {
                        "vector": query_vector,
                        "k": k,
                        "boost": boost,
                    }
                }
            }
            if filters:
                knn_clause["knn"][fields["proper_nouns_vector"]]["filter"] = filters
            should_clauses.append(knn_clause)

        # Build final query
        if len(should_clauses) == 1:
            query = should_clauses[0]
        else:
            query = {
                "bool": {
                    "should": should_clauses,
                }
            }

        # Add filters to bool query if not already applied to KNN
        text_methods = ["abstract_text", "tags_text", "proper_nouns_text"]
        has_text_search = any(weights.get(m, 0) > 0 for m in text_methods)
        if filters and has_text_search and len(should_clauses) > 1:
            if "bool" in query:
                query["bool"]["filter"] = [filters]

        body = {
            "size": k,
            "query": query,
        }

        client = await self._get_client()
        url = f"{self.settings.opensearch_url.rstrip('/')}/{index}/_search"

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
