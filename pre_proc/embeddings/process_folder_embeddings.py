"""
Folder Embeddings Processing Pipeline

指定したフォルダ内の全ファイルを処理し、
LangChainでテキスト抽出 → LLMで要約・タグ生成 → エンベディング生成 → OpenSearch投入
を行うメインスクリプト
"""

import sys
import argparse
import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tqdm import tqdm

from common.config import config
from embeddings.document_loaders import (
    load_documents_from_folder,
    get_supported_extensions_info,
    LoaderResult,
)
from embeddings.text_processor import (
    process_documents,
    truncate_text,
    ProcessedDocument,
)
from embeddings.embedding_client import EmbeddingClient, get_embedding_client
from embeddings.llm_client import LLMClient, get_llm_client
from embeddings.opensearch_client import OpenSearchClient, get_opensearch_client
from embeddings.oipf_schema import (
    create_oipf_details_document,
    create_oipf_details_document_path_only,
    truncate_richtext,
    OIPFDetailsDocument,
)


@dataclass
class ProcessingStats:
    """Processing statistics"""
    total_files: int = 0
    processed_files: int = 0
    failed_files: int = 0
    skipped_files: int = 0
    unsupported_files: int = 0  # Files with unsupported extensions (path-only indexed)
    indexed_documents: int = 0
    failed_index: int = 0
    errors: list[str] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "failed_files": self.failed_files,
            "skipped_files": self.skipped_files,
            "unsupported_files": self.unsupported_files,
            "indexed_documents": self.indexed_documents,
            "failed_index": self.failed_index,
            "error_count": len(self.errors),
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.end_time and self.start_time else 0,
        }


class FolderEmbeddingsPipeline:
    """
    Folder Embeddings Processing Pipeline

    フォルダ内のファイルを処理してOpenSearchに投入するパイプライン
    """

    def __init__(
        self,
        embedding_client: Optional[EmbeddingClient] = None,
        llm_client: Optional[LLMClient] = None,
        opensearch_client: Optional[OpenSearchClient] = None,
        index_name: str = "oipf-details",
        chunk_size: int = 1000,
        max_file_size_mb: float = 50.0,
        max_depth: int = 4,
        dry_run: bool = False,
        verbose: bool = True,
        max_concurrency: int = 1,
    ):
        """
        Initialize pipeline

        Args:
            embedding_client: Embedding API client
            llm_client: LLM API client
            opensearch_client: OpenSearch client
            index_name: Target index name
            chunk_size: Text chunk size for processing
            max_file_size_mb: Maximum file size to process
            max_depth: Maximum folder depth to traverse
            dry_run: If True, don't actually index documents
            verbose: Enable verbose output
            max_concurrency: Maximum concurrent API calls (default: 1)
        """
        self.embedding_client = embedding_client
        self.llm_client = llm_client
        self.opensearch_client = opensearch_client
        self.index_name = index_name
        self.chunk_size = chunk_size
        self.max_file_size_mb = max_file_size_mb
        self.max_depth = max_depth
        self.dry_run = dry_run
        self.verbose = verbose
        self.max_concurrency = max_concurrency
        self.stats = ProcessingStats()

    def _log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(message)

    async def _initialize_clients(self):
        """Initialize API clients if not provided"""
        if not self.embedding_client:
            self.embedding_client = get_embedding_client(max_concurrency=self.max_concurrency)
            self._log(f"Initialized embedding client (concurrency: {self.max_concurrency})")

        if not self.llm_client:
            self.llm_client = get_llm_client()
            self._log("Initialized LLM client")

        if not self.opensearch_client and not self.dry_run:
            self.opensearch_client = get_opensearch_client()
            self._log("Initialized OpenSearch client")

    async def _process_single_file(
        self,
        loader_result: LoaderResult,
        base_folder: str,
    ) -> Optional[OIPFDetailsDocument]:
        """
        Process a single file through the pipeline

        Args:
            loader_result: Document loader result
            base_folder: Base folder path

        Returns:
            OIPFDocument or None if failed
        """
        file_path = loader_result.file_path
        file_name = Path(file_path).name

        try:
            # Process documents into text
            processed = process_documents(
                documents=loader_result.documents,
                source_path=file_path,
                file_name=file_name,
                file_type=loader_result.file_type,
                chunk_size=self.chunk_size,
            )

            if not processed.full_text.strip():
                self._log(f"  Skipped (empty content): {file_name}")
                self.stats.skipped_files += 1
                return None

            # Generate summary using LLM
            summary_result = await self.llm_client.generate_summary(
                processed.full_text,
                max_length=500,
            )

            if not summary_result.success:
                self.stats.errors.append(f"{file_name}: Summary generation failed - {summary_result.error}")
                summary = truncate_text(processed.full_text, 500)
            else:
                summary = summary_result.content

            # Extract tags using LLM
            tags_result = await self.llm_client.extract_tags(processed.full_text)

            if tags_result.success:
                tags = self.llm_client.parse_tags(tags_result.content)
            else:
                tags = []

            # Generate embedding for the summary
            embedding_result = await self.embedding_client.embed_text(summary)

            if not embedding_result.success:
                self.stats.errors.append(f"{file_name}: Embedding failed - {embedding_result.error}")
                return None

            embedding = embedding_result.embeddings[0] if embedding_result.embeddings else []

            # Validate embedding dimensions
            if len(embedding) != 1024:
                self.stats.errors.append(f"{file_name}: Invalid embedding dimensions ({len(embedding)} != 1024)")
                return None

            # Create OIPF details document
            oipf_doc = create_oipf_details_document(
                file_path=file_path,
                full_text=truncate_richtext(processed.full_text),
                abstract=summary,
                embedding=embedding,
                tags=tags,
                base_folder=base_folder,
            )

            return oipf_doc

        except Exception as e:
            self.stats.errors.append(f"{file_name}: Processing error - {str(e)}")
            return None

    async def _index_document(self, doc: OIPFDetailsDocument) -> bool:
        """
        Index document to OpenSearch

        Args:
            doc: OIPF document

        Returns:
            True if successful
        """
        if self.dry_run:
            self._log(f"  [DRY RUN] Would index: {doc.id}")
            return True

        result = await self.opensearch_client.index_document(
            index_name=self.index_name,
            doc_id=doc.id,
            document=doc.to_dict(),
        )

        if not result.success:
            self.stats.errors.append(f"{doc.id}: Index failed - {result.error}")
            return False

        return True

    async def process_folder(
        self,
        folder_path: str,
        ignore_patterns: Optional[list[str]] = None,
    ) -> ProcessingStats:
        """
        Process all files in a folder

        Args:
            folder_path: Path to folder
            ignore_patterns: Patterns to ignore

        Returns:
            ProcessingStats with results
        """
        self.stats = ProcessingStats()
        self.stats.start_time = datetime.now()

        folder_path = str(Path(folder_path).resolve())

        self._log(f"\n{'='*60}")
        self._log(f"Folder Embeddings Pipeline")
        self._log(f"{'='*60}")
        self._log(f"Folder: {folder_path}")
        self._log(f"Index: {self.index_name}")
        self._log(f"Dry run: {self.dry_run}")
        self._log(f"Max depth: {self.max_depth}")
        self._log(f"{'='*60}\n")

        # Initialize clients
        await self._initialize_clients()

        # Check configuration
        config.print_status()

        errors = config.validate()
        if errors and not self.dry_run:
            for error in errors:
                self._log(f"Configuration error: {error}")
            return self.stats

        # Check if index exists
        if not self.dry_run:
            index_exists = await self.opensearch_client.index_exists(self.index_name)
            if not index_exists:
                self._log(f"Warning: Index '{self.index_name}' does not exist. Create it first using create_indices.py")
                return self.stats

        # Load documents from folder (include unsupported files)
        self._log("Loading documents from folder...")

        def on_load_progress(file_path: str, current: int, total: int):
            pass  # Progress handled by tqdm

        successful_loads, failed_loads = load_documents_from_folder(
            folder_path=Path(folder_path),
            recursive=True,
            max_depth=self.max_depth,
            max_file_size_mb=self.max_file_size_mb,
            ignore_patterns=ignore_patterns,
            include_unsupported=True,  # Include unsupported files for path-only indexing
        )

        # Separate unsupported files from truly failed loads
        unsupported_files = [f for f in failed_loads if f.unsupported]
        truly_failed = [f for f in failed_loads if not f.unsupported]

        self.stats.total_files = len(successful_loads) + len(failed_loads)
        self.stats.failed_files = len(truly_failed)

        self._log(f"Found {len(successful_loads)} supported files to process")
        self._log(f"Found {len(unsupported_files)} unsupported files (path-only indexing)")
        self._log(f"Failed to load: {len(truly_failed)} files")

        # Log truly failed loads
        for failed in truly_failed:
            self.stats.errors.append(f"{failed.file_path}: {failed.error}")

        if not successful_loads and not unsupported_files:
            self._log("No files to process.")
            self.stats.end_time = datetime.now()
            return self.stats

        # Process supported files
        if successful_loads:
            self._log("\nProcessing supported files...")

            for loader_result in tqdm(successful_loads, desc="Processing"):
                file_name = Path(loader_result.file_path).name

                # Process file
                oipf_doc = await self._process_single_file(loader_result, folder_path)

                if oipf_doc is None:
                    self.stats.failed_files += 1
                    continue

                self.stats.processed_files += 1

                # Index document
                if await self._index_document(oipf_doc):
                    self.stats.indexed_documents += 1
                else:
                    self.stats.failed_index += 1

        # Process unsupported files (path-only)
        if unsupported_files:
            self._log("\nIndexing unsupported files (path-only)...")

            for loader_result in tqdm(unsupported_files, desc="Indexing path-only"):
                file_name = Path(loader_result.file_path).name

                # Create path-only document
                oipf_doc = create_oipf_details_document_path_only(
                    file_path=loader_result.file_path,
                    base_folder=folder_path,
                )

                self.stats.unsupported_files += 1

                # Index document
                if await self._index_document(oipf_doc):
                    self.stats.indexed_documents += 1
                else:
                    self.stats.failed_index += 1

        self.stats.end_time = datetime.now()

        # Print summary
        self._log(f"\n{'='*60}")
        self._log("Processing Complete")
        self._log(f"{'='*60}")
        self._log(f"Total files: {self.stats.total_files}")
        self._log(f"Processed (content extracted): {self.stats.processed_files}")
        self._log(f"Unsupported (path-only): {self.stats.unsupported_files}")
        self._log(f"Skipped: {self.stats.skipped_files}")
        self._log(f"Failed: {self.stats.failed_files}")
        self._log(f"Indexed: {self.stats.indexed_documents}")
        self._log(f"Index failed: {self.stats.failed_index}")
        self._log(f"Duration: {(self.stats.end_time - self.stats.start_time).total_seconds():.2f}s")

        if self.stats.errors:
            self._log(f"\nErrors ({len(self.stats.errors)}):")
            for error in self.stats.errors[:10]:
                self._log(f"  - {error}")
            if len(self.stats.errors) > 10:
                self._log(f"  ... and {len(self.stats.errors) - 10} more")

        self._log(f"{'='*60}\n")

        return self.stats

    def process_folder_sync(
        self,
        folder_path: str,
        ignore_patterns: Optional[list[str]] = None,
    ) -> ProcessingStats:
        """Synchronous version of process_folder"""
        return asyncio.run(self.process_folder(folder_path, ignore_patterns))


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="フォルダ内のファイルを処理してOpenSearchに投入",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 基本的な使用方法
  python process_folder_embeddings.py /path/to/folder

  # ドライラン（実際に投入しない）
  python process_folder_embeddings.py /path/to/folder --dry-run

  # 特定のインデックスに投入
  python process_folder_embeddings.py /path/to/folder --index my-index

  # 処理結果をJSONで出力
  python process_folder_embeddings.py /path/to/folder --output-json result.json

  # 深度制限と無視パターン
  python process_folder_embeddings.py /path/to/folder --depth 3 --ignore "*.tmp" --ignore "backup"

  # 並列処理（5並列）
  python process_folder_embeddings.py /path/to/folder --parallel 5
        """
    )

    parser.add_argument(
        "folder",
        help="処理対象フォルダのパス"
    )
    parser.add_argument(
        "--index",
        default="oipf-details",
        help="OpenSearchインデックス名（デフォルト: oipf-details）"
    )
    parser.add_argument(
        "--depth",
        type=int,
        default=4,
        help="最大探索深度（デフォルト: 4）"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="テキストチャンクサイズ（デフォルト: 1000）"
    )
    parser.add_argument(
        "--max-file-size",
        type=float,
        default=50.0,
        help="最大ファイルサイズ（MB）（デフォルト: 50）"
    )
    parser.add_argument(
        "--ignore",
        action="append",
        default=[],
        help="無視するパターン（複数指定可）"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ドライラン（実際に投入しない）"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="進捗表示を抑制"
    )
    parser.add_argument(
        "--output-json",
        help="結果をJSONファイルに出力"
    )
    parser.add_argument(
        "--supported-formats",
        action="store_true",
        help="対応ファイル形式を表示して終了"
    )
    parser.add_argument(
        "--parallel", "-p",
        type=int,
        default=1,
        help="並列処理数（デフォルト: 1）"
    )

    args = parser.parse_args()

    # Show supported formats
    if args.supported_formats:
        print("Supported file formats:")
        for ext, loader in get_supported_extensions_info().items():
            print(f"  {ext}: {loader}")
        sys.exit(0)

    # Default ignore patterns
    ignore_patterns = [
        ".git",
        ".venv",
        "venv",
        "__pycache__",
        "node_modules",
        ".DS_Store",
    ] + args.ignore

    # Create pipeline
    pipeline = FolderEmbeddingsPipeline(
        index_name=args.index,
        chunk_size=args.chunk_size,
        max_file_size_mb=args.max_file_size,
        max_depth=args.depth,
        dry_run=args.dry_run,
        verbose=not args.quiet,
        max_concurrency=args.parallel,
    )

    # Run pipeline
    try:
        stats = pipeline.process_folder_sync(
            folder_path=args.folder,
            ignore_patterns=ignore_patterns,
        )

        # Output JSON if requested
        if args.output_json:
            output_path = Path(args.output_json)
            output_path.write_text(
                json.dumps(stats.to_dict(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            print(f"Results saved to: {output_path}")

        # Exit code based on success
        if stats.failed_files > 0 or stats.failed_index > 0:
            sys.exit(1)
        sys.exit(0)

    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
