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
    processed_images: int = 0  # Image files processed via Vision LLM
    failed_files: int = 0
    skipped_files: int = 0
    unsupported_files: int = 0  # Files with unsupported extensions (path-only indexed)
    too_large_files: int = 0  # Files exceeding max size limit (skipped)
    skipped_folders: int = 0  # Folders skipped because already indexed
    skipped_folder_files: int = 0  # Files in skipped folders
    indexed_documents: int = 0
    updated_documents: int = 0  # Documents updated (already existed in index)
    failed_index: int = 0
    errors: list[str] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "processed_images": self.processed_images,
            "failed_files": self.failed_files,
            "skipped_files": self.skipped_files,
            "unsupported_files": self.unsupported_files,
            "too_large_files": self.too_large_files,
            "skipped_folders": self.skipped_folders,
            "skipped_folder_files": self.skipped_folder_files,
            "indexed_documents": self.indexed_documents,
            "updated_documents": self.updated_documents,
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
        max_file_size_mb: Optional[float] = None,
        max_depth: Optional[int] = None,
        skip_indexed_folders: Optional[bool] = None,
        embedding_file_types: Optional[str] = None,
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
            max_file_size_mb: Maximum file size to process (default: from env MAX_FILE_SIZE_MB or 100MB)
            max_depth: Maximum folder depth to traverse (default: from env MAX_FOLDER_DEPTH or 4)
            skip_indexed_folders: Skip subfolders that already have indexed files (default: from env SKIP_INDEXED_FOLDERS)
            embedding_file_types: File types to embed: "all", "documents", "images" (default: from env EMBEDDING_FILE_TYPES)
            dry_run: If True, don't actually index documents
            verbose: Enable verbose output
            max_concurrency: Maximum concurrent API calls (default: 1)
        """
        self.embedding_client = embedding_client
        self.llm_client = llm_client
        self.opensearch_client = opensearch_client
        self.index_name = index_name
        self.chunk_size = chunk_size
        self.max_file_size_mb = max_file_size_mb if max_file_size_mb is not None else config.processing.max_file_size_mb
        self.max_depth = max_depth if max_depth is not None else config.processing.max_depth
        self.skip_indexed_folders = skip_indexed_folders if skip_indexed_folders is not None else config.processing.skip_indexed_folders
        self.embedding_file_types = embedding_file_types if embedding_file_types is not None else config.processing.embedding_file_types
        self.dry_run = dry_run
        self.verbose = verbose
        self.max_concurrency = max_concurrency
        self.stats = ProcessingStats()

    @property
    def process_documents(self) -> bool:
        """Check if documents should be processed"""
        return self.embedding_file_types in ("all", "documents")

    @property
    def process_images(self) -> bool:
        """Check if images should be processed"""
        return self.embedding_file_types in ("all", "images")

    def _log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(message)

    def _extract_research_id(self, file_path: str, base_folder: str) -> str:
        """
        Extract research ID from immediate subfolder name.

        Takes the first 4 ASCII alphanumeric characters (a-z, A-Z, 0-9) from
        the immediate subfolder (1 level down from base_folder).

        Args:
            file_path: Full file path
            base_folder: Base folder path

        Returns:
            First 4 ASCII alphanumeric characters of immediate subfolder name, or empty string
        """
        try:
            rel_path = Path(file_path).relative_to(base_folder)
            parts = rel_path.parts

            if len(parts) >= 2:
                # Get immediate subfolder name (first component of relative path)
                subfolder_name = parts[0]
                # Extract first 4 ASCII alphanumeric characters only (a-z, A-Z, 0-9)
                alphanumeric = "".join(c for c in subfolder_name if c.isascii() and c.isalnum())
                return alphanumeric[:4]
            else:
                # File is directly in base_folder (no subfolder)
                return ""
        except ValueError:
            return ""

    async def _get_skipped_subfolders(
        self,
        folder_path: str,
        all_files: list,
    ) -> set[str]:
        """
        Get set of subfolder paths that should be skipped because they already have indexed files.

        Args:
            folder_path: Base folder path
            all_files: List of all files (LoaderResult objects)

        Returns:
            Set of relative subfolder paths to skip
        """
        if not self.skip_indexed_folders:
            return set()

        if self.dry_run:
            self._log("  [DRY RUN] Skip indexed folders check disabled")
            return set()

        # Get unique immediate subfolders (1 level down)
        base_path = Path(folder_path)
        subfolders = set()

        for file_result in all_files:
            file_path = Path(file_result.file_path)
            try:
                rel_path = file_path.relative_to(base_path)
                # Get the first component (immediate subfolder)
                if len(rel_path.parts) > 1:
                    subfolders.add(rel_path.parts[0])
            except ValueError:
                continue

        if not subfolders:
            return set()

        self._log(f"\nChecking {len(subfolders)} subfolders for existing indexed files...")

        skipped = set()
        for subfolder in sorted(subfolders):
            # Check if any files from this subfolder exist in the index
            has_indexed = await self.opensearch_client.folder_has_indexed_files(
                index_name=self.index_name,
                folder_path=subfolder,
            )

            if has_indexed:
                self._log(f"  Skipping (already indexed): {subfolder}/")
                skipped.add(subfolder)

        return skipped

    def _filter_files_by_skipped_folders(
        self,
        files: list,
        folder_path: str,
        skipped_folders: set[str],
    ) -> tuple[list, int]:
        """
        Filter out files that belong to skipped folders.

        Args:
            files: List of LoaderResult objects
            folder_path: Base folder path
            skipped_folders: Set of relative subfolder names to skip

        Returns:
            Tuple of (filtered files list, count of skipped files)
        """
        if not skipped_folders:
            return files, 0

        base_path = Path(folder_path)
        filtered = []
        skipped_count = 0

        for file_result in files:
            file_path = Path(file_result.file_path)
            try:
                rel_path = file_path.relative_to(base_path)
                # Check if file is in a skipped subfolder
                if len(rel_path.parts) > 1 and rel_path.parts[0] in skipped_folders:
                    skipped_count += 1
                    continue
            except ValueError:
                pass

            filtered.append(file_result)

        return filtered, skipped_count

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
        research_id: str = "",
    ) -> Optional[OIPFDetailsDocument]:
        """
        Process a single file through the pipeline

        Args:
            loader_result: Document loader result
            base_folder: Base folder path
            research_id: Research ID for grouping files

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

            # Extract author/editor metadata
            authors = loader_result.metadata.authors if loader_result.metadata else []
            editors = loader_result.metadata.editors if loader_result.metadata else []

            # Create OIPF details document
            oipf_doc = create_oipf_details_document(
                file_path=file_path,
                full_text=truncate_richtext(processed.full_text),
                abstract=summary,
                embedding=embedding,
                tags=tags,
                base_folder=base_folder,
                authors=authors,
                editors=editors,
                research_id=research_id,
            )

            return oipf_doc

        except Exception as e:
            self.stats.errors.append(f"{file_name}: Processing error - {str(e)}")
            return None

    async def _process_image_file(
        self,
        loader_result: LoaderResult,
        base_folder: str,
        research_id: str = "",
    ) -> Optional[OIPFDetailsDocument]:
        """
        Process an image file through Vision LLM pipeline

        Args:
            loader_result: Document loader result (with is_image=True)
            base_folder: Base folder path
            research_id: Research ID for grouping files

        Returns:
            OIPFDocument or None if failed
        """
        file_path = loader_result.file_path
        file_name = Path(file_path).name

        try:
            # Analyze image using Vision LLM
            self._log(f"  Analyzing image: {file_name}")
            description_result = await self.llm_client.analyze_image(
                file_path,
                max_length=500,
            )

            if not description_result.success:
                self.stats.errors.append(f"{file_name}: Image analysis failed - {description_result.error}")
                return None

            description = description_result.content

            # Extract tags using Vision LLM
            tags_result = await self.llm_client.extract_tags_from_image(file_path)

            if tags_result.success:
                tags = self.llm_client.parse_tags(tags_result.content)
            else:
                tags = []

            # Generate embedding for the description
            embedding_result = await self.embedding_client.embed_text(description)

            if not embedding_result.success:
                self.stats.errors.append(f"{file_name}: Embedding failed - {embedding_result.error}")
                return None

            embedding = embedding_result.embeddings[0] if embedding_result.embeddings else []

            # Validate embedding dimensions
            if len(embedding) != 1024:
                self.stats.errors.append(f"{file_name}: Invalid embedding dimensions ({len(embedding)} != 1024)")
                return None

            # Extract author/editor metadata
            authors = loader_result.metadata.authors if loader_result.metadata else []
            editors = loader_result.metadata.editors if loader_result.metadata else []

            # Create OIPF details document
            oipf_doc = create_oipf_details_document(
                file_path=file_path,
                full_text=f"[Image: {file_name}]\n\n{description}",  # Store description as richtext
                abstract=description,
                embedding=embedding,
                tags=tags,
                base_folder=base_folder,
                authors=authors,
                editors=editors,
                research_id=research_id,
            )

            return oipf_doc

        except Exception as e:
            self.stats.errors.append(f"{file_name}: Image processing error - {str(e)}")
            return None

    async def _index_document(self, doc: OIPFDetailsDocument) -> tuple[bool, bool]:
        """
        Index document to OpenSearch

        If a document with the same oipf_file_path and oipf_file_name exists,
        update it using the existing document ID.

        Args:
            doc: OIPF document

        Returns:
            Tuple of (success, is_update)
        """
        if self.dry_run:
            self._log(f"  [DRY RUN] Would index: {doc.id}")
            return True, False

        # Check if document with same file path and name already exists
        existing_id = await self.opensearch_client.find_document_by_file_path(
            index_name=self.index_name,
            file_path=doc.oipf_file_path,
            file_name=doc.oipf_file_name,
        )

        # Use existing ID if found, otherwise use generated ID
        doc_id = existing_id if existing_id else doc.id
        is_update = existing_id is not None

        if is_update:
            self._log(f"  Updating existing document: {doc.oipf_file_name} (ID: {doc_id})")

        result = await self.opensearch_client.index_document(
            index_name=self.index_name,
            doc_id=doc_id,
            document=doc.to_dict(),
        )

        if not result.success:
            self.stats.errors.append(f"{doc_id}: Index failed - {result.error}")
            return False, is_update

        return True, is_update

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
        self._log(f"Skip indexed folders: {self.skip_indexed_folders}")
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

        # Separate unsupported files and too large files from truly failed loads
        unsupported_files = [f for f in failed_loads if f.unsupported]
        too_large_files = [f for f in failed_loads if f.too_large]
        truly_failed = [f for f in failed_loads if not f.unsupported and not f.too_large]

        self.stats.total_files = len(successful_loads) + len(failed_loads)
        self.stats.failed_files = len(truly_failed)
        self.stats.too_large_files = len(too_large_files)

        # Check for subfolders that should be skipped (already indexed)
        all_files = successful_loads + unsupported_files
        skipped_folders = await self._get_skipped_subfolders(folder_path, all_files)

        if skipped_folders:
            self.stats.skipped_folders = len(skipped_folders)

            # Filter out files from skipped folders
            successful_loads, skipped_supported = self._filter_files_by_skipped_folders(
                successful_loads, folder_path, skipped_folders
            )
            unsupported_files, skipped_unsupported = self._filter_files_by_skipped_folders(
                unsupported_files, folder_path, skipped_folders
            )

            self.stats.skipped_folder_files = skipped_supported + skipped_unsupported
            self._log(f"\nSkipped {self.stats.skipped_folders} already-indexed subfolders ({self.stats.skipped_folder_files} files)")

        # Count image files vs document files
        image_count = sum(1 for f in successful_loads if f.is_image)
        document_count = len(successful_loads) - image_count

        self._log(f"Found {len(successful_loads)} supported files to process")
        self._log(f"  - Documents: {document_count}")
        self._log(f"  - Images: {image_count}")
        self._log(f"Found {len(unsupported_files)} unsupported files (path-only indexing)")
        self._log(f"Skipped {len(too_large_files)} files exceeding size limit ({self.max_file_size_mb}MB)")
        self._log(f"Failed to load: {len(truly_failed)} files")

        # Log truly failed loads
        for failed in truly_failed:
            self.stats.errors.append(f"{failed.file_path}: {failed.error}")

        # Log too large files (info only, not as errors)
        for large_file in too_large_files:
            self._log(f"  Skipped (too large): {large_file.file_path}")

        if not successful_loads and not unsupported_files:
            self._log("No files to process.")
            self.stats.end_time = datetime.now()
            return self.stats

        # Separate image files from document files
        image_files = [f for f in successful_loads if f.is_image]
        document_files = [f for f in successful_loads if not f.is_image]

        # Filter based on embedding_file_types setting
        skipped_by_type = 0
        if not self.process_documents:
            skipped_by_type += len(document_files)
            document_files = []
            self._log(f"\nSkipping document files (EMBEDDING_FILE_TYPES={self.embedding_file_types})")

        if not self.process_images:
            skipped_by_type += len(image_files)
            image_files = []
            self._log(f"\nSkipping image files (EMBEDDING_FILE_TYPES={self.embedding_file_types})")

        if skipped_by_type > 0:
            self._log(f"Skipped {skipped_by_type} files due to EMBEDDING_FILE_TYPES setting")

        # Process document files
        if document_files:
            self._log(f"\nProcessing {len(document_files)} document files...")

            for loader_result in tqdm(document_files, desc="Processing documents"):
                file_name = Path(loader_result.file_path).name

                # Extract research_id from immediate subfolder name (first 4 alphanumeric chars)
                research_id = self._extract_research_id(loader_result.file_path, folder_path)

                # Process file
                oipf_doc = await self._process_single_file(loader_result, folder_path, research_id)

                if oipf_doc is None:
                    self.stats.failed_files += 1
                    continue

                self.stats.processed_files += 1

                # Index document
                success, is_update = await self._index_document(oipf_doc)
                if success:
                    self.stats.indexed_documents += 1
                    if is_update:
                        self.stats.updated_documents += 1
                else:
                    self.stats.failed_index += 1

        # Process image files using Vision LLM
        if image_files:
            self._log(f"\nProcessing {len(image_files)} image files (Vision LLM)...")

            for loader_result in tqdm(image_files, desc="Processing images"):
                file_name = Path(loader_result.file_path).name

                # Extract research_id from immediate subfolder name (first 4 alphanumeric chars)
                research_id = self._extract_research_id(loader_result.file_path, folder_path)

                # Process image
                oipf_doc = await self._process_image_file(loader_result, folder_path, research_id)

                if oipf_doc is None:
                    self.stats.failed_files += 1
                    continue

                self.stats.processed_files += 1
                self.stats.processed_images += 1

                # Index document
                success, is_update = await self._index_document(oipf_doc)
                if success:
                    self.stats.indexed_documents += 1
                    if is_update:
                        self.stats.updated_documents += 1
                else:
                    self.stats.failed_index += 1

        # Process unsupported files (path-only)
        if unsupported_files:
            self._log("\nIndexing unsupported files (path-only)...")

            for loader_result in tqdm(unsupported_files, desc="Indexing path-only"):
                file_name = Path(loader_result.file_path).name

                # Extract research_id from immediate subfolder name (first 4 alphanumeric chars)
                research_id = self._extract_research_id(loader_result.file_path, folder_path)

                # Extract author/editor metadata
                authors = loader_result.metadata.authors if loader_result.metadata else []
                editors = loader_result.metadata.editors if loader_result.metadata else []

                # Create path-only document
                oipf_doc = create_oipf_details_document_path_only(
                    file_path=loader_result.file_path,
                    base_folder=folder_path,
                    authors=authors,
                    editors=editors,
                    research_id=research_id,
                )

                self.stats.unsupported_files += 1

                # Index document
                success, is_update = await self._index_document(oipf_doc)
                if success:
                    self.stats.indexed_documents += 1
                    if is_update:
                        self.stats.updated_documents += 1
                else:
                    self.stats.failed_index += 1

        self.stats.end_time = datetime.now()

        # Print summary
        self._log(f"\n{'='*60}")
        self._log("Processing Complete")
        self._log(f"{'='*60}")
        self._log(f"Total files: {self.stats.total_files}")
        self._log(f"Processed (content extracted): {self.stats.processed_files}")
        if self.stats.processed_images > 0:
            self._log(f"  - Images (Vision LLM): {self.stats.processed_images}")
        self._log(f"Unsupported (path-only): {self.stats.unsupported_files}")
        self._log(f"Too large (skipped): {self.stats.too_large_files}")
        self._log(f"Skipped (empty): {self.stats.skipped_files}")
        if self.stats.skipped_folders > 0:
            self._log(f"Skipped folders (already indexed): {self.stats.skipped_folders} ({self.stats.skipped_folder_files} files)")
        self._log(f"Failed: {self.stats.failed_files}")
        self._log(f"Indexed: {self.stats.indexed_documents} (updated: {self.stats.updated_documents})")
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
        default=None,
        help=f"最大探索深度（デフォルト: 環境変数 MAX_FOLDER_DEPTH または {config.processing.max_depth}、0で無制限）"
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
        default=None,
        help=f"最大ファイルサイズ（MB）（デフォルト: 環境変数 MAX_FILE_SIZE_MB または {config.processing.max_file_size_mb}）"
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
    parser.add_argument(
        "--skip-indexed-folders",
        action="store_true",
        default=None,
        help=f"既にインデックスされたサブフォルダをスキップ（デフォルト: 環境変数 SKIP_INDEXED_FOLDERS または {config.processing.skip_indexed_folders}）"
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

    # Create pipeline (use args if specified, otherwise fall back to config/defaults)
    pipeline = FolderEmbeddingsPipeline(
        index_name=args.index,
        chunk_size=args.chunk_size,
        max_file_size_mb=args.max_file_size,  # None uses config default
        max_depth=args.depth,  # None uses config default
        skip_indexed_folders=args.skip_indexed_folders,  # None uses config default
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
