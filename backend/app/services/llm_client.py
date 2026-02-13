"""
LLM Client - Multi-Provider Support

LLM APIクライアント
- OpenAI互換API（OpenAI, LiteLLM, Azure OpenAI等）
- AWS Bedrock（Claude, Titan等）
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
    """LLM API Client with multi-provider support"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
    ):
        self.settings = get_settings()
        self.provider = self.settings.llm_provider.lower()
        self.model = model or self.settings.llm_model
        self.timeout = timeout

        # OpenAI-compatible settings
        self.base_url = (base_url or self.settings.llm_base_url or "").rstrip("/")
        self.api_key = api_key or self.settings.llm_api_key

        # Proxy configuration
        self.proxy_url: Optional[str] = None
        if self.settings.proxy_enabled and self.settings.proxy_url:
            self.proxy_url = self.settings.proxy_url

        # Bedrock client (lazy initialization)
        self._bedrock_client = None

        # Validate configuration based on provider
        if self.provider == "openai":
            if not self.base_url or not self.api_key:
                raise ValueError("LLM_BASE_URL and LLM_API_KEY must be set for OpenAI provider")
        elif self.provider == "bedrock":
            if not self.model:
                raise ValueError("LLM_MODEL must be set for Bedrock provider")

    def _get_bedrock_client(self):
        """Get or create boto3 Bedrock client"""
        if self._bedrock_client is None:
            import boto3
            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=self.settings.llm_aws_region,
            )
        return self._bedrock_client

    def _get_endpoint(self) -> str:
        """Get the chat completions endpoint URL (OpenAI provider)"""
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    def _get_headers(self) -> dict:
        """Get request headers (OpenAI provider)"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get_client_kwargs(self) -> dict:
        """Get httpx.AsyncClient kwargs including proxy if configured"""
        kwargs = {"timeout": self.timeout}
        if self.proxy_url:
            kwargs["proxy"] = self.proxy_url
        return kwargs

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
        if self.provider == "bedrock":
            return await self._chat_completion_bedrock(
                messages, temperature, max_tokens, **kwargs
            )
        else:
            return await self._chat_completion_openai(
                messages, temperature, max_tokens, response_format, **kwargs
            )

    async def _chat_completion_openai(
        self,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        response_format: Optional[dict] = None,
        **kwargs,
    ) -> ChatCompletionResponse:
        """Chat completion using OpenAI-compatible API"""
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            payload["response_format"] = response_format

        payload.update(kwargs)

        async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
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

    async def _chat_completion_bedrock(
        self,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        **kwargs,
    ) -> ChatCompletionResponse:
        """Chat completion using AWS Bedrock"""

        def _invoke_bedrock():
            client = self._get_bedrock_client()
            model_id = self.model

            # Convert messages to Bedrock format
            bedrock_messages = []
            system_prompt = None

            for msg in messages:
                if msg.role == "system":
                    system_prompt = msg.content
                else:
                    bedrock_messages.append({
                        "role": msg.role,
                        "content": [{"text": msg.content}]
                    })

            # Build request body based on model type
            if "anthropic.claude" in model_id.lower():
                # Claude models use Converse API format
                body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {
                            "role": m.role,
                            "content": m.content
                        }
                        for m in messages if m.role != "system"
                    ],
                }
                if system_prompt:
                    body["system"] = system_prompt

                response = client.invoke_model(
                    modelId=model_id,
                    body=json.dumps(body),
                    contentType="application/json",
                    accept="application/json",
                )
                response_body = json.loads(response["body"].read())

                return ChatCompletionResponse(
                    id=response_body.get("id", ""),
                    model=model_id,
                    content=response_body["content"][0]["text"],
                    finish_reason=response_body.get("stop_reason", ""),
                    usage={
                        "input_tokens": response_body.get("usage", {}).get("input_tokens", 0),
                        "output_tokens": response_body.get("usage", {}).get("output_tokens", 0),
                    },
                    raw_response=response_body,
                )

            elif "amazon.titan" in model_id.lower():
                # Titan models
                prompt_text = self._format_messages_as_text(messages)
                body = {
                    "inputText": prompt_text,
                    "textGenerationConfig": {
                        "maxTokenCount": max_tokens,
                        "temperature": temperature,
                    }
                }

                response = client.invoke_model(
                    modelId=model_id,
                    body=json.dumps(body),
                    contentType="application/json",
                    accept="application/json",
                )
                response_body = json.loads(response["body"].read())

                return ChatCompletionResponse(
                    id="",
                    model=model_id,
                    content=response_body["results"][0]["outputText"],
                    finish_reason=response_body["results"][0].get("completionReason", ""),
                    raw_response=response_body,
                )

            elif "meta.llama" in model_id.lower():
                # Llama models
                prompt_text = self._format_messages_as_text(messages)
                body = {
                    "prompt": prompt_text,
                    "max_gen_len": max_tokens,
                    "temperature": temperature,
                }

                response = client.invoke_model(
                    modelId=model_id,
                    body=json.dumps(body),
                    contentType="application/json",
                    accept="application/json",
                )
                response_body = json.loads(response["body"].read())

                return ChatCompletionResponse(
                    id="",
                    model=model_id,
                    content=response_body["generation"],
                    finish_reason=response_body.get("stop_reason", ""),
                    raw_response=response_body,
                )

            else:
                # Default: try Converse API (works for many models)
                try:
                    inference_config = {
                        "maxTokens": max_tokens,
                        "temperature": temperature,
                    }

                    converse_kwargs = {
                        "modelId": model_id,
                        "messages": bedrock_messages,
                        "inferenceConfig": inference_config,
                    }

                    if system_prompt:
                        converse_kwargs["system"] = [{"text": system_prompt}]

                    response = client.converse(**converse_kwargs)

                    return ChatCompletionResponse(
                        id=response.get("ResponseMetadata", {}).get("RequestId", ""),
                        model=model_id,
                        content=response["output"]["message"]["content"][0]["text"],
                        finish_reason=response.get("stopReason", ""),
                        usage={
                            "input_tokens": response.get("usage", {}).get("inputTokens", 0),
                            "output_tokens": response.get("usage", {}).get("outputTokens", 0),
                        },
                        raw_response=response,
                    )
                except Exception as e:
                    raise LLMError(f"Bedrock Converse API error: {e}")

        # Run synchronous boto3 call in thread pool
        return await asyncio.to_thread(_invoke_bedrock)

    def _format_messages_as_text(self, messages: list[ChatMessage]) -> str:
        """Format messages as plain text for models that don't support chat format"""
        parts = []
        for msg in messages:
            if msg.role == "system":
                parts.append(f"System: {msg.content}")
            elif msg.role == "user":
                parts.append(f"Human: {msg.content}")
            elif msg.role == "assistant":
                parts.append(f"Assistant: {msg.content}")
        parts.append("Assistant:")
        return "\n\n".join(parts)

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
        if self.provider == "bedrock":
            async for chunk in self._chat_completion_stream_bedrock(
                messages, temperature, max_tokens, **kwargs
            ):
                yield chunk
        else:
            async for chunk in self._chat_completion_stream_openai(
                messages, temperature, max_tokens, **kwargs
            ):
                yield chunk

    async def _chat_completion_stream_openai(
        self,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion using OpenAI-compatible API"""
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        payload.update(kwargs)

        async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
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

    async def _chat_completion_stream_bedrock(
        self,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion using AWS Bedrock"""

        def _invoke_bedrock_stream():
            client = self._get_bedrock_client()
            model_id = self.model

            # Convert messages to Bedrock format
            bedrock_messages = []
            system_prompt = None

            for msg in messages:
                if msg.role == "system":
                    system_prompt = msg.content
                else:
                    bedrock_messages.append({
                        "role": msg.role,
                        "content": [{"text": msg.content}]
                    })

            inference_config = {
                "maxTokens": max_tokens,
                "temperature": temperature,
            }

            converse_kwargs = {
                "modelId": model_id,
                "messages": bedrock_messages,
                "inferenceConfig": inference_config,
            }

            if system_prompt:
                converse_kwargs["system"] = [{"text": system_prompt}]

            # Use converse_stream for streaming
            response = client.converse_stream(**converse_kwargs)

            # Collect stream events
            chunks = []
            for event in response["stream"]:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"]["delta"]
                    if "text" in delta:
                        chunks.append(delta["text"])

            return chunks

        # Run synchronous boto3 call in thread pool
        chunks = await asyncio.to_thread(_invoke_bedrock_stream)

        # Yield chunks in SSE format
        for i, chunk in enumerate(chunks):
            sse_data = {
                "id": f"chatcmpl-{i}",
                "object": "chat.completion.chunk",
                "model": self.model,
                "choices": [{
                    "index": 0,
                    "delta": {"content": chunk},
                    "finish_reason": None
                }]
            }
            yield f"data: {json.dumps(sse_data)}\n\n"

        yield "data: [DONE]\n\n"

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

        # Note: response_format is only supported by OpenAI provider
        if self.provider == "openai":
            response = await self.chat_completion(
                messages,
                response_format={"type": "json_object"},
                **kwargs,
            )
        else:
            # For Bedrock, add JSON instruction to the prompt
            messages[-1] = ChatMessage(
                role="user",
                content=f"{prompt}\n\nRespond with valid JSON only, no additional text."
            )
            response = await self.chat_completion(messages, **kwargs)

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
