"""
Document Loaders Module

LangChainのドキュメントローダーを統合し、
各種ファイル形式からテキストを抽出する
"""

import os
import sys
from pathlib import Path
from typing import Optional, Callable
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import chardet

# LangChain document loaders
from langchain_community.document_loaders import (
    TextLoader,
    PyPDFLoader,
    Docx2txtLoader,
    UnstructuredExcelLoader,
    UnstructuredPowerPointLoader,
    UnstructuredMarkdownLoader,
    UnstructuredHTMLLoader,
    CSVLoader,
    JSONLoader,
)
from langchain_core.documents import Document


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


# File extension to loader mapping
LOADER_MAPPING: dict[str, tuple[type, dict]] = {
    # Text files
    ".txt": (TextLoader, {"autodetect_encoding": True}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".markdown": (UnstructuredMarkdownLoader, {}),

    # PDF
    ".pdf": (PyPDFLoader, {}),

    # Microsoft Office
    ".docx": (Docx2txtLoader, {}),
    ".xlsx": (UnstructuredExcelLoader, {"mode": "elements"}),
    ".xls": (UnstructuredExcelLoader, {"mode": "elements"}),
    ".pptx": (UnstructuredPowerPointLoader, {}),

    # Web
    ".html": (UnstructuredHTMLLoader, {}),
    ".htm": (UnstructuredHTMLLoader, {}),

    # Data files
    ".csv": (CSVLoader, {}),
    ".json": (JSONLoader, {"jq_schema": ".", "text_content": False}),
}

# Supported extensions set
SUPPORTED_EXTENSIONS = set(LOADER_MAPPING.keys())


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
        )

    except Exception as e:
        return LoaderResult(
            success=False,
            documents=[],
            error=f"Failed to load document: {str(e)}",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
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
    return info


if __name__ == "__main__":
    # Test
    print("Supported extensions:")
    for ext, loader_name in get_supported_extensions_info().items():
        print(f"  {ext}: {loader_name}")
