"""
LLM Client - OpenAI Compatible API Client

LiteLLM / OpenAI互換のLLM APIクライアント
"""

import json
import asyncio
from typing import Any, AsyncGenerator, Optional
from dataclasses import dataclass

import httpx

from app.config import get_settings


@dataclass
class ChatMessage:
    """Chat message"""
    role: str  # "system", "user", "assistant"
    content: str

    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}


@dataclass
class ChatCompletionResponse:
    """Chat completion response"""
    id: str
    model: str
    content: str
    finish_reason: str
    usage: Optional[dict] = None
    raw_response: Optional[dict] = None


class LLMClient:
    """LLM API Client"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
    ):
        settings = get_settings()
        self.base_url = (base_url or settings.llm_base_url).rstrip("/")
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model
        self.timeout = timeout

        if not self.base_url or not self.api_key:
            raise ValueError("LLM_BASE_URL and LLM_API_KEY must be set")

    def _get_endpoint(self) -> str:
        """Get the chat completions endpoint URL"""
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    def _get_headers(self) -> dict:
        """Get request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4000,
        response_format: Optional[dict] = None,
        **kwargs,
    ) -> ChatCompletionResponse:
        """
        Chat completion API call (non-streaming)

        Args:
            messages: List of chat messages
            temperature: Creativity (0-1)
            max_tokens: Maximum output tokens
            response_format: Response format (e.g., {"type": "json_object"})

        Returns:
            ChatCompletionResponse
        """
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            payload["response_format"] = response_format

        payload.update(kwargs)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self._get_endpoint(),
                headers=self._get_headers(),
                json=payload,
            )

            if response.status_code != 200:
                raise LLMError(
                    f"LLM API error: {response.status_code}",
                    status_code=response.status_code,
                    body=response.text,
                )

            data = response.json()

            return ChatCompletionResponse(
                id=data.get("id", ""),
                model=data.get("model", self.model),
                content=data["choices"][0]["message"]["content"],
                finish_reason=data["choices"][0].get("finish_reason", ""),
                usage=data.get("usage"),
                raw_response=data,
            )

    async def chat_completion_stream(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4000,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """
        Chat completion API call (streaming)

        Yields SSE formatted strings
        """
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        payload.update(kwargs)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                self._get_endpoint(),
                headers=self._get_headers(),
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise LLMError(
                        f"LLM API error: {response.status_code}",
                        status_code=response.status_code,
                        body=body.decode(),
                    )

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"
                    elif line == "data: [DONE]":
                        yield "data: [DONE]\n\n"
                        break

    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Simple text generation

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt

        Returns:
            Generated text
        """
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=prompt))

        response = await self.chat_completion(messages, **kwargs)
        return response.content

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> Any:
        """
        Generate JSON response

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt

        Returns:
            Parsed JSON object
        """
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=prompt))

        response = await self.chat_completion(
            messages,
            response_format={"type": "json_object"},
            **kwargs,
        )

        content = strip_code_fence(response.content)
        return json.loads(content)


class LLMError(Exception):
    """LLM API Error"""

    def __init__(self, message: str, status_code: int = 0, body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def strip_code_fence(content: str) -> str:
    """Remove markdown code fences from content"""
    import re
    content = re.sub(r"^```json\s*\n?", "", content, flags=re.IGNORECASE)
    content = re.sub(r"^```\s*\n?", "", content)
    content = re.sub(r"\n?```\s*$", "", content)
    return content.strip()


# Singleton instance
_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """Get LLM client singleton"""
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
