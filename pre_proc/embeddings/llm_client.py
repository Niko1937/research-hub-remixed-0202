"""
LLM Client Module

LLM APIクライアント（要約生成、タグ抽出用）
プロキシ環境にも対応
"""

import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
import asyncio
import json

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from common.config import config, LLMConfig, ProxyConfig


@dataclass
class LLMResult:
    """LLM API result"""
    success: bool
    content: str
    error: Optional[str] = None
    model: str = ""
    usage: Optional[dict] = None


class LLMClient:
    """
    LLM API Client

    要約生成やタグ抽出のためのLLMクライアント
    OpenAI互換API対応、プロキシ環境にも対応
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
        proxy_config: Optional[ProxyConfig] = None,
    ):
        """
        Initialize LLM client

        Args:
            base_url: LLM API base URL (default: from env)
            api_key: API key (default: from env)
            model: Model name (default: from env)
            timeout: Request timeout in seconds
            proxy_config: Proxy configuration (default: from env)
        """
        self.base_url = (base_url or config.llm.base_url).rstrip("/")
        self.api_key = api_key or config.llm.api_key
        self.model = model or config.llm.model
        self.timeout = timeout
        self.proxy_config = proxy_config or config.proxy

        if not self.base_url:
            raise ValueError("LLM_BASE_URL is not configured")
        if not self.api_key:
            raise ValueError("LLM_API_KEY is not configured")

    def _get_headers(self) -> dict:
        """Get request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs including proxy if configured"""
        kwargs = {"timeout": self.timeout}
        proxy_kwargs = self.proxy_config.get_httpx_kwargs()
        kwargs.update(proxy_kwargs)
        return kwargs

    def _get_endpoint(self) -> str:
        """Get chat completions endpoint"""
        if "/chat/completions" in self.base_url:
            return self.base_url
        return f"{self.base_url}/chat/completions"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> LLMResult:
        """
        Generate text using LLM

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation

        Returns:
            LLMResult with generated content or error
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                response = await client.post(
                    self._get_endpoint(),
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    return LLMResult(
                        success=False,
                        content="",
                        error=f"API error: {response.status_code} - {response.text}",
                        model=self.model,
                    )

                data = response.json()
                content = data["choices"][0]["message"]["content"]

                return LLMResult(
                    success=True,
                    content=content,
                    model=data.get("model", self.model),
                    usage=data.get("usage"),
                )

        except httpx.ConnectError as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Connection error: {e}. Check LLM_BASE_URL and network/proxy settings.",
                model=self.model,
            )
        except httpx.TimeoutException as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Timeout error: {e}",
                model=self.model,
            )
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"LLM error: {str(e)}",
                model=self.model,
            )

    def generate_sync(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> LLMResult:
        """Synchronous version of generate"""
        return asyncio.run(self.generate(prompt, system_prompt, max_tokens, temperature))

    async def generate_summary(
        self,
        text: str,
        max_length: int = 500,
    ) -> LLMResult:
        """
        Generate summary of text

        Args:
            text: Text to summarize
            max_length: Maximum summary length

        Returns:
            LLMResult with summary
        """
        system_prompt = """あなたは文書要約の専門家です。与えられたテキストの要点を簡潔にまとめてください。
要約は日本語で、{max_length}文字以内にしてください。""".format(max_length=max_length)

        prompt = f"""以下のテキストを要約してください：

{text[:8000]}"""  # Truncate to avoid token limits

        return await self.generate(prompt, system_prompt, max_tokens=max_length * 2)

    async def extract_tags(
        self,
        text: str,
        max_tags: int = 5,
    ) -> LLMResult:
        """
        Extract theme tags from text

        Args:
            text: Text to extract tags from
            max_tags: Maximum number of tags

        Returns:
            LLMResult with tags (comma-separated)
        """
        system_prompt = """あなたは文書分類の専門家です。与えられたテキストから主要なテーマやキーワードを抽出してください。
タグはカンマ区切りで出力してください。各タグは簡潔に（1-3語程度）。"""

        prompt = f"""以下のテキストから最大{max_tags}個の主要なテーマタグを抽出してください。
タグのみをカンマ区切りで出力してください。

テキスト：
{text[:5000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=200)

    def parse_tags(self, tags_str: str) -> list[str]:
        """
        Parse tags string into list

        Args:
            tags_str: Comma-separated tags

        Returns:
            List of tags
        """
        if not tags_str:
            return []

        # Handle various separators
        tags_str = tags_str.replace("、", ",").replace("・", ",")
        tags = [tag.strip() for tag in tags_str.split(",")]
        tags = [tag for tag in tags if tag]

        return tags


def get_llm_client() -> LLMClient:
    """Get configured LLM client instance"""
    return LLMClient()


if __name__ == "__main__":
    # Test
    print("LLM Client Configuration:")
    print(f"  Base URL: {config.llm.base_url or 'NOT SET'}")
    print(f"  Model: {config.llm.model}")
    print(f"  Proxy: {'Enabled' if config.proxy.enabled else 'Disabled'}")
