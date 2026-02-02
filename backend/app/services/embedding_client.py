"""
Embedding Client for Research Hub

クエリテキストをエンベディングするためのクライアント
"""

import httpx
from typing import Optional

from app.config import get_settings


class EmbeddingClient:
    """Embedding API client for converting text to vectors"""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if Embedding API is properly configured"""
        return self.settings.is_embedding_configured()

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {
            "timeout": httpx.Timeout(float(self.settings.embedding_timeout)),
        }

        # Add proxy if configured
        if self.settings.embedding_proxy_enabled and self.settings.embedding_proxy_url:
            kwargs["proxy"] = self.settings.embedding_proxy_url

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

    async def embed_text(self, text: str) -> list[float]:
        """
        Generate embedding for a single text

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats
        """
        if not self.is_configured:
            raise RuntimeError("Embedding API is not configured")

        client = await self._get_client()
        url = f"{self.settings.embedding_api_url.rstrip('/')}/embeddings"

        # OpenAI-compatible embedding API format
        body = {
            "input": text,
            "model": self.settings.embedding_model,
        }

        # Add dimensions if model supports it
        if self.settings.embedding_dimensions:
            body["dimensions"] = self.settings.embedding_dimensions

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.settings.embedding_api_key}",
        }

        response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Extract embedding from OpenAI-compatible response format
        # Response format: {"data": [{"embedding": [...], "index": 0}], ...}
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]

        raise ValueError(f"Unexpected embedding response format: {data}")

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not self.is_configured:
            raise RuntimeError("Embedding API is not configured")

        client = await self._get_client()
        url = f"{self.settings.embedding_api_url.rstrip('/')}/embeddings"

        # OpenAI-compatible embedding API format (batch)
        body = {
            "input": texts,
            "model": self.settings.embedding_model,
        }

        # Add dimensions if model supports it
        if self.settings.embedding_dimensions:
            body["dimensions"] = self.settings.embedding_dimensions

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.settings.embedding_api_key}",
        }

        response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Extract embeddings from OpenAI-compatible response format
        if "data" in data:
            # Sort by index to ensure order matches input
            sorted_data = sorted(data["data"], key=lambda x: x.get("index", 0))
            return [item["embedding"] for item in sorted_data]

        raise ValueError(f"Unexpected embedding response format: {data}")


# Global client instance
embedding_client = EmbeddingClient()
