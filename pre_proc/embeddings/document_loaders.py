"""
Document Loaders Module

LangChainのドキュメントローダーを統合し、
各種ファイル形式からテキストを抽出する
"""

import os
import sys
import logging
import warnings
from pathlib import Path
from typing import Optional, Callable
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress noisy warnings from PDF parsing libraries
# "No features in text." and "Advanced encoding /90ms-RKSJ-H not implemented yet"
logging.getLogger("pdfminer").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*Advanced encoding.*not implemented.*")
warnings.filterwarnings("ignore", message=".*No features in text.*")

import chardet

# LangChain document loaders (Excel/CSV handled by table_loader.py)
from langchain_community.document_loaders import (
    TextLoader,
    PyPDFLoader,
    Docx2txtLoader,
    UnstructuredPowerPointLoader,
    UnstructuredMarkdownLoader,
    UnstructuredHTMLLoader,
    JSONLoader,
)
from langchain_core.documents import Document

# Import table loader for Excel/CSV handling
from embeddings.table_loader import (
    load_table_file,
    is_table_file,
    TableLoaderResult,
    combine_table_documents,
)


# Table file extensions (processed via pandas, not LangChain loaders)
TABLE_EXTENSIONS = {".xlsx", ".xls", ".csv"}


@dataclass
class FileMetadata:
    """File metadata including author and editor information"""
    authors: list[str] = None  # File creators/authors
    editors: list[str] = None  # Last editors/modifiers

    def __post_init__(self):
        if self.authors is None:
            self.authors = []
        if self.editors is None:
            self.editors = []


@dataclass
class LoaderResult:
    """Document loader result"""
    success: bool
    documents: list[Document]
    error: Optional[str] = None
    file_path: str = ""
    file_type: str = ""
    unsupported: bool = False  # True if file type is not supported by LangChain
    too_large: bool = False  # True if file exceeds max size limit
    is_image: bool = False  # True if file is an image (needs Vision LLM processing)
    metadata: Optional[FileMetadata] = None  # Author/editor metadata


# File extension to loader mapping (excludes table files which use pandas)
LOADER_MAPPING: dict[str, tuple[type, dict]] = {
    # Text files
    ".txt": (TextLoader, {"autodetect_encoding": True}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".markdown": (UnstructuredMarkdownLoader, {}),

    # PDF
    ".pdf": (PyPDFLoader, {}),

    # Microsoft Office (except Excel - handled by table_loader)
    ".docx": (Docx2txtLoader, {}),
    ".pptx": (UnstructuredPowerPointLoader, {}),

    # Web
    ".html": (UnstructuredHTMLLoader, {}),
    ".htm": (UnstructuredHTMLLoader, {}),

    # Data files (except CSV - handled by table_loader)
    ".json": (JSONLoader, {"jq_schema": ".", "text_content": False}),
}

# Image file extensions (processed via Vision LLM, not LangChain loaders)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

# Supported extensions set (includes LangChain loaders, image files, and table files)
SUPPORTED_EXTENSIONS = set(LOADER_MAPPING.keys()) | IMAGE_EXTENSIONS | TABLE_EXTENSIONS


def detect_encoding(file_path: Path) -> str:
    """
    Detect file encoding

    Args:
        file_path: Path to file

    Returns:
        Detected encoding string
    """
    try:
        with open(file_path, "rb") as f:
            raw_data = f.read(10000)  # Read first 10KB
            result = chardet.detect(raw_data)
            return result.get("encoding", "utf-8") or "utf-8"
    except Exception:
        return "utf-8"


def is_supported_file(file_path: Path) -> bool:
    """
    Check if file type is supported

    Args:
        file_path: Path to file

    Returns:
        True if supported
    """
    return file_path.suffix.lower() in SUPPORTED_EXTENSIONS


def is_image_file(file_path: Path) -> bool:
    """
    Check if file is an image

    Args:
        file_path: Path to file

    Returns:
        True if image file
    """
    return file_path.suffix.lower() in IMAGE_EXTENSIONS


def extract_pdf_metadata(file_path: Path) -> FileMetadata:
    """
    Extract author/editor metadata from PDF file

    Args:
        file_path: Path to PDF file

    Returns:
        FileMetadata with extracted information
    """
    metadata = FileMetadata()
    try:
        import pypdf
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            info = reader.metadata
            if info:
                # Author field
                author = info.get("/Author", "")
                if author:
                    metadata.authors = [author.strip()]
                # Creator field as fallback
                if not metadata.authors:
                    creator = info.get("/Creator", "")
                    if creator and not creator.startswith(("Microsoft", "Adobe", "LibreOffice")):
                        metadata.authors = [creator.strip()]
                # Producer might have editor info
                producer = info.get("/Producer", "")
                if producer and not producer.startswith(("Microsoft", "Adobe", "LibreOffice", "pypdf")):
                    metadata.editors = [producer.strip()]
    except Exception:
        pass
    return metadata


def extract_office_metadata(file_path: Path) -> FileMetadata:
    """
    Extract author/editor metadata from Office files (docx, xlsx, pptx)

    Args:
        file_path: Path to Office file

    Returns:
        FileMetadata with extracted information
    """
    metadata = FileMetadata()
    try:
        import zipfile
        import xml.etree.ElementTree as ET

        # Office files are ZIP archives with XML metadata
        with zipfile.ZipFile(file_path, "r") as zf:
            # Try to read core.xml (contains creator and lastModifiedBy)
            try:
                core_xml = zf.read("docProps/core.xml")
                root = ET.fromstring(core_xml)

                # Define namespaces
                namespaces = {
                    "dc": "http://purl.org/dc/elements/1.1/",
                    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
                }

                # Extract creator (author)
                creator = root.find("dc:creator", namespaces)
                if creator is not None and creator.text:
                    metadata.authors = [creator.text.strip()]

                # Extract lastModifiedBy (editor)
                last_modified_by = root.find("cp:lastModifiedBy", namespaces)
                if last_modified_by is not None and last_modified_by.text:
                    metadata.editors = [last_modified_by.text.strip()]

            except KeyError:
                pass
    except Exception:
        pass
    return metadata


def extract_image_metadata(file_path: Path) -> FileMetadata:
    """
    Extract author/editor metadata from image files (EXIF data)

    Args:
        file_path: Path to image file

    Returns:
        FileMetadata with extracted information
    """
    metadata = FileMetadata()
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        with Image.open(file_path) as img:
            exif_data = img._getexif()
            if exif_data:
                for tag_id, value in exif_data.items():
                    tag = TAGS.get(tag_id, tag_id)
                    if tag == "Artist" and value:
                        metadata.authors = [str(value).strip()]
                    elif tag == "Copyright" and value and not metadata.authors:
                        # Use copyright as fallback for author
                        metadata.authors = [str(value).strip()]
    except Exception:
        pass
    return metadata


def extract_file_metadata(file_path: Path) -> FileMetadata:
    """
    Extract author/editor metadata from any supported file type

    Args:
        file_path: Path to file

    Returns:
        FileMetadata with extracted information
    """
    ext = file_path.suffix.lower()

    # PDF files
    if ext == ".pdf":
        return extract_pdf_metadata(file_path)

    # Office files
    if ext in [".docx", ".xlsx", ".pptx"]:
        return extract_office_metadata(file_path)

    # Image files
    if ext in IMAGE_EXTENSIONS:
        return extract_image_metadata(file_path)

    # Default: empty metadata
    return FileMetadata()


def get_loader_for_file(file_path: Path) -> Optional[tuple[type, dict]]:
    """
    Get appropriate loader for file type

    Args:
        file_path: Path to file

    Returns:
        Tuple of (LoaderClass, kwargs) or None if not supported
    """
    ext = file_path.suffix.lower()
    return LOADER_MAPPING.get(ext)


def load_document(
    file_path: Path,
    max_file_size_mb: float = 100.0,
) -> LoaderResult:
    """
    Load document using appropriate LangChain loader

    Args:
        file_path: Path to file
        max_file_size_mb: Maximum file size in MB

    Returns:
        LoaderResult with documents or error
    """
    file_path = Path(file_path)

    # Check if file exists
    if not file_path.exists():
        return LoaderResult(
            success=False,
            documents=[],
            error=f"File not found: {file_path}",
            file_path=str(file_path),
        )

    # Check file size
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_file_size_mb:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"File too large: {file_size_mb:.2f}MB (max: {max_file_size_mb}MB)",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            too_large=True,
        )

    # Extract file metadata (author/editor)
    file_metadata = extract_file_metadata(file_path)

    # Check if it's an image file (handled by Vision LLM, not LangChain)
    if is_image_file(file_path):
        return LoaderResult(
            success=True,
            documents=[],  # No documents - will be processed by Vision LLM
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            is_image=True,
            metadata=file_metadata,
        )

    # Check if it's a table file (handled by pandas table_loader)
    if is_table_file(file_path):
        table_result = load_table_file(file_path)
        if not table_result.success:
            return LoaderResult(
                success=False,
                documents=[],
                error=table_result.error,
                file_path=str(file_path),
                file_type=file_path.suffix.lower(),
                metadata=file_metadata,
            )

        # Convert TableDocuments to LangChain Documents
        documents = []
        for table_doc in table_result.documents:
            # Use markdown content as page_content
            doc = Document(
                page_content=table_doc.markdown_content,
                metadata={
                    "source_path": str(file_path),
                    "file_name": file_path.name,
                    "file_type": file_path.suffix.lower(),
                    "is_table": True,
                    "sheet_name": table_doc.metadata.sheet_name,
                    "columns": table_doc.metadata.columns,
                    "row_count": table_doc.metadata.row_count,
                    "schema_description": table_doc.schema_description,
                    "summary_context": table_doc.summary_context,
                    "truncated": table_doc.truncated,
                }
            )
            documents.append(doc)

        return LoaderResult(
            success=True,
            documents=documents,
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            metadata=file_metadata,
        )

    # Get loader
    loader_info = get_loader_for_file(file_path)
    if not loader_info:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"Unsupported file type: {file_path.suffix}",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            unsupported=True,
            metadata=file_metadata,
        )

    loader_class, loader_kwargs = loader_info

    try:
        # Special handling for text files - detect encoding
        if file_path.suffix.lower() in [".txt", ".md", ".markdown"]:
            encoding = detect_encoding(file_path)
            if loader_class == TextLoader:
                loader_kwargs = {**loader_kwargs, "encoding": encoding}

        # Create loader instance
        loader = loader_class(str(file_path), **loader_kwargs)

        # Load documents
        documents = loader.load()

        # Add metadata
        for doc in documents:
            doc.metadata["source_path"] = str(file_path)
            doc.metadata["file_name"] = file_path.name
            doc.metadata["file_type"] = file_path.suffix.lower()
            doc.metadata["file_size_bytes"] = file_path.stat().st_size

        return LoaderResult(
            success=True,
            documents=documents,
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            metadata=file_metadata,
        )

    except Exception as e:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"Failed to load document: {str(e)}",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            metadata=file_metadata,
        )


def load_documents_from_folder(
    folder_path: Path,
    recursive: bool = True,
    max_depth: int = 4,
    max_file_size_mb: float = 100.0,
    ignore_patterns: Optional[list[str]] = None,
    on_progress: Optional[Callable[[str, int, int], None]] = None,
    include_unsupported: bool = False,
) -> tuple[list[LoaderResult], list[LoaderResult]]:
    """
    Load all supported documents from a folder

    Args:
        folder_path: Path to folder
        recursive: Whether to search recursively
        max_depth: Maximum recursion depth
        max_file_size_mb: Maximum file size in MB
        ignore_patterns: Patterns to ignore
        on_progress: Progress callback (file_path, current, total)
        include_unsupported: If True, also collect unsupported files (marked with unsupported=True)

    Returns:
        Tuple of (successful_results, failed_results)
        When include_unsupported=True, unsupported files are in failed_results with unsupported=True
    """
    if ignore_patterns is None:
        ignore_patterns = [
            ".git",
            ".venv",
            "venv",
            "__pycache__",
            "node_modules",
            ".DS_Store",
        ]

    folder_path = Path(folder_path)

    if not folder_path.exists() or not folder_path.is_dir():
        return [], [LoaderResult(
            success=False,
            documents=[],
            error=f"Invalid folder path: {folder_path}",
            file_path=str(folder_path),
        )]

    # Collect all files
    files_to_process = []

    def should_ignore(path: Path) -> bool:
        for pattern in ignore_patterns:
            if pattern in path.parts:
                return True
            if path.name == pattern:
                return True
        return False

    def collect_files(current_path: Path, current_depth: int):
        # max_depth=0 means unlimited depth
        if max_depth > 0 and current_depth > max_depth:
            return

        try:
            for item in current_path.iterdir():
                if should_ignore(item):
                    continue

                if item.is_file():
                    if is_supported_file(item):
                        files_to_process.append((item, True))  # (path, is_supported)
                    elif include_unsupported:
                        files_to_process.append((item, False))  # unsupported but included
                elif item.is_dir() and recursive:
                    collect_files(item, current_depth + 1)
        except PermissionError:
            pass

    collect_files(folder_path, 0)

    # Process files
    successful = []
    failed = []
    total = len(files_to_process)

    for i, (file_path, is_supported) in enumerate(files_to_process):
        if on_progress:
            on_progress(str(file_path), i + 1, total)

        if is_supported:
            result = load_document(file_path, max_file_size_mb)
        else:
            # Create result for unsupported file (path info only)
            result = LoaderResult(
                success=False,
                documents=[],
                error=f"Unsupported file type: {file_path.suffix}",
                file_path=str(file_path),
                file_type=file_path.suffix.lower(),
                unsupported=True,
            )

        if result.success:
            successful.append(result)
        else:
            failed.append(result)

    return successful, failed


def get_supported_extensions_info() -> dict[str, str]:
    """
    Get information about supported file extensions

    Returns:
        Dict mapping extension to loader name
    """
    info = {}
    for ext, (loader_class, _) in LOADER_MAPPING.items():
        info[ext] = loader_class.__name__
    # Add image extensions
    for ext in IMAGE_EXTENSIONS:
        info[ext] = "VisionLLM"
    return info


def load_document_pages(
    file_path: Path,
    max_pages: int = 5,
    max_file_size_mb: float = 100.0,
) -> LoaderResult:
    """
    Load first N pages/sections of a document

    PDFの場合は最初のN枚のみを抽出。
    その他のドキュメントは全体を読み込んでからテキストを制限。

    Args:
        file_path: Path to file
        max_pages: Maximum number of pages to extract (default: 5)
        max_file_size_mb: Maximum file size in MB

    Returns:
        LoaderResult with limited documents
    """
    file_path = Path(file_path)

    # Check if file exists
    if not file_path.exists():
        return LoaderResult(
            success=False,
            documents=[],
            error=f"File not found: {file_path}",
            file_path=str(file_path),
        )

    # Check file size
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_file_size_mb:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"File too large: {file_size_mb:.2f}MB (max: {max_file_size_mb}MB)",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            too_large=True,
        )

    # Extract file metadata
    file_metadata = extract_file_metadata(file_path)

    # Check if it's an image file
    if is_image_file(file_path):
        return LoaderResult(
            success=True,
            documents=[],
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
            is_image=True,
            metadata=file_metadata,
        )

    ext = file_path.suffix.lower()

    try:
        # PDF: Load specific pages using PyPDFLoader
        if ext == ".pdf":
            loader = PyPDFLoader(str(file_path))
            all_docs = loader.load()

            # Limit to first max_pages
            limited_docs = all_docs[:max_pages]

            # Add metadata
            for i, doc in enumerate(limited_docs):
                doc.metadata["source_path"] = str(file_path)
                doc.metadata["file_name"] = file_path.name
                doc.metadata["file_type"] = ext
                doc.metadata["page_number"] = i + 1
                doc.metadata["total_pages_loaded"] = len(limited_docs)
                doc.metadata["total_pages_in_file"] = len(all_docs)

            return LoaderResult(
                success=True,
                documents=limited_docs,
                file_path=str(file_path),
                file_type=ext,
                metadata=file_metadata,
            )

        # Other document types: Load all and limit by character count
        else:
            result = load_document(file_path, max_file_size_mb)

            if not result.success:
                return result

            # For non-PDF, we can't easily split by pages
            # So we return all documents but mark them
            for doc in result.documents:
                doc.metadata["page_limited"] = False  # Indicates full content

            return result

    except Exception as e:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"Failed to load document pages: {str(e)}",
            file_path=str(file_path),
            file_type=ext,
            metadata=file_metadata,
        )


def get_document_text(
    file_path: Path,
    max_pages: Optional[int] = None,
    max_file_size_mb: float = 100.0,
) -> tuple[str, Optional[str]]:
    """
    Get document text as a single string

    便利関数: ドキュメントからテキストを抽出して単一の文字列として返す。

    Args:
        file_path: Path to file
        max_pages: Maximum pages to load (None for all)
        max_file_size_mb: Maximum file size in MB

    Returns:
        Tuple of (text_content, error_message)
        If successful, error_message is None
    """
    file_path = Path(file_path)

    if max_pages:
        result = load_document_pages(file_path, max_pages, max_file_size_mb)
    else:
        result = load_document(file_path, max_file_size_mb)

    if not result.success:
        return "", result.error

    if result.is_image:
        return "", "Image files require Vision LLM processing"

    # Combine all document content
    text_parts = []
    for doc in result.documents:
        if doc.page_content:
            text_parts.append(doc.page_content)

    return "\n\n".join(text_parts), None


def get_table_content(
    file_path: Path,
    max_file_size_mb: float = 100.0,
) -> tuple[str, str, Optional[str]]:
    """
    Get table content with summary context for LLM processing.

    表形式ファイル専用の関数。Markdownテーブルとサマリーコンテキストを返す。

    Args:
        file_path: Path to table file (Excel or CSV)
        max_file_size_mb: Maximum file size in MB

    Returns:
        Tuple of (markdown_content, summary_context, error_message)
        If successful, error_message is None
    """
    file_path = Path(file_path)

    if not is_table_file(file_path):
        return "", "", f"Not a table file: {file_path.suffix}"

    # Check file size
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_file_size_mb:
        return "", "", f"File too large: {file_size_mb:.2f}MB (max: {max_file_size_mb}MB)"

    result = load_table_file(file_path)

    if not result.success:
        return "", "", result.error

    if not result.documents:
        return "", "", "No tables found in file"

    # Combine all table documents
    combined_markdown, combined_context = combine_table_documents(result.documents)

    return combined_markdown, combined_context, None


if __name__ == "__main__":
    # Test
    print("Supported extensions:")
    for ext, loader_name in get_supported_extensions_info().items():
        print(f"  {ext}: {loader_name}")
