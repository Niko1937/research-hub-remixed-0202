"""
LLM Client Module

LLM APIクライアント（要約生成、タグ抽出用）
- OpenAI互換API（OpenAI, LiteLLM等）
- AWS Bedrock（Claude, Titan等）
プロキシ環境にも対応
画像解析（Vision LLM）にも対応
"""

import sys
import base64
import mimetypes
from pathlib import Path
from typing import Optional, Union
from dataclasses import dataclass
import asyncio
import json

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from common.config import config, LLMConfig


# MIME type mapping for images
IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}


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

    マルチプロバイダー対応（OpenAI互換、AWS Bedrock）
    要約生成やタグ抽出のためのLLMクライアント
    プロキシ環境にも対応
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
        llm_config: Optional[LLMConfig] = None,
    ):
        """
        Initialize LLM client

        Args:
            base_url: LLM API base URL (default: from env)
            api_key: API key (default: from env)
            model: Model name (default: from env)
            timeout: Request timeout in seconds
            llm_config: LLM configuration including proxy (default: from env)
        """
        self._config = llm_config or config.llm
        self.provider = self._config.provider
        self.base_url = (base_url or self._config.base_url).rstrip("/") if self._config.base_url else ""
        self.api_key = api_key or self._config.api_key
        self.model = model or self._config.model
        self.aws_region = self._config.aws_region
        self.timeout = timeout
        self._bedrock_client = None

        # Validate configuration based on provider
        if self.provider == "openai":
            if not self.base_url:
                raise ValueError("LLM_BASE_URL is not configured")
            if not self.api_key:
                raise ValueError("LLM_API_KEY is not configured")
        elif self.provider == "bedrock":
            if not self.model:
                raise ValueError("LLM_MODEL is not configured for Bedrock")

    def _get_bedrock_client(self):
        """Get or create boto3 Bedrock client"""
        if self._bedrock_client is None:
            import boto3
            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=self.aws_region,
            )
        return self._bedrock_client

    def _get_headers(self) -> dict:
        """Get request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs including proxy if configured"""
        kwargs = {"timeout": self.timeout}
        proxy_kwargs = self._config.get_httpx_kwargs()
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
        if self.provider == "bedrock":
            return await self._generate_bedrock(prompt, system_prompt, max_tokens, temperature)
        else:
            return await self._generate_openai(prompt, system_prompt, max_tokens, temperature)

    async def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> LLMResult:
        """Generate text using OpenAI-compatible API"""
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

    async def _generate_bedrock(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> LLMResult:
        """Generate text using AWS Bedrock"""
        model_id = self.model

        def _invoke_bedrock():
            client = self._get_bedrock_client()

            # Build messages for Converse API
            messages = [{"role": "user", "content": [{"text": prompt}]}]

            inference_config = {
                "maxTokens": max_tokens,
                "temperature": temperature,
            }

            converse_kwargs = {
                "modelId": model_id,
                "messages": messages,
                "inferenceConfig": inference_config,
            }

            if system_prompt:
                converse_kwargs["system"] = [{"text": system_prompt}]

            response = client.converse(**converse_kwargs)

            return LLMResult(
                success=True,
                content=response["output"]["message"]["content"][0]["text"],
                model=model_id,
                usage={
                    "input_tokens": response.get("usage", {}).get("inputTokens", 0),
                    "output_tokens": response.get("usage", {}).get("outputTokens", 0),
                },
            )

        try:
            return await asyncio.to_thread(_invoke_bedrock)
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Bedrock error: {str(e)}",
                model=model_id,
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

    async def extract_researchers(
        self,
        text: str,
    ) -> LLMResult:
        """
        Extract researcher/member names from text

        ドキュメントの先頭ページから著者・メンバー名を抽出する。

        Args:
            text: Text from first pages of document

        Returns:
            LLMResult with member names (one per line)
        """
        system_prompt = """あなたは文書から人名を抽出する専門家です。

【重要な出力ルール】
- 人名のみを出力（説明文や前置きは絶対に書かない）
- 1行に1人の名前のみ
- 日本人名：「山田太郎」のように姓名のみ
- 外国人名：「John Smith」のようにそのまま
- 名前が見つからない場合のみ「該当なし」と出力

【出力例】
山田太郎
佐藤花子
John Smith

【禁止事項】
- 「以下の方々が〜」などの説明文
- 「メンバー：」などの見出し
- 組織名、部署名、役職名のみの出力"""

        prompt = f"""以下のテキストから人名を抽出し、名前のみを1行ずつ出力してください。
説明文は不要です。名前だけを出力してください。

テキスト：
{text[:6000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=500)

    def parse_researchers(self, researchers_str: str) -> list[str]:
        """
        Parse researchers string into list

        Args:
            researchers_str: Newline-separated researcher names

        Returns:
            List of researcher names
        """
        if not researchers_str or "該当なし" in researchers_str:
            return []

        # Phrases that indicate description text (not person names)
        description_phrases = [
            "以下", "次の", "上記", "下記", "方々", "メンバー", "担当者", "著者",
            "研究者", "チーム", "グループ", "一覧", "リスト", "名前",
            "です", "ます", "した", "する", "ある", "いる", "なる",
            "抽出", "記載", "含む", "確認", "特定", "見つ",
            "：", ":", "。", "、が", "について", "として", "による",
            "人物", "氏名", "名簿", "所属", "部署",
        ]

        # Split by newlines and clean up
        researchers = []
        for line in researchers_str.split("\n"):
            name = line.strip()
            # Remove common prefixes like "- ", "・", numbers
            name = name.lstrip("-・•●○◎123456789０１２３４５６７８９. 　")

            # Skip empty or too short
            if not name or len(name) < 2:
                continue

            # Skip if contains "該当"
            if "該当" in name:
                continue

            # Skip if too long (person names are typically short)
            if len(name) > 20:
                continue

            # Skip if contains description phrases
            if any(phrase in name for phrase in description_phrases):
                continue

            # Skip if looks like a sentence (contains common particles/endings)
            if name.endswith(("。", "、", "です", "ます", "した", "ください")):
                continue

            researchers.append(name)

        return researchers

    async def generate_research_summary(
        self,
        text: str,
        max_length: int = 800,
    ) -> LLMResult:
        """
        Generate research summary for oipf_research_abstract

        研究資料から研究の概要を生成する。

        Args:
            text: Full document text
            max_length: Maximum summary length

        Returns:
            LLMResult with research summary
        """
        system_prompt = f"""あなたは研究文書の要約専門家です。与えられた研究資料の内容を、以下の観点で要約してください：

1. 研究の目的・背景
2. 主要な手法・アプローチ
3. 主な成果・結論
4. 意義・応用可能性

要約は日本語で、{max_length}文字以内にしてください。
段落分けせず、一つの文章としてまとめてください。"""

        prompt = f"""以下の研究資料を要約してください：

{text[:12000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=max_length * 2)

    async def extract_research_tags(
        self,
        text: str,
        num_tags: int = 10,
    ) -> LLMResult:
        """
        Extract research classification tags for oipf_research_themetags

        研究を他の研究と分類するためのタグを生成する。

        Args:
            text: Document text
            num_tags: Number of tags to generate (default: 10)

        Returns:
            LLMResult with tags (comma-separated)
        """
        system_prompt = f"""あなたは研究分類の専門家です。与えられた研究資料から、この研究を他の研究と分類・検索するのに適したタグを{num_tags}個程度抽出してください。

タグの種類：
- 研究分野（例：機械学習、材料科学、バイオテクノロジー）
- 技術・手法（例：深層学習、シミュレーション、実験解析）
- 応用領域（例：製造業、医療、エネルギー）
- キーワード（例：最適化、予測、自動化）

タグはカンマ区切りで出力してください。各タグは簡潔に（1-4語程度）。"""

        prompt = f"""以下の研究資料から、分類用のタグを{num_tags}個程度抽出してください。
タグのみをカンマ区切りで出力してください。

研究資料：
{text[:8000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=300)

    def _encode_image_to_base64(self, image_path: Path) -> tuple[str, str]:
        """
        Encode image file to base64 data URL

        Args:
            image_path: Path to image file

        Returns:
            Tuple of (base64_data_url, mime_type)
        """
        image_path = Path(image_path)
        ext = image_path.suffix.lower()
        mime_type = IMAGE_MIME_TYPES.get(ext, "image/jpeg")

        with open(image_path, "rb") as f:
            image_data = f.read()

        base64_data = base64.b64encode(image_data).decode("utf-8")
        data_url = f"data:{mime_type};base64,{base64_data}"

        return data_url, mime_type

    async def analyze_image(
        self,
        image_path: Union[str, Path],
        max_length: int = 500,
    ) -> LLMResult:
        """
        Analyze image using Vision LLM and generate description

        Args:
            image_path: Path to image file
            max_length: Maximum description length

        Returns:
            LLMResult with image description
        """
        image_path = Path(image_path)

        if not image_path.exists():
            return LLMResult(
                success=False,
                content="",
                error=f"Image file not found: {image_path}",
                model=self.model,
            )

        if self.provider == "bedrock":
            return await self._analyze_image_bedrock(image_path, max_length)
        else:
            return await self._analyze_image_openai(image_path, max_length)

    async def _analyze_image_openai(
        self,
        image_path: Path,
        max_length: int = 500,
    ) -> LLMResult:
        """Analyze image using OpenAI Vision API"""
        try:
            data_url, mime_type = self._encode_image_to_base64(image_path)
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Failed to read image: {str(e)}",
                model=self.model,
            )

        # Create message with image content (OpenAI Vision API format)
        messages = [
            {
                "role": "system",
                "content": f"""あなたは画像分析の専門家です。与えられた画像の内容を詳しく説明してください。
説明は日本語で、{max_length}文字以内にしてください。
画像に含まれる主要な要素、テキスト、図表、グラフなどがあれば、それらも説明に含めてください。"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "この画像の内容を詳しく説明してください。"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    }
                ]
            }
        ]

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_length * 2,
            "temperature": 0.3,
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
                        error=f"Vision API error: {response.status_code} - {response.text}",
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
                error=f"Vision LLM error: {str(e)}",
                model=self.model,
            )

    async def _analyze_image_bedrock(
        self,
        image_path: Path,
        max_length: int = 500,
    ) -> LLMResult:
        """Analyze image using AWS Bedrock Converse API with Vision"""
        model_id = self.model

        # Read and encode image
        try:
            ext = image_path.suffix.lower()
            mime_type = IMAGE_MIME_TYPES.get(ext, "image/jpeg")
            # Bedrock uses format like "jpeg", "png", etc.
            image_format = mime_type.split("/")[1]
            if image_format == "jpg":
                image_format = "jpeg"

            with open(image_path, "rb") as f:
                image_bytes = f.read()
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Failed to read image: {str(e)}",
                model=model_id,
            )

        def _invoke_bedrock():
            client = self._get_bedrock_client()

            # Build messages for Converse API with image
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": image_format,
                                "source": {"bytes": image_bytes}
                            }
                        },
                        {
                            "text": "この画像の内容を詳しく説明してください。"
                        }
                    ]
                }
            ]

            system_prompt = f"""あなたは画像分析の専門家です。与えられた画像の内容を詳しく説明してください。
説明は日本語で、{max_length}文字以内にしてください。
画像に含まれる主要な要素、テキスト、図表、グラフなどがあれば、それらも説明に含めてください。"""

            inference_config = {
                "maxTokens": max_length * 2,
                "temperature": 0.3,
            }

            response = client.converse(
                modelId=model_id,
                messages=messages,
                system=[{"text": system_prompt}],
                inferenceConfig=inference_config,
            )

            return LLMResult(
                success=True,
                content=response["output"]["message"]["content"][0]["text"],
                model=model_id,
                usage={
                    "input_tokens": response.get("usage", {}).get("inputTokens", 0),
                    "output_tokens": response.get("usage", {}).get("outputTokens", 0),
                },
            )

        try:
            return await asyncio.to_thread(_invoke_bedrock)
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Bedrock Vision error: {str(e)}",
                model=model_id,
            )

    def analyze_image_sync(
        self,
        image_path: Union[str, Path],
        max_length: int = 500,
    ) -> LLMResult:
        """Synchronous version of analyze_image"""
        return asyncio.run(self.analyze_image(image_path, max_length))

    async def extract_tags_from_image(
        self,
        image_path: Union[str, Path],
        max_tags: int = 5,
    ) -> LLMResult:
        """
        Extract theme tags from image using Vision LLM

        Args:
            image_path: Path to image file
            max_tags: Maximum number of tags

        Returns:
            LLMResult with tags (comma-separated)
        """
        image_path = Path(image_path)

        if not image_path.exists():
            return LLMResult(
                success=False,
                content="",
                error=f"Image file not found: {image_path}",
                model=self.model,
            )

        if self.provider == "bedrock":
            return await self._extract_tags_from_image_bedrock(image_path, max_tags)
        else:
            return await self._extract_tags_from_image_openai(image_path, max_tags)

    async def _extract_tags_from_image_openai(
        self,
        image_path: Path,
        max_tags: int = 5,
    ) -> LLMResult:
        """Extract tags from image using OpenAI Vision API"""
        try:
            data_url, mime_type = self._encode_image_to_base64(image_path)
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Failed to read image: {str(e)}",
                model=self.model,
            )

        messages = [
            {
                "role": "system",
                "content": """あなたは画像分類の専門家です。与えられた画像から主要なテーマやキーワードを抽出してください。
タグはカンマ区切りで出力してください。各タグは簡潔に（1-3語程度）。"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"この画像から最大{max_tags}個の主要なテーマタグを抽出してください。タグのみをカンマ区切りで出力してください。"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    }
                ]
            }
        ]

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 200,
            "temperature": 0.3,
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
                        error=f"Vision API error: {response.status_code} - {response.text}",
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

        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Vision LLM error: {str(e)}",
                model=self.model,
            )

    async def _extract_tags_from_image_bedrock(
        self,
        image_path: Path,
        max_tags: int = 5,
    ) -> LLMResult:
        """Extract tags from image using AWS Bedrock Converse API with Vision"""
        model_id = self.model

        # Read and encode image
        try:
            ext = image_path.suffix.lower()
            mime_type = IMAGE_MIME_TYPES.get(ext, "image/jpeg")
            image_format = mime_type.split("/")[1]
            if image_format == "jpg":
                image_format = "jpeg"

            with open(image_path, "rb") as f:
                image_bytes = f.read()
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Failed to read image: {str(e)}",
                model=model_id,
            )

        def _invoke_bedrock():
            client = self._get_bedrock_client()

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": image_format,
                                "source": {"bytes": image_bytes}
                            }
                        },
                        {
                            "text": f"この画像から最大{max_tags}個の主要なテーマタグを抽出してください。タグのみをカンマ区切りで出力してください。"
                        }
                    ]
                }
            ]

            system_prompt = """あなたは画像分類の専門家です。与えられた画像から主要なテーマやキーワードを抽出してください。
タグはカンマ区切りで出力してください。各タグは簡潔に（1-3語程度）。"""

            response = client.converse(
                modelId=model_id,
                messages=messages,
                system=[{"text": system_prompt}],
                inferenceConfig={"maxTokens": 200, "temperature": 0.3},
            )

            return LLMResult(
                success=True,
                content=response["output"]["message"]["content"][0]["text"],
                model=model_id,
            )

        try:
            return await asyncio.to_thread(_invoke_bedrock)
        except Exception as e:
            return LLMResult(
                success=False,
                content="",
                error=f"Bedrock Vision error: {str(e)}",
                model=model_id,
            )


def get_llm_client() -> LLMClient:
    """Get configured LLM client instance"""
    return LLMClient()


if __name__ == "__main__":
    # Test
    print("LLM Client Configuration:")
    print(f"  Provider: {config.llm.provider}")
    print(f"  Model: {config.llm.model}")
    if config.llm.provider == "bedrock":
        print(f"  AWS Region: {config.llm.aws_region}")
    else:
        print(f"  Base URL: {config.llm.base_url or 'NOT SET'}")
        print(f"  Proxy: {'Enabled (' + config.llm.proxy_url + ')' if config.llm.proxy_enabled else 'Disabled'}")
