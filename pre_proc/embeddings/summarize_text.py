"""
Summarize Text Module

テキスト要約の個別実行スクリプト
LLMを使用してテキストを要約し、テーマタグを抽出する
"""

import sys
import argparse
import json
import asyncio
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from common.config import config, LLMConfig, ProxyConfig


@dataclass
class SummaryResult:
    """Summary result"""
    success: bool
    summary: str
    tags: list[str]
    error: Optional[str] = None
    model: str = ""


class SummarizerClient:
    """
    Text Summarizer Client

    LLMを使用してテキストの要約とタグ抽出を行う
    並列処理対応、プロキシ環境対応
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
        proxy_config: Optional[ProxyConfig] = None,
        max_concurrency: int = 1,
    ):
        """
        Initialize summarizer client

        Args:
            base_url: LLM API base URL (default: from env)
            api_key: API key (default: from env)
            model: Model name (default: from env)
            timeout: Request timeout in seconds
            proxy_config: Proxy configuration (default: from env)
            max_concurrency: Maximum concurrent requests (default: 1)
        """
        self.base_url = (base_url or config.llm.base_url).rstrip("/")
        self.api_key = api_key or config.llm.api_key
        self.model = model or config.llm.model
        self.timeout = timeout
        self.proxy_config = proxy_config or config.proxy
        self.max_concurrency = max_concurrency
        self._semaphore: Optional[asyncio.Semaphore] = None

        if not self.base_url:
            raise ValueError("LLM_BASE_URL is not configured")
        if not self.api_key:
            raise ValueError("LLM_API_KEY is not configured")

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Get or create semaphore for concurrency control"""
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.max_concurrency)
        return self._semaphore

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

    async def _call_llm(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> tuple[bool, str, Optional[str]]:
        """
        Call LLM API

        Returns:
            Tuple of (success, content, error)
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            async with self._get_semaphore():
                async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                    response = await client.post(
                        self._get_endpoint(),
                        headers=self._get_headers(),
                        json=payload,
                    )

                    if response.status_code != 200:
                        return False, "", f"API error: {response.status_code} - {response.text}"

                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    return True, content, None

        except httpx.ConnectError as e:
            return False, "", f"Connection error: {e}"
        except httpx.TimeoutException as e:
            return False, "", f"Timeout error: {e}"
        except Exception as e:
            return False, "", f"LLM error: {str(e)}"

    async def summarize(
        self,
        text: str,
        max_length: int = 500,
    ) -> tuple[bool, str, Optional[str]]:
        """
        Generate summary of text

        Args:
            text: Text to summarize
            max_length: Maximum summary length

        Returns:
            Tuple of (success, summary, error)
        """
        system_prompt = f"""あなたは文書要約の専門家です。与えられたテキストの要点を簡潔にまとめてください。
要約は日本語で、{max_length}文字以内にしてください。
要約のみを出力し、説明や前置きは不要です。"""

        prompt = f"""以下のテキストを要約してください：

{text[:10000]}"""

        return await self._call_llm(prompt, system_prompt, max_tokens=max_length * 2)

    async def extract_tags(
        self,
        text: str,
        max_tags: int = 5,
    ) -> tuple[bool, list[str], Optional[str]]:
        """
        Extract theme tags from text

        Args:
            text: Text to extract tags from
            max_tags: Maximum number of tags

        Returns:
            Tuple of (success, tags, error)
        """
        system_prompt = """あなたは文書分類の専門家です。与えられたテキストから主要なテーマやキーワードを抽出してください。
【重要】タグのみをカンマ区切りで出力してください。前置きや説明は一切不要です。
例: 機械学習, 画像認識, ニューラルネットワーク"""

        prompt = f"""以下のテキストから最大{max_tags}個の主要なテーマタグを抽出してください。

【出力形式】タグ1, タグ2, タグ3
※前置き（「以下が〜」等）は不要。タグのみを出力。

テキスト：
{text[:5000]}"""

        success, content, error = await self._call_llm(prompt, system_prompt, max_tokens=200)

        if not success:
            return False, [], error

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
        ]

        cleaned_str = content.strip()
        for prefix in prefixes_to_remove:
            if cleaned_str.startswith(prefix):
                cleaned_str = cleaned_str[len(prefix):].strip()
                break

        # Parse tags
        tags_str = cleaned_str.replace("、", ",").replace("・", ",")
        tags = [tag.strip() for tag in tags_str.split(",")]

        # Filter out empty tags and tags that look like explanatory text
        invalid_patterns = ["以下", "抽出", "です", "ました"]
        filtered_tags = []
        for tag in tags:
            if not tag or len(tag) >= 50:
                continue
            if any(pattern in tag for pattern in invalid_patterns) and len(tag) > 10:
                continue
            filtered_tags.append(tag)

        return True, filtered_tags[:max_tags], None

    async def summarize_and_extract_tags(
        self,
        text: str,
        summary_length: int = 500,
        max_tags: int = 5,
    ) -> SummaryResult:
        """
        Generate summary and extract tags

        Args:
            text: Text to process
            summary_length: Maximum summary length
            max_tags: Maximum number of tags

        Returns:
            SummaryResult with summary and tags
        """
        # Generate summary
        success, summary, error = await self.summarize(text, summary_length)
        if not success:
            return SummaryResult(
                success=False,
                summary="",
                tags=[],
                error=f"Summary failed: {error}",
                model=self.model,
            )

        # Extract tags
        success, tags, error = await self.extract_tags(text, max_tags)
        if not success:
            # Return with summary but no tags
            return SummaryResult(
                success=True,
                summary=summary,
                tags=[],
                error=f"Tag extraction failed: {error}",
                model=self.model,
            )

        return SummaryResult(
            success=True,
            summary=summary,
            tags=tags,
            model=self.model,
        )

    def summarize_sync(self, text: str, max_length: int = 500) -> tuple[bool, str, Optional[str]]:
        """Synchronous version of summarize"""
        return asyncio.run(self.summarize(text, max_length))

    def extract_tags_sync(self, text: str, max_tags: int = 5) -> tuple[bool, list[str], Optional[str]]:
        """Synchronous version of extract_tags"""
        return asyncio.run(self.extract_tags(text, max_tags))

    def summarize_and_extract_tags_sync(
        self,
        text: str,
        summary_length: int = 500,
        max_tags: int = 5,
    ) -> SummaryResult:
        """Synchronous version of summarize_and_extract_tags"""
        return asyncio.run(self.summarize_and_extract_tags(text, summary_length, max_tags))

    async def process_texts_parallel(
        self,
        texts: list[str],
        summary_length: int = 500,
        max_tags: int = 5,
        on_progress: Optional[callable] = None,
    ) -> list[SummaryResult]:
        """
        Process multiple texts in parallel

        Args:
            texts: List of texts to process
            summary_length: Maximum summary length
            max_tags: Maximum tags per text
            on_progress: Progress callback (completed, total)

        Returns:
            List of SummaryResult
        """
        async def process_with_index(index: int, text: str):
            result = await self.summarize_and_extract_tags(text, summary_length, max_tags)
            if on_progress:
                on_progress(index + 1, len(texts))
            return index, result

        tasks = [process_with_index(i, text) for i, text in enumerate(texts)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Sort by index
        ordered_results = [None] * len(texts)
        for result in results:
            if isinstance(result, Exception):
                continue
            index, summary_result = result
            ordered_results[index] = summary_result

        # Fill None with error results
        for i, r in enumerate(ordered_results):
            if r is None:
                ordered_results[i] = SummaryResult(
                    success=False,
                    summary="",
                    tags=[],
                    error="Processing failed",
                    model=self.model,
                )

        return ordered_results


def get_summarizer_client(max_concurrency: int = 1) -> SummarizerClient:
    """Get configured summarizer client instance"""
    return SummarizerClient(max_concurrency=max_concurrency)


def main():
    """CLI entry point for standalone summarization"""
    parser = argparse.ArgumentParser(
        description="テキストの要約とタグ抽出",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # テキストの要約
  python summarize_text.py "長いテキスト..."

  # ファイルから読み込んで要約
  python summarize_text.py --file document.txt

  # 要約のみ（タグ抽出なし）
  python summarize_text.py --file document.txt --summary-only

  # タグ抽出のみ
  python summarize_text.py --file document.txt --tags-only

  # 結果をJSONファイルに出力
  python summarize_text.py --file document.txt --output result.json

  # 並列処理（複数ファイル）
  python summarize_text.py --files doc1.txt doc2.txt --parallel 3
        """
    )

    parser.add_argument(
        "text",
        nargs="?",
        help="要約するテキスト"
    )
    parser.add_argument(
        "--file", "-f",
        help="テキストファイル"
    )
    parser.add_argument(
        "--files",
        nargs="+",
        help="複数のテキストファイル"
    )
    parser.add_argument(
        "--model", "-m",
        help="LLMモデル名"
    )
    parser.add_argument(
        "--summary-length", "-l",
        type=int,
        default=500,
        help="要約の最大文字数（デフォルト: 500）"
    )
    parser.add_argument(
        "--max-tags", "-t",
        type=int,
        default=5,
        help="最大タグ数（デフォルト: 5）"
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="要約のみ（タグ抽出なし）"
    )
    parser.add_argument(
        "--tags-only",
        action="store_true",
        help="タグ抽出のみ（要約なし）"
    )
    parser.add_argument(
        "--output", "-o",
        help="出力JSONファイル"
    )
    parser.add_argument(
        "--parallel", "-p",
        type=int,
        default=1,
        help="並列処理数（デフォルト: 1）"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="進捗表示を抑制"
    )

    args = parser.parse_args()

    # Get texts to process
    texts = []
    file_names = []

    if args.files:
        for f in args.files:
            file_path = Path(f)
            if not file_path.exists():
                print(f"Warning: File not found: {f}", file=sys.stderr)
                continue
            texts.append(file_path.read_text(encoding="utf-8"))
            file_names.append(f)
    elif args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        texts.append(file_path.read_text(encoding="utf-8"))
        file_names.append(args.file)
    elif args.text:
        texts.append(args.text)
        file_names.append("input")
    else:
        print("Error: Specify text, --file, or --files", file=sys.stderr)
        sys.exit(1)

    if not texts:
        print("Error: No texts to process", file=sys.stderr)
        sys.exit(1)

    # Create client
    try:
        client = SummarizerClient(
            model=args.model,
            max_concurrency=args.parallel,
        )
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    if not args.quiet:
        print(f"Processing {len(texts)} text(s)...")
        print(f"  Model: {client.model}")
        print(f"  Parallel: {args.parallel}")
        if config.proxy.enabled:
            print(f"  Proxy: {config.proxy.url}")

    # Progress callback
    def on_progress(completed, total):
        if not args.quiet:
            print(f"  Progress: {completed}/{total}", end="\r")

    # Process texts
    results = []

    for i, text in enumerate(texts):
        if not args.quiet and len(texts) > 1:
            print(f"\nProcessing {file_names[i]}...")

        if args.summary_only:
            success, summary, error = client.summarize_sync(text, args.summary_length)
            result = SummaryResult(
                success=success,
                summary=summary,
                tags=[],
                error=error,
                model=client.model,
            )
        elif args.tags_only:
            success, tags, error = client.extract_tags_sync(text, args.max_tags)
            result = SummaryResult(
                success=success,
                summary="",
                tags=tags,
                error=error,
                model=client.model,
            )
        else:
            result = client.summarize_and_extract_tags_sync(
                text,
                args.summary_length,
                args.max_tags,
            )

        results.append({
            "file": file_names[i],
            "success": result.success,
            "summary": result.summary,
            "tags": result.tags,
            "error": result.error,
            "model": result.model,
        })

    if not args.quiet:
        print()  # New line after progress

    # Output
    if args.output:
        output_path = Path(args.output)
        output_data = results if len(results) > 1 else results[0]
        output_path.write_text(
            json.dumps(output_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Output saved to: {output_path}")
    else:
        # Print results
        for r in results:
            print(f"\n{'='*50}")
            print(f"File: {r['file']}")
            print(f"Success: {r['success']}")
            if r['error']:
                print(f"Error: {r['error']}")
            if r['summary']:
                print(f"\nSummary:\n{r['summary']}")
            if r['tags']:
                print(f"\nTags: {', '.join(r['tags'])}")
            print(f"{'='*50}")


if __name__ == "__main__":
    main()
