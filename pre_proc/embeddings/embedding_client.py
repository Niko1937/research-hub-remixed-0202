"""
Embedding Client Module

エンベディングAPIクライアント
OpenAI互換のエンベディングAPIに対応
プロキシ環境にも対応
並列処理対応
"""

import sys
import asyncio
import argparse
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from common.config import config, EmbeddingConfig


@dataclass
class EmbeddingResult:
    """Embedding result"""
    success: bool
    embeddings: list[list[float]]
    error: Optional[str] = None
    model: str = ""
    usage: Optional[dict] = None


class EmbeddingClient:
    """
    Embedding API Client

    OpenAI互換のエンベディングAPIクライアント
    プロキシ環境にも対応
    並列処理対応
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
        encoding_format: str = "float",
        timeout: int = 60,
        embedding_config: Optional[EmbeddingConfig] = None,
        max_concurrency: int = 1,
    ):
        """
        Initialize embedding client

        Args:
            api_url: Embedding API URL (default: from env)
            api_key: API key (default: from env)
            model: Model name (default: from env)
            dimensions: Embedding dimensions (default: from env)
            encoding_format: Encoding format (default: float)
            timeout: Request timeout in seconds
            embedding_config: Embedding configuration including proxy (default: from env)
            max_concurrency: Maximum concurrent requests (default: 1)
        """
        self._config = embedding_config or config.embedding
        self.api_url = (api_url or self._config.api_url).rstrip("/")
        self.api_key = api_key or self._config.api_key
        self.model = model or self._config.model
        self.dimensions = dimensions or self._config.dimensions
        self.encoding_format = encoding_format
        self.timeout = timeout
        self.max_concurrency = max_concurrency
        self._semaphore: Optional[asyncio.Semaphore] = None

        if not self.api_url:
            raise ValueError("EMBEDDING_API_URL is not configured")
        if not self.api_key:
            raise ValueError("EMBEDDING_API_KEY is not configured")

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
            "Accept": "application/json",
        }

    def _get_client_kwargs(self) -> dict:
        """Get httpx client kwargs including proxy if configured"""
        kwargs = {"timeout": self.timeout}
        proxy_kwargs = self._config.get_httpx_kwargs()
        kwargs.update(proxy_kwargs)
        return kwargs

    def _get_endpoint(self) -> str:
        """Get embedding API endpoint"""
        # Support various API formats
        if "/embeddings" in self.api_url:
            return self.api_url
        return f"{self.api_url}/embeddings"

    async def embed_text(
        self,
        text: str,
        model: Optional[str] = None,
    ) -> EmbeddingResult:
        """
        Generate embedding for a single text

        Args:
            text: Text to embed
            model: Model name (optional)

        Returns:
            EmbeddingResult with embedding or error
        """
        payload = {
            "input": text,
            "model": model or self.model,
            "encoding_format": self.encoding_format,
        }

        # Add dimensions parameter
        if self.dimensions:
            payload["dimensions"] = self.dimensions

        try:
            async with self._get_semaphore():
                async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                    response = await client.post(
                        self._get_endpoint(),
                        headers=self._get_headers(),
                        json=payload,
                    )

                    if response.status_code != 200:
                        return EmbeddingResult(
                            success=False,
                            embeddings=[],
                            error=f"API error: {response.status_code} - {response.text}",
                            model=model or self.model,
                        )

                    data = response.json()

                    # Extract embeddings from response
                    embeddings = []
                    for item in data.get("data", []):
                        embedding = item.get("embedding", [])
                        embeddings.append(embedding)

                    return EmbeddingResult(
                        success=True,
                        embeddings=embeddings,
                        model=data.get("model", model or self.model),
                        usage=data.get("usage"),
                    )

        except httpx.ConnectError as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Connection error: {e}. Check EMBEDDING_API_URL and network/proxy settings.",
                model=model or self.model,
            )
        except httpx.TimeoutException as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Timeout error: {e}",
                model=model or self.model,
            )
        except Exception as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Embedding error: {str(e)}",
                model=model or self.model,
            )

    def embed_text_sync(
        self,
        text: str,
        model: Optional[str] = None,
    ) -> EmbeddingResult:
        """Synchronous version of embed_text"""
        return asyncio.run(self.embed_text(text, model))

    async def embed_texts(
        self,
        texts: list[str],
        model: Optional[str] = None,
    ) -> EmbeddingResult:
        """
        Generate embeddings for multiple texts (batch in single request)

        Args:
            texts: List of texts to embed
            model: Model name (optional)

        Returns:
            EmbeddingResult with embeddings or error
        """
        if not texts:
            return EmbeddingResult(
                success=True,
                embeddings=[],
                model=model or self.model,
            )

        payload = {
            "input": texts,
            "model": model or self.model,
            "encoding_format": self.encoding_format,
        }

        if self.dimensions:
            payload["dimensions"] = self.dimensions

        try:
            async with self._get_semaphore():
                async with httpx.AsyncClient(**self._get_client_kwargs()) as client:
                    response = await client.post(
                        self._get_endpoint(),
                        headers=self._get_headers(),
                        json=payload,
                    )

                    if response.status_code != 200:
                        return EmbeddingResult(
                            success=False,
                            embeddings=[],
                            error=f"API error: {response.status_code} - {response.text}",
                            model=model or self.model,
                        )

                    data = response.json()

                    embeddings = []
                    for item in data.get("data", []):
                        embedding = item.get("embedding", [])
                        embeddings.append(embedding)

                    return EmbeddingResult(
                        success=True,
                        embeddings=embeddings,
                        model=data.get("model", model or self.model),
                        usage=data.get("usage"),
                    )

        except httpx.ConnectError as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Connection error: {e}",
                model=model or self.model,
            )
        except httpx.TimeoutException as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Timeout error: {e}",
                model=model or self.model,
            )
        except Exception as e:
            return EmbeddingResult(
                success=False,
                embeddings=[],
                error=f"Embedding error: {str(e)}",
                model=model or self.model,
            )

    def embed_texts_sync(
        self,
        texts: list[str],
        model: Optional[str] = None,
    ) -> EmbeddingResult:
        """Synchronous version of embed_texts"""
        return asyncio.run(self.embed_texts(texts, model))

    async def embed_texts_parallel(
        self,
        texts: list[str],
        model: Optional[str] = None,
        on_progress: Optional[callable] = None,
    ) -> EmbeddingResult:
        """
        Generate embeddings for texts in parallel

        Args:
            texts: List of texts to embed
            model: Model name (optional)
            on_progress: Progress callback (completed, total)

        Returns:
            EmbeddingResult with all embeddings or error
        """
        if not texts:
            return EmbeddingResult(
                success=True,
                embeddings=[],
                model=model or self.model,
            )

        # Create tasks for parallel execution
        async def embed_with_index(index: int, text: str):
            result = await self.embed_text(text, model)
            if on_progress:
                on_progress(index + 1, len(texts))
            return index, result

        # Execute in parallel with semaphore controlling concurrency
        tasks = [embed_with_index(i, text) for i, text in enumerate(texts)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect results in order
        all_embeddings = [None] * len(texts)
        errors = []

        for result in results:
            if isinstance(result, Exception):
                errors.append(str(result))
                continue

            index, embed_result = result
            if embed_result.success and embed_result.embeddings:
                all_embeddings[index] = embed_result.embeddings[0]
            else:
                errors.append(f"Text {index}: {embed_result.error}")

        # Check for failures
        if None in all_embeddings:
            failed_indices = [i for i, e in enumerate(all_embeddings) if e is None]
            return EmbeddingResult(
                success=False,
                embeddings=[e for e in all_embeddings if e is not None],
                error=f"Failed to embed {len(failed_indices)} texts: {'; '.join(errors[:3])}",
                model=model or self.model,
            )

        return EmbeddingResult(
            success=True,
            embeddings=all_embeddings,
            model=model or self.model,
        )

    def embed_texts_parallel_sync(
        self,
        texts: list[str],
        model: Optional[str] = None,
        on_progress: Optional[callable] = None,
    ) -> EmbeddingResult:
        """Synchronous version of embed_texts_parallel"""
        return asyncio.run(self.embed_texts_parallel(texts, model, on_progress))

    async def embed_texts_batch(
        self,
        texts: list[str],
        batch_size: int = 10,
        model: Optional[str] = None,
        on_progress: Optional[callable] = None,
    ) -> EmbeddingResult:
        """
        Generate embeddings for texts in batches (sequential batches)

        Args:
            texts: List of texts to embed
            batch_size: Number of texts per batch
            model: Model name (optional)
            on_progress: Progress callback (current_batch, total_batches)

        Returns:
            EmbeddingResult with all embeddings or error
        """
        if not texts:
            return EmbeddingResult(
                success=True,
                embeddings=[],
                model=model or self.model,
            )

        all_embeddings = []
        total_batches = (len(texts) + batch_size - 1) // batch_size

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_num = i // batch_size + 1

            if on_progress:
                on_progress(batch_num, total_batches)

            result = await self.embed_texts(batch, model)

            if not result.success:
                return EmbeddingResult(
                    success=False,
                    embeddings=all_embeddings,
                    error=f"Batch {batch_num}/{total_batches} failed: {result.error}",
                    model=model or self.model,
                )

            all_embeddings.extend(result.embeddings)

        return EmbeddingResult(
            success=True,
            embeddings=all_embeddings,
            model=model or self.model,
        )


def get_embedding_client(max_concurrency: int = 1) -> EmbeddingClient:
    """Get configured embedding client instance"""
    return EmbeddingClient(max_concurrency=max_concurrency)


def main():
    """CLI entry point for standalone embedding"""
    parser = argparse.ArgumentParser(
        description="テキストのエンベディングを生成",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 単一テキストのエンベディング
  python embedding_client.py "This is a test"

  # ファイルからテキストを読み込んでエンベディング
  python embedding_client.py --file input.txt

  # モデルを指定
  python embedding_client.py "テスト" --model bedrock.amazon.titan-embed-image-v1

  # 結果をJSONファイルに出力
  python embedding_client.py "テスト" --output embedding.json

  # 並列処理（複数テキスト）
  python embedding_client.py --file texts.txt --parallel 5
        """
    )

    parser.add_argument(
        "text",
        nargs="?",
        help="エンベディングするテキスト"
    )
    parser.add_argument(
        "--file", "-f",
        help="テキストファイル（1行1テキスト）"
    )
    parser.add_argument(
        "--model", "-m",
        help="エンベディングモデル名"
    )
    parser.add_argument(
        "--dimensions", "-d",
        type=int,
        default=1024,
        help="エンベディング次元数（デフォルト: 1024）"
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

    # Get texts to embed
    texts = []
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        texts = [line.strip() for line in file_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    elif args.text:
        texts = [args.text]
    else:
        print("Error: Specify text or --file", file=sys.stderr)
        sys.exit(1)

    if not texts:
        print("Error: No texts to embed", file=sys.stderr)
        sys.exit(1)

    # Create client
    try:
        client = EmbeddingClient(
            model=args.model,
            dimensions=args.dimensions,
            max_concurrency=args.parallel,
        )
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    if not args.quiet:
        print(f"Embedding {len(texts)} text(s)...")
        print(f"  Model: {client.model}")
        print(f"  Dimensions: {client.dimensions}")
        print(f"  Parallel: {args.parallel}")
        if config.embedding.proxy_enabled:
            print(f"  Proxy: {config.embedding.proxy_url}")

    # Progress callback
    def on_progress(completed, total):
        if not args.quiet:
            print(f"  Progress: {completed}/{total}", end="\r")

    # Generate embeddings
    if len(texts) == 1:
        result = client.embed_text_sync(texts[0])
    elif args.parallel > 1:
        result = client.embed_texts_parallel_sync(texts, on_progress=on_progress)
    else:
        result = client.embed_texts_sync(texts)

    if not args.quiet:
        print()  # New line after progress

    if not result.success:
        print(f"Error: {result.error}", file=sys.stderr)
        sys.exit(1)

    # Output
    output_data = {
        "model": result.model,
        "dimensions": len(result.embeddings[0]) if result.embeddings else 0,
        "count": len(result.embeddings),
        "embeddings": result.embeddings,
    }

    if args.output:
        output_path = Path(args.output)
        output_path.write_text(
            json.dumps(output_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Output saved to: {output_path}")
    else:
        # Print summary
        print(f"\nSuccess!")
        print(f"  Model: {result.model}")
        print(f"  Embeddings: {len(result.embeddings)}")
        if result.embeddings:
            print(f"  Dimensions: {len(result.embeddings[0])}")
            print(f"  First embedding (truncated): [{result.embeddings[0][0]:.6f}, {result.embeddings[0][1]:.6f}, ...]")


if __name__ == "__main__":
    main()
