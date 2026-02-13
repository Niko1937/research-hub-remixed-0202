"""
Embedding Client for Research Hub

クエリテキストをエンベディングするためのクライアント
- OpenAI互換API（OpenAI, LiteLLM等）
- AWS Bedrock（Titan Embeddings等）
"""

import json
import httpx
from typing import Optional

from app.config import get_settings


class EmbeddingClient:
    """Embedding API client for converting text to vectors"""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None
        self._bedrock_client = None

    @property
    def is_configured(self) -> bool:
        """Check if Embedding API is properly configured"""
        return self.settings.is_embedding_configured()

    @property
    def provider(self) -> str:
        """Get the configured embedding provider"""
        return self.settings.embedding_provider.lower()

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
        """Get or create async client for OpenAI-compatible API"""
        if self._client is None:
            self._client = httpx.AsyncClient(**self._get_client_kwargs())
        return self._client

    def _get_bedrock_client(self):
        """Get or create boto3 Bedrock client"""
        if self._bedrock_client is None:
            import boto3
            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=self.settings.embedding_aws_region,
            )
        return self._bedrock_client

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

        if self.provider == "bedrock":
            return await self._embed_text_bedrock(text)
        else:
            return await self._embed_text_openai(text)

    async def _embed_text_openai(self, text: str) -> list[float]:
        """Generate embedding using OpenAI-compatible API"""
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

    async def _embed_text_bedrock(self, text: str) -> list[float]:
        """Generate embedding using AWS Bedrock"""
        import asyncio

        # boto3 is synchronous, so we run it in a thread pool
        def _invoke_bedrock():
            client = self._get_bedrock_client()
            model_id = self.settings.embedding_model

            # Determine request format based on model
            if "titan-embed" in model_id.lower():
                # Amazon Titan Embeddings format
                body = {
                    "inputText": text,
                }
                # Add dimensions if specified and model supports it (v2)
                if self.settings.embedding_dimensions and "v2" in model_id.lower():
                    body["dimensions"] = self.settings.embedding_dimensions
            elif "cohere" in model_id.lower():
                # Cohere Embed format
                body = {
                    "texts": [text],
                    "input_type": "search_query",
                }
            else:
                # Default to Titan format
                body = {
                    "inputText": text,
                }

            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )

            response_body = json.loads(response["body"].read())

            # Extract embedding based on model response format
            if "embedding" in response_body:
                # Titan format
                return response_body["embedding"]
            elif "embeddings" in response_body:
                # Cohere format
                return response_body["embeddings"][0]
            else:
                raise ValueError(f"Unexpected Bedrock response format: {response_body}")

        # Run synchronous boto3 call in thread pool
        return await asyncio.to_thread(_invoke_bedrock)

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

        if self.provider == "bedrock":
            return await self._embed_texts_bedrock(texts)
        else:
            return await self._embed_texts_openai(texts)

    async def _embed_texts_openai(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI-compatible API (batch)"""
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

    async def _embed_texts_bedrock(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using AWS Bedrock (sequential for now)"""
        import asyncio

        # Bedrock doesn't have native batch API for all models,
        # so we process sequentially (could be parallelized with asyncio.gather)
        results = []
        for text in texts:
            embedding = await self._embed_text_bedrock(text)
            results.append(embedding)

        return results


# Global client instance
embedding_client = EmbeddingClient()
