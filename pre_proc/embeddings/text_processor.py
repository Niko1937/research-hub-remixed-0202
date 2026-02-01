"""
Text Processor Module

テキストの前処理、チャンク分割、クリーニングを行う
"""

import re
import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


@dataclass
class ProcessedDocument:
    """Processed document with chunks"""
    source_path: str
    file_name: str
    file_type: str
    full_text: str
    chunks: list[str]
    metadata: dict


def clean_text(text: str) -> str:
    """
    Clean text by removing unwanted characters and normalizing whitespace

    Args:
        text: Raw text

    Returns:
        Cleaned text
    """
    if not text:
        return ""

    # Remove null bytes
    text = text.replace("\x00", "")

    # Normalize whitespace
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\r", "\n", text)

    # Remove excessive newlines (more than 2)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove excessive spaces
    text = re.sub(r"[ \t]+", " ", text)

    # Remove leading/trailing whitespace from lines
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    # Remove leading/trailing whitespace
    text = text.strip()

    return text


def extract_text_from_documents(documents: list[Document]) -> str:
    """
    Extract and combine text from LangChain documents

    Args:
        documents: List of LangChain Document objects

    Returns:
        Combined text
    """
    texts = []
    for doc in documents:
        content = doc.page_content
        if content:
            texts.append(clean_text(content))

    return "\n\n".join(texts)


def split_text_into_chunks(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    separators: Optional[list[str]] = None,
) -> list[str]:
    """
    Split text into chunks using recursive character text splitter

    Args:
        text: Text to split
        chunk_size: Maximum chunk size in characters
        chunk_overlap: Overlap between chunks
        separators: Custom separators (default: newlines, spaces)

    Returns:
        List of text chunks
    """
    if not text:
        return []

    if separators is None:
        separators = ["\n\n", "\n", "。", ".", " ", ""]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=separators,
        length_function=len,
    )

    chunks = splitter.split_text(text)

    # Clean each chunk
    chunks = [clean_text(chunk) for chunk in chunks if chunk.strip()]

    return chunks


def process_documents(
    documents: list[Document],
    source_path: str,
    file_name: str,
    file_type: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    min_chunk_length: int = 50,
) -> ProcessedDocument:
    """
    Process LangChain documents into chunks for embedding

    Args:
        documents: List of LangChain Document objects
        source_path: Original file path
        file_name: File name
        file_type: File extension
        chunk_size: Maximum chunk size
        chunk_overlap: Overlap between chunks
        min_chunk_length: Minimum chunk length to keep

    Returns:
        ProcessedDocument with full text and chunks
    """
    # Extract and combine text
    full_text = extract_text_from_documents(documents)

    # Split into chunks
    chunks = split_text_into_chunks(
        full_text,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    # Filter out very short chunks
    chunks = [chunk for chunk in chunks if len(chunk) >= min_chunk_length]

    # Collect metadata
    metadata = {}
    if documents and documents[0].metadata:
        metadata = documents[0].metadata.copy()

    metadata.update({
        "source_path": source_path,
        "file_name": file_name,
        "file_type": file_type,
        "full_text_length": len(full_text),
        "chunk_count": len(chunks),
    })

    return ProcessedDocument(
        source_path=source_path,
        file_name=file_name,
        file_type=file_type,
        full_text=full_text,
        chunks=chunks,
        metadata=metadata,
    )


def truncate_text(text: str, max_length: int = 10000) -> str:
    """
    Truncate text to maximum length

    Args:
        text: Text to truncate
        max_length: Maximum length

    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text

    # Try to truncate at a sentence boundary
    truncated = text[:max_length]
    last_period = truncated.rfind("。")
    if last_period == -1:
        last_period = truncated.rfind(".")

    if last_period > max_length * 0.8:  # If we found a period in last 20%
        return truncated[:last_period + 1]

    return truncated + "..."


def estimate_tokens(text: str, chars_per_token: float = 4.0) -> int:
    """
    Estimate token count for text (rough approximation)

    Args:
        text: Text to estimate
        chars_per_token: Average characters per token (default 4 for mixed languages)

    Returns:
        Estimated token count
    """
    if not text:
        return 0
    return int(len(text) / chars_per_token)


if __name__ == "__main__":
    # Test
    sample_text = """
    これはテストです。日本語のテキストを処理します。

    複数の段落があります。チャンク分割が正しく動作するかテストします。

    Three paragraphs of text to test the chunking functionality.
    """

    chunks = split_text_into_chunks(sample_text, chunk_size=100, chunk_overlap=20)
    print(f"Original length: {len(sample_text)}")
    print(f"Number of chunks: {len(chunks)}")
    for i, chunk in enumerate(chunks):
        print(f"\nChunk {i + 1} ({len(chunk)} chars):")
        print(f"  {chunk[:50]}...")
