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
【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。
例: 機械学習, 画像認識, ニューラルネットワーク"""

        prompt = f"""以下のテキストから最大{max_tags}個の主要なテーマタグを抽出してください。

【出力形式】タグ1, タグ2, タグ3
※前置き（「以下が〜」等）は不要。タグのみを出力。

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

        # Remove common prefix phrases that LLM might add
        prefixes_to_remove = [
            "以下が抽出したタグです：",
            "以下が抽出したタグです:",
            "以下のタグを抽出しました：",
            "以下のタグを抽出しました:",
            "抽出したタグ：",
            "抽出したタグ:",
            "タグ：",
            "タグ:",
            "以下がタグです：",
            "以下がタグです:",
            "以下のタグです：",
            "以下のタグです:",
        ]

        cleaned_str = tags_str.strip()
        for prefix in prefixes_to_remove:
            if cleaned_str.startswith(prefix):
                cleaned_str = cleaned_str[len(prefix):].strip()
                break

        # Handle various separators
        cleaned_str = cleaned_str.replace("、", ",").replace("・", ",")
        tags = [tag.strip() for tag in cleaned_str.split(",")]

        # Filter out empty tags and tags that look like explanatory text
        invalid_patterns = ["以下", "抽出", "タグ", "です", "ました"]
        filtered_tags = []
        for tag in tags:
            if not tag:
                continue
            # Skip if tag contains invalid patterns (likely explanatory text)
            if any(pattern in tag for pattern in invalid_patterns) and len(tag) > 10:
                continue
            filtered_tags.append(tag)

        return filtered_tags

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
        max_length: int = 1200,
    ) -> LLMResult:
        """
        Generate structured research summary for oipf_research_abstract

        研究資料から構造化されたAbstractを生成する。
        Background, Objective, Method, Result, Discussion, Future Planの
        各セクションで整理し、最終的に統合された要約を生成。

        Args:
            text: Full document text
            max_length: Maximum summary length

        Returns:
            LLMResult with structured research summary
        """
        system_prompt = f"""あなたは自動車業界の研究に広く、かつ深く精通した専門家です。
研究の成果発表資料のAbstract作成を担当しています。

【あなたの役割】
技術的な内容や数値情報を適切に保持しつつ、読み手が研究の全体像を把握しやすい構成でまとめてください。

【Abstract作成手順】
以下の6つのセクションそれぞれについて、資料から該当する情報を抽出し、簡潔にまとめてください。

1. **Background（背景）**
   - 研究の動機となった課題や社会的・技術的背景
   - 既存技術の限界や解決すべき問題点

2. **Objective（目的）**
   - 本研究で達成しようとする具体的な目標
   - 研究の狙いや期待される成果

3. **Method（手法）**
   - 採用したアプローチ、技術、実験方法
   - 使用したツール、材料、評価指標

4. **Result（結果）**
   - 得られた具体的な成果、数値データ
   - 実験・解析の主要な結果

5. **Discussion（考察）**
   - 結果の意味・示唆
   - 成果の限界や課題
   - 他の研究との比較や位置づけ

6. **Future Plan（今後の展開）**
   - 今後の研究計画、発展の方向性
   - 必要な追加検証、実装計画
   - 実用化に向けた展望

【出力ルール】
- 各セクションの内容を統合し、一貫性のある流れのAbstractを作成
- 重複する記述は排除し、全体の整合性を確保
- 専門用語は適切に使用しつつ、明瞭な表現を心がける
- 具体的な数値や技術名は可能な限り保持
- 日本語で{max_length}文字以内にまとめる
- 見出し（Background:等）は含めず、自然な文章として出力"""

        prompt = f"""以下の研究資料から、構造化されたAbstractを作成してください。
Background, Objective, Method, Result, Discussion, Future Planの各観点を網羅し、
統合された読みやすい要約文として出力してください。

【研究資料】
{text[:15000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=max_length * 2, temperature=0.4)

    async def generate_table_summary(
        self,
        table_context: str,
        markdown_table: str,
        max_length: int = 800,
    ) -> LLMResult:
        """
        Generate summary for table data (Excel/CSV) optimized for research data retrieval.

        表形式データ専用の要約生成。カラムの意味、数値情報、データの特徴を
        後から検索・質問できるように要約する。

        Args:
            table_context: Summary context including schema and statistics
            markdown_table: Full table in markdown format
            max_length: Maximum summary length

        Returns:
            LLMResult with table summary
        """
        system_prompt = f"""あなたは研究データの分析専門家です。
表形式のデータ（Excel/CSV）を分析し、後から検索や質問で見つけられるような要約を作成してください。

【あなたの役割】
研究者が「機種XXXの疲労試験結果を教えて」「素材YYYのピーク値は？」といった質問をした際に、
この要約がベクトル検索でヒットし、詳細データにアクセスできるようにする。

【要約に含めるべき情報】

1. **データの概要**
   - このデータが何を表しているか（試験結果、測定データ、仕様表など）
   - 対象となる製品、機種、素材、試験条件など

2. **カラム（列）の説明**
   - 各カラムが何を意味するか
   - 単位があれば記載（mm, MPa, %, 秒など）
   - 特に重要な数値カラムを強調

3. **数値データの特徴**
   - 主要な数値の範囲（最小〜最大）
   - 特徴的な値（ピーク値、閾値、基準値など）
   - 傾向やパターンがあれば記載

4. **キーワード**
   - 検索でヒットすべき専門用語
   - 製品名、試験名、規格名など

【出力ルール】
- 日本語で{max_length}文字以内
- 箇条書きではなく、自然な文章として出力
- 具体的な数値や固有名詞を含める
- 「このデータは〜」のような説明口調で開始"""

        prompt = f"""以下の表データを分析し、検索可能な要約を作成してください。

【テーブル情報】
{table_context}

【データ（Markdown形式）】
{markdown_table[:10000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=max_length * 2, temperature=0.3)

    async def extract_table_tags(
        self,
        table_context: str,
        num_tags: int = 8,
    ) -> LLMResult:
        """
        Extract tags from table data for classification and search.

        表形式データ専用のタグ抽出。データの種類、対象、測定項目などを
        タグとして抽出する。

        Args:
            table_context: Summary context including schema and statistics
            num_tags: Number of tags to generate

        Returns:
            LLMResult with tags (comma-separated)
        """
        system_prompt = f"""あなたは研究データ分類の専門家です。
表形式データ（Excel/CSV）から、検索・分類に適したタグを{num_tags}個程度抽出してください。

タグの種類：
- データ種別（例：試験結果, 測定データ, 仕様表, 検証結果）
- 対象（例：疲労試験, 引張試験, 熱特性, 強度評価）
- 素材・材料（例：CFRP, アルミ合金, 鋼材, 複合材料）
- 製品・部品（例：ボディパネル, シャフト, ギア, 電極）
- 測定項目（例：ひずみ, 応力, 温度, 荷重, 変位）
- 規格・基準（例：JIS, ISO, 社内規格）

【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。"""

        prompt = f"""以下の表データから、分類・検索用のタグを{num_tags}個程度抽出してください。

【出力形式】タグ1, タグ2, タグ3
※前置き不要。タグのみ出力。

【テーブル情報】
{table_context[:5000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=200)

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

【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。
例: 深層学習, 画像認識, 製造プロセス最適化"""

        prompt = f"""以下の研究資料から、分類用のタグを{num_tags}個程度抽出してください。

【出力形式】タグ1, タグ2, タグ3
※前置き（「以下が〜」等）は不要。タグのみを出力。

研究資料：
{text[:8000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=300)

    async def extract_proper_nouns_from_path(
        self,
        file_path: str,
        file_name: str,
        folder_path: str,
    ) -> LLMResult:
        """
        Extract proper nouns (research IDs, product identifiers, material identifiers)
        from file path and file name.

        Args:
            file_path: Full file path
            file_name: File name
            folder_path: Folder path

        Returns:
            LLMResult with proper nouns as JSON array string
        """
        system_prompt = """あなたはファイルパスから固有名詞を抽出する専門家です。

【重要】JSON配列形式で出力してください。説明文や前置きは一切不要です。

抽出対象:
- 研究ID（例: RD-2024-001, 研究-A-123, PROJ-001, AB12）
- 製品識別番号（例: 6S9, AP4DI, M3X-500, X-100A）
- 素材識別子（例: CFRP, Al6061, SUS304, アルミ合金, カーボン）

除外:
- プロジェクト名（一般的な名称）
- 一般的な単語（report, document, 資料, データ, 結果, 報告書など）
- 日付（2024, 202401, 2024-01など）
- 拡張子（.pdf, .docx, .xlsxなど）
- 一般的なフォルダ名（backup, archive, oldなど）

出力例: ["6S9", "CFRP", "RD-2024-001"]
固有名詞がない場合: []"""

        prompt = f"""以下のファイルパスとファイル名から、固有名詞を抽出してJSON配列で出力してください。

ファイルパス: {file_path}
ファイル名: {file_name}
フォルダパス: {folder_path}

【出力形式】JSON配列のみ（説明不要）
例: ["6S9", "CFRP", "RD-2024-001"]"""

        return await self.generate(prompt, system_prompt, max_tokens=200, temperature=0.1)

    def parse_proper_nouns(self, json_str: str) -> list[str]:
        """
        Parse proper nouns JSON string into list

        Args:
            json_str: JSON array string

        Returns:
            List of proper nouns
        """
        if not json_str:
            return []

        # Clean up the response
        cleaned = json_str.strip()

        # Remove common prefix phrases
        prefixes_to_remove = [
            "以下が抽出した固有名詞です：",
            "以下が抽出した固有名詞です:",
            "固有名詞：",
            "固有名詞:",
            "抽出結果：",
            "抽出結果:",
        ]
        for prefix in prefixes_to_remove:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                break

        # Try to parse as JSON
        try:
            result = json.loads(cleaned)
            if isinstance(result, list):
                # Filter out empty strings and common words
                common_words = {
                    "report", "document", "data", "result", "results",
                    "資料", "データ", "結果", "報告書", "報告", "分析",
                    "backup", "archive", "old", "new", "final", "draft",
                    "バックアップ", "アーカイブ", "最終", "下書き",
                }
                filtered = [
                    str(item).strip()
                    for item in result
                    if item and str(item).strip().lower() not in common_words
                ]
                return filtered
        except json.JSONDecodeError:
            pass

        # Fallback: try to extract from text
        # Look for patterns like ["item1", "item2"]
        import re
        match = re.search(r'\[([^\]]*)\]', cleaned)
        if match:
            items_str = match.group(1)
            # Split by comma and clean up quotes
            items = [
                item.strip().strip('"\'')
                for item in items_str.split(',')
                if item.strip()
            ]
            return items

        return []

    async def extract_persons_from_content(
        self,
        text: str,
        max_persons: int = 10,
    ) -> LLMResult:
        """
        Extract person names with roles from document content.

        ドキュメント内容から役割付きの氏名を抽出する。
        検索時に「決済者は誰？」などの質問に答えられるようにする。

        Args:
            text: Document text (first few pages typically)
            max_persons: Maximum number of persons to extract

        Returns:
            LLMResult with persons as JSON array string
            Format: [{"name": "山田太郎", "role": "決済者"}, ...]
        """
        system_prompt = f"""あなたはドキュメントから人名と役割を抽出する専門家です。

【重要】JSON配列形式で出力してください。説明文や前置きは一切不要です。

抽出対象の役割:
- 決済者、承認者、検印者
- 報告者、作成者、発表者
- 担当者、主担当、副担当
- 責任者、リーダー、サブリーダー
- 部長、課長、主任、主査
- 起案者、申請者、確認者
- 研究者、開発者、設計者

【出力形式】
[{{"name": "山田太郎", "role": "決済者"}}, {{"name": "鈴木一郎", "role": "報告者"}}]

【ルール】
- 氏名は姓名の形式で抽出（例：山田太郎、佐藤花子）
- 役割が不明な場合は "role": "関係者" とする
- 最大{max_persons}人まで抽出
- 人名が見つからない場合は空配列 [] を返す
- 組織名や部署名は抽出しない"""

        prompt = f"""以下のドキュメントから、役割付きの人名を抽出してJSON配列で出力してください。

【出力形式】JSON配列のみ（説明不要）
例: [{{"name": "山田太郎", "role": "決済者"}}, {{"name": "鈴木一郎", "role": "報告者"}}]

【ドキュメント】
{text[:6000]}"""

        return await self.generate(prompt, system_prompt, max_tokens=500, temperature=0.1)

    def parse_persons_to_proper_nouns(self, json_str: str) -> list[str]:
        """
        Parse persons JSON and convert to proper nouns format.

        役割付き氏名を固有名詞形式に変換する。
        例: [{"name": "山田太郎", "role": "決済者"}] → ["山田太郎(決済者)"]

        Args:
            json_str: JSON array string from extract_persons_from_content

        Returns:
            List of proper nouns in "氏名(役割)" format
        """
        if not json_str:
            return []

        # Clean up the response
        cleaned = json_str.strip()

        # Remove common prefixes
        prefixes_to_remove = [
            "以下が抽出した人名です：",
            "以下が抽出した人名です:",
            "抽出結果：",
            "抽出結果:",
        ]
        for prefix in prefixes_to_remove:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                break

        # Try to parse as JSON
        try:
            result = json.loads(cleaned)
            if isinstance(result, list):
                proper_nouns = []
                for item in result:
                    if isinstance(item, dict):
                        name = item.get("name", "").strip()
                        role = item.get("role", "").strip()
                        if name:
                            if role and role != "関係者":
                                proper_nouns.append(f"{name}({role})")
                            else:
                                proper_nouns.append(name)
                return proper_nouns
        except json.JSONDecodeError:
            pass

        # Fallback: try to extract from text pattern
        import re
        # Look for JSON array pattern
        match = re.search(r'\[([^\]]*)\]', cleaned, re.DOTALL)
        if match:
            try:
                result = json.loads(f"[{match.group(1)}]")
                if isinstance(result, list):
                    proper_nouns = []
                    for item in result:
                        if isinstance(item, dict):
                            name = item.get("name", "").strip()
                            role = item.get("role", "").strip()
                            if name:
                                if role and role != "関係者":
                                    proper_nouns.append(f"{name}({role})")
                                else:
                                    proper_nouns.append(name)
                    return proper_nouns
            except json.JSONDecodeError:
                pass

        return []

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
【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。
例: グラフ, データ分析, 実験結果"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"この画像から最大{max_tags}個の主要なテーマタグを抽出してください。【出力形式】タグ1, タグ2, タグ3 ※前置き不要、タグのみ出力"
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
                            "text": f"この画像から最大{max_tags}個の主要なテーマタグを抽出してください。【出力形式】タグ1, タグ2, タグ3 ※前置き不要、タグのみ出力"
                        }
                    ]
                }
            ]

            system_prompt = """あなたは画像分類の専門家です。与えられた画像から主要なテーマやキーワードを抽出してください。
【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。
例: グラフ, データ分析, 実験結果"""

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
