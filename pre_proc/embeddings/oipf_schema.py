"""
OIPF Schema Module

oipf-summary / oipf-details インデックスのスキーマに合わせたドキュメント生成
"""

import sys
import hashlib
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class OIPFDocument:
    """
    oipf-summary index document

    OpenSearchの oipf-summary インデックスに投入するドキュメント形式
    """
    id: str
    related_researchers: list[str] = field(default_factory=list)
    oipf_research_abstract: str = ""
    oipf_research_abstract_embedding: list[float] = field(default_factory=list)
    oipf_spo_folderstructure_summary: str = ""
    oipf_research_richtext: str = ""
    oipf_research_themetags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for OpenSearch"""
        return {
            "id": self.id,
            "related_researchers": self.related_researchers,
            "oipf_research_abstract": self.oipf_research_abstract,
            "oipf_research_abstract_embedding": self.oipf_research_abstract_embedding,
            "oipf_spo_folderstructure_summary": self.oipf_spo_folderstructure_summary,
            "oipf_research_richtext": self.oipf_research_richtext,
            "oipf_research_themetags": self.oipf_research_themetags,
        }

    def validate(self) -> list[str]:
        """Validate document and return list of errors"""
        errors = []

        if not self.id:
            errors.append("id is required")

        if not self.oipf_research_abstract_embedding:
            errors.append("oipf_research_abstract_embedding is required")
        elif len(self.oipf_research_abstract_embedding) != 1024:
            errors.append(f"oipf_research_abstract_embedding must have 1024 dimensions, got {len(self.oipf_research_abstract_embedding)}")

        return errors


@dataclass
class OIPFDetailsDocument:
    """
    oipf-details index document

    OpenSearchの oipf-details インデックスに投入するドキュメント形式
    ファイル単位の詳細情報（RAG向け）
    """
    id: str
    oipf_file_path: str = ""
    oipf_file_name: str = ""
    oipf_file_type: str = ""
    oipf_file_abstract: str = ""
    oipf_abstract_embedding: list[float] = field(default_factory=list)
    oipf_file_richtext: str = ""
    oipf_file_tags: list[str] = field(default_factory=list)
    oipf_folder_path: str = ""
    oipf_file_author: list[str] = field(default_factory=list)  # File creators/authors
    oipf_file_editor: list[str] = field(default_factory=list)  # Last editors/modifiers
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_content_extracted: bool = True  # False if file type is unsupported

    def to_dict(self) -> dict:
        """Convert to dictionary for OpenSearch"""
        result = {
            "id": self.id,
            "oipf_file_path": self.oipf_file_path,
            "oipf_file_name": self.oipf_file_name,
            "oipf_file_type": self.oipf_file_type,
            "oipf_file_abstract": self.oipf_file_abstract,
            "oipf_file_richtext": self.oipf_file_richtext,
            "oipf_file_tags": self.oipf_file_tags,
            "oipf_folder_path": self.oipf_folder_path,
            "oipf_file_author": self.oipf_file_author,
            "oipf_file_editor": self.oipf_file_editor,
            "is_content_extracted": self.is_content_extracted,
        }

        # Only include embedding if content was extracted
        if self.oipf_abstract_embedding:
            result["oipf_abstract_embedding"] = self.oipf_abstract_embedding

        # Add timestamps in ISO format if present
        if self.created_at:
            result["created_at"] = self.created_at.isoformat()
        if self.updated_at:
            result["updated_at"] = self.updated_at.isoformat()

        return result

    def validate(self) -> list[str]:
        """Validate document and return list of errors"""
        errors = []

        if not self.id:
            errors.append("id is required")

        # Embedding is only required if content was extracted
        if self.is_content_extracted:
            if not self.oipf_abstract_embedding:
                errors.append("oipf_abstract_embedding is required when content is extracted")
            elif len(self.oipf_abstract_embedding) != 1024:
                errors.append(f"oipf_abstract_embedding must have 1024 dimensions, got {len(self.oipf_abstract_embedding)}")

        return errors


def generate_document_id(file_path: str, folder_path: str = "") -> str:
    """
    Generate unique document ID from file path

    Args:
        file_path: Full file path
        folder_path: Base folder path (for relative path calculation)

    Returns:
        Unique document ID
    """
    # Create relative path if folder_path is provided
    if folder_path:
        try:
            rel_path = str(Path(file_path).relative_to(folder_path))
        except ValueError:
            rel_path = file_path
    else:
        rel_path = file_path

    # Hash the path to create a stable ID
    path_hash = hashlib.md5(rel_path.encode()).hexdigest()[:12]

    # Create readable prefix from filename
    file_name = Path(file_path).stem[:20]
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in file_name)

    return f"{safe_name}_{path_hash}"


def generate_folder_structure_summary(file_path: str, base_folder: str = "") -> str:
    """
    Generate folder structure summary

    Args:
        file_path: Full file path
        base_folder: Base folder for relative path

    Returns:
        Folder structure summary string
    """
    path = Path(file_path)

    if base_folder:
        try:
            rel_path = path.relative_to(base_folder)
            parts = rel_path.parts
        except ValueError:
            parts = path.parts
    else:
        parts = path.parts

    # Build folder structure summary
    if len(parts) > 1:
        folders = " > ".join(parts[:-1])
        return f"{folders} > {parts[-1]}"
    else:
        return str(path.name)


def create_oipf_document(
    file_path: str,
    full_text: str,
    abstract: str,
    embedding: list[float],
    tags: list[str],
    base_folder: str = "",
    researchers: Optional[list[str]] = None,
) -> OIPFDocument:
    """
    Create OIPF document from processed file

    Args:
        file_path: Original file path
        full_text: Full extracted text
        abstract: Generated abstract/summary
        embedding: Abstract embedding vector (1024 dimensions)
        tags: Theme tags
        base_folder: Base folder for structure summary
        researchers: Related researcher IDs

    Returns:
        OIPFDocument ready for indexing
    """
    doc_id = generate_document_id(file_path, base_folder)
    folder_summary = generate_folder_structure_summary(file_path, base_folder)

    return OIPFDocument(
        id=doc_id,
        related_researchers=researchers or [],
        oipf_research_abstract=abstract,
        oipf_research_abstract_embedding=embedding,
        oipf_spo_folderstructure_summary=folder_summary,
        oipf_research_richtext=full_text,
        oipf_research_themetags=tags,
    )


def create_oipf_details_document(
    file_path: str,
    full_text: str,
    abstract: str,
    embedding: list[float],
    tags: list[str],
    base_folder: str = "",
    authors: Optional[list[str]] = None,
    editors: Optional[list[str]] = None,
) -> OIPFDetailsDocument:
    """
    Create OIPF details document for file-level RAG indexing

    Args:
        file_path: Original file path
        full_text: Full extracted text
        abstract: Generated abstract/summary
        embedding: Abstract embedding vector (1024 dimensions)
        tags: File tags
        base_folder: Base folder for relative path calculation
        authors: List of file authors/creators
        editors: List of last editors/modifiers

    Returns:
        OIPFDetailsDocument ready for indexing to oipf-details
    """
    path = Path(file_path)
    doc_id = generate_document_id(file_path, base_folder)

    # Calculate relative file path
    if base_folder:
        try:
            rel_path = str(path.relative_to(base_folder))
        except ValueError:
            rel_path = file_path
    else:
        rel_path = file_path

    # Calculate folder path
    if base_folder:
        try:
            rel_path_obj = path.relative_to(base_folder)
            folder_path = str(rel_path_obj.parent) if rel_path_obj.parent != Path(".") else ""
        except ValueError:
            folder_path = str(path.parent)
    else:
        folder_path = str(path.parent)

    now = datetime.utcnow()

    return OIPFDetailsDocument(
        id=doc_id,
        oipf_file_path=rel_path,
        oipf_file_name=path.name,
        oipf_file_type=path.suffix.lower(),
        oipf_file_abstract=abstract,
        oipf_abstract_embedding=embedding,
        oipf_file_richtext=full_text,
        oipf_file_tags=tags,
        oipf_folder_path=folder_path,
        oipf_file_author=authors or [],
        oipf_file_editor=editors or [],
        created_at=now,
        updated_at=now,
        is_content_extracted=True,
    )


def create_oipf_details_document_path_only(
    file_path: str,
    base_folder: str = "",
    authors: Optional[list[str]] = None,
    editors: Optional[list[str]] = None,
) -> OIPFDetailsDocument:
    """
    Create OIPF details document for unsupported files (path info only)

    LangChainで処理できない拡張子のファイル用。
    ファイルパス情報のみを登録し、要約・エンベディングは空。

    Args:
        file_path: Original file path
        base_folder: Base folder for relative path calculation
        authors: List of file authors/creators
        editors: List of last editors/modifiers

    Returns:
        OIPFDetailsDocument with path info only (no content/embedding)
    """
    path = Path(file_path)
    doc_id = generate_document_id(file_path, base_folder)

    # Calculate relative file path
    if base_folder:
        try:
            rel_path = str(path.relative_to(base_folder))
        except ValueError:
            rel_path = file_path
    else:
        rel_path = file_path

    # Calculate folder path
    if base_folder:
        try:
            rel_path_obj = path.relative_to(base_folder)
            folder_path = str(rel_path_obj.parent) if rel_path_obj.parent != Path(".") else ""
        except ValueError:
            folder_path = str(path.parent)
    else:
        folder_path = str(path.parent)

    now = datetime.utcnow()

    return OIPFDetailsDocument(
        id=doc_id,
        oipf_file_path=rel_path,
        oipf_file_name=path.name,
        oipf_file_type=path.suffix.lower(),
        oipf_file_abstract="",  # No content
        oipf_abstract_embedding=[],  # No embedding
        oipf_file_richtext="",  # No content
        oipf_file_tags=[],  # No tags
        oipf_folder_path=folder_path,
        oipf_file_author=authors or [],
        oipf_file_editor=editors or [],
        created_at=now,
        updated_at=now,
        is_content_extracted=False,  # Mark as not extracted
    )


def truncate_richtext(text: str, max_length: int = 100000) -> str:
    """
    Truncate rich text to maximum length

    Args:
        text: Full text
        max_length: Maximum length

    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text

    return text[:max_length] + "\n\n[...truncated...]"


if __name__ == "__main__":
    # Test
    test_path = "/data/research/project_a/paper.pdf"
    base = "/data/research"

    doc_id = generate_document_id(test_path, base)
    folder_summary = generate_folder_structure_summary(test_path, base)

    print(f"Document ID: {doc_id}")
    print(f"Folder Summary: {folder_summary}")

    # Test OIPFDocument creation (oipf-summary)
    doc = create_oipf_document(
        file_path=test_path,
        full_text="This is the full text content...",
        abstract="This is a summary.",
        embedding=[0.1] * 1024,
        tags=["research", "AI"],
        base_folder=base,
    )

    print(f"\nOIPFDocument (oipf-summary): {doc.to_dict()['id']}")
    print(f"Validation errors: {doc.validate()}")

    # Test OIPFDetailsDocument creation (oipf-details)
    details_doc = create_oipf_details_document(
        file_path=test_path,
        full_text="This is the full text content...",
        abstract="This is a summary.",
        embedding=[0.1] * 1024,
        tags=["research", "AI"],
        base_folder=base,
    )

    print(f"\nOIPFDetailsDocument (oipf-details):")
    print(f"  ID: {details_doc.id}")
    print(f"  File Path: {details_doc.oipf_file_path}")
    print(f"  File Name: {details_doc.oipf_file_name}")
    print(f"  File Type: {details_doc.oipf_file_type}")
    print(f"  Folder Path: {details_doc.oipf_folder_path}")
    print(f"  Validation errors: {details_doc.validate()}")
