"""
Tests for embeddings/oipf_schema.py
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.oipf_schema import (
    OIPFDocument,
    OIPFDetailsDocument,
    generate_document_id,
    generate_folder_structure_summary,
    create_oipf_document,
    create_oipf_details_document,
    create_oipf_details_document_path_only,
    truncate_richtext,
)


class TestOIPFDocument:
    """Tests for OIPFDocument class"""

    def test_to_dict(self):
        """Test conversion to dictionary"""
        doc = OIPFDocument(
            id="test-id",
            related_researchers=["researcher-1"],
            oipf_research_abstract="Test abstract",
            oipf_research_abstract_embedding=[0.1] * 1024,
            oipf_spo_folderstructure_summary="folder > file.pdf",
            oipf_research_richtext="Full text content",
            oipf_research_themetags=["tag1", "tag2"],
        )

        result = doc.to_dict()

        assert result["id"] == "test-id"
        assert result["related_researchers"] == ["researcher-1"]
        assert result["oipf_research_abstract"] == "Test abstract"
        assert len(result["oipf_research_abstract_embedding"]) == 1024
        assert result["oipf_spo_folderstructure_summary"] == "folder > file.pdf"
        assert result["oipf_research_richtext"] == "Full text content"
        assert result["oipf_research_themetags"] == ["tag1", "tag2"]

    def test_validate_valid_document(self):
        """Test validation of valid document"""
        doc = OIPFDocument(
            id="test-id",
            oipf_research_abstract_embedding=[0.1] * 1024,
        )

        errors = doc.validate()
        assert len(errors) == 0

    def test_validate_missing_id(self):
        """Test validation catches missing id"""
        doc = OIPFDocument(
            id="",
            oipf_research_abstract_embedding=[0.1] * 1024,
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "id is required" in errors[0]

    def test_validate_missing_embedding(self):
        """Test validation catches missing embedding"""
        doc = OIPFDocument(
            id="test-id",
            oipf_research_abstract_embedding=[],
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "embedding is required" in errors[0]

    def test_validate_wrong_dimensions(self):
        """Test validation catches wrong embedding dimensions"""
        doc = OIPFDocument(
            id="test-id",
            oipf_research_abstract_embedding=[0.1] * 512,  # Wrong size
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "1024 dimensions" in errors[0]


class TestGenerateDocumentId:
    """Tests for generate_document_id function"""

    def test_basic_id_generation(self):
        """Test basic document ID generation"""
        file_path = "/data/research/paper.pdf"
        doc_id = generate_document_id(file_path)

        assert doc_id is not None
        assert len(doc_id) > 0
        assert "paper" in doc_id.lower()

    def test_id_with_base_folder(self):
        """Test ID generation with base folder"""
        file_path = "/data/research/project/paper.pdf"
        base_folder = "/data/research"
        doc_id = generate_document_id(file_path, base_folder)

        assert doc_id is not None
        assert "paper" in doc_id.lower()

    def test_id_is_deterministic(self):
        """Test that same path produces same ID"""
        file_path = "/data/research/paper.pdf"
        id1 = generate_document_id(file_path)
        id2 = generate_document_id(file_path)

        assert id1 == id2

    def test_different_paths_different_ids(self):
        """Test that different paths produce different IDs"""
        id1 = generate_document_id("/data/research/paper1.pdf")
        id2 = generate_document_id("/data/research/paper2.pdf")

        assert id1 != id2

    def test_special_characters_handled(self):
        """Test that special characters in filenames are handled"""
        file_path = "/data/research/paper with spaces & symbols!.pdf"
        doc_id = generate_document_id(file_path)

        # Should not raise exception and should produce valid ID
        assert doc_id is not None
        assert len(doc_id) > 0
        # Special characters should be replaced
        assert "&" not in doc_id
        assert "!" not in doc_id


class TestGenerateFolderStructureSummary:
    """Tests for generate_folder_structure_summary function"""

    def test_basic_summary(self):
        """Test basic folder structure summary"""
        file_path = "/data/research/project/paper.pdf"
        summary = generate_folder_structure_summary(file_path)

        assert "paper.pdf" in summary

    def test_summary_with_base_folder(self):
        """Test summary with base folder"""
        file_path = "/data/research/project/subdir/paper.pdf"
        base_folder = "/data/research"
        summary = generate_folder_structure_summary(file_path, base_folder)

        assert "project" in summary
        assert "subdir" in summary
        assert "paper.pdf" in summary
        assert ">" in summary  # Separator

    def test_single_file_no_folders(self):
        """Test summary for file without folders"""
        file_path = "/paper.pdf"
        summary = generate_folder_structure_summary(file_path)

        assert "paper.pdf" in summary


class TestCreateOIPFDocument:
    """Tests for create_oipf_document function"""

    def test_create_complete_document(self):
        """Test creating a complete OIPF document"""
        doc = create_oipf_document(
            file_path="/data/research/paper.pdf",
            full_text="This is the full text content of the paper.",
            abstract="This is the abstract.",
            embedding=[0.1] * 1024,
            tags=["AI", "research"],
            base_folder="/data/research",
            researchers=["researcher-1"],
        )

        assert doc.id is not None
        assert doc.oipf_research_abstract == "This is the abstract."
        assert len(doc.oipf_research_abstract_embedding) == 1024
        assert doc.oipf_research_richtext == "This is the full text content of the paper."
        assert doc.oipf_research_themetags == ["AI", "research"]
        assert doc.related_researchers == ["researcher-1"]
        assert "paper.pdf" in doc.oipf_spo_folderstructure_summary

    def test_create_document_without_optional_fields(self):
        """Test creating document without optional fields"""
        doc = create_oipf_document(
            file_path="/paper.pdf",
            full_text="Text",
            abstract="Abstract",
            embedding=[0.1] * 1024,
            tags=[],
        )

        assert doc.id is not None
        assert doc.related_researchers == []
        assert doc.oipf_research_themetags == []


class TestTruncateRichtext:
    """Tests for truncate_richtext function"""

    def test_short_text_unchanged(self):
        """Test that short text is not truncated"""
        text = "Short text"
        result = truncate_richtext(text, max_length=100)
        assert result == text

    def test_long_text_truncated(self):
        """Test that long text is truncated"""
        text = "A" * 200000
        result = truncate_richtext(text, max_length=100000)
        assert len(result) < len(text)
        assert "[...truncated...]" in result

    def test_default_max_length(self):
        """Test default max length"""
        text = "A" * 50000
        result = truncate_richtext(text)
        # Default is 100000, so this should not be truncated
        assert result == text


class TestOIPFDetailsDocument:
    """Tests for OIPFDetailsDocument class"""

    def test_to_dict(self):
        """Test conversion to dictionary"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_file_path="project/folder/file.pdf",
            oipf_file_name="file.pdf",
            oipf_file_type=".pdf",
            oipf_file_abstract="Test abstract",
            oipf_abstract_embedding=[0.1] * 1024,
            oipf_file_richtext="Full text content",
            oipf_file_tags=["tag1", "tag2"],
            oipf_folder_path="project/folder",
        )

        result = doc.to_dict()

        assert result["id"] == "test-id"
        assert result["oipf_file_path"] == "project/folder/file.pdf"
        assert result["oipf_file_name"] == "file.pdf"
        assert result["oipf_file_type"] == ".pdf"
        assert result["oipf_file_abstract"] == "Test abstract"
        assert len(result["oipf_abstract_embedding"]) == 1024
        assert result["oipf_file_richtext"] == "Full text content"
        assert result["oipf_file_tags"] == ["tag1", "tag2"]
        assert result["oipf_folder_path"] == "project/folder"

    def test_validate_valid_document(self):
        """Test validation of valid document"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[0.1] * 1024,
        )

        errors = doc.validate()
        assert len(errors) == 0

    def test_validate_missing_id(self):
        """Test validation catches missing id"""
        doc = OIPFDetailsDocument(
            id="",
            oipf_abstract_embedding=[0.1] * 1024,
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "id is required" in errors[0]

    def test_validate_missing_embedding(self):
        """Test validation catches missing embedding"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[],
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "embedding is required" in errors[0]

    def test_validate_wrong_dimensions(self):
        """Test validation catches wrong embedding dimensions"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[0.1] * 512,  # Wrong size
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "1024 dimensions" in errors[0]

    def test_timestamps_in_dict(self):
        """Test that timestamps are converted to ISO format in dict"""
        from datetime import datetime
        now = datetime.utcnow()

        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[0.1] * 1024,
            created_at=now,
            updated_at=now,
        )

        result = doc.to_dict()
        assert "created_at" in result
        assert "updated_at" in result
        assert result["created_at"] == now.isoformat()


class TestCreateOIPFDetailsDocument:
    """Tests for create_oipf_details_document function"""

    def test_create_complete_document(self):
        """Test creating a complete OIPF details document"""
        doc = create_oipf_details_document(
            file_path="/data/research/project/paper.pdf",
            full_text="This is the full text content of the paper.",
            abstract="This is the abstract.",
            embedding=[0.1] * 1024,
            tags=["AI", "research"],
            base_folder="/data/research",
        )

        assert doc.id is not None
        assert doc.oipf_file_path == "project/paper.pdf"
        assert doc.oipf_file_name == "paper.pdf"
        assert doc.oipf_file_type == ".pdf"
        assert doc.oipf_file_abstract == "This is the abstract."
        assert len(doc.oipf_abstract_embedding) == 1024
        assert doc.oipf_file_richtext == "This is the full text content of the paper."
        assert doc.oipf_file_tags == ["AI", "research"]
        assert doc.oipf_folder_path == "project"
        assert doc.created_at is not None
        assert doc.updated_at is not None

    def test_create_document_without_base_folder(self):
        """Test creating document without base folder"""
        doc = create_oipf_details_document(
            file_path="/paper.pdf",
            full_text="Text",
            abstract="Abstract",
            embedding=[0.1] * 1024,
            tags=[],
        )

        assert doc.id is not None
        assert doc.oipf_file_path == "/paper.pdf"
        assert doc.oipf_file_name == "paper.pdf"
        assert doc.oipf_file_tags == []

    def test_file_type_extracted_correctly(self):
        """Test that file type is extracted correctly"""
        doc = create_oipf_details_document(
            file_path="/data/doc.DOCX",
            full_text="Text",
            abstract="Abstract",
            embedding=[0.1] * 1024,
            tags=[],
        )

        assert doc.oipf_file_type == ".docx"  # Lowercase

    def test_folder_path_calculated_correctly(self):
        """Test that folder path is calculated correctly"""
        doc = create_oipf_details_document(
            file_path="/data/research/project/subdir/paper.pdf",
            full_text="Text",
            abstract="Abstract",
            embedding=[0.1] * 1024,
            tags=[],
            base_folder="/data/research",
        )

        assert doc.oipf_folder_path == "project/subdir"

    def test_is_content_extracted_default_true(self):
        """Test that is_content_extracted defaults to True"""
        doc = create_oipf_details_document(
            file_path="/data/doc.pdf",
            full_text="Text",
            abstract="Abstract",
            embedding=[0.1] * 1024,
            tags=[],
        )

        assert doc.is_content_extracted is True


class TestCreateOIPFDetailsDocumentPathOnly:
    """Tests for create_oipf_details_document_path_only function"""

    def test_create_path_only_document(self):
        """Test creating a path-only document for unsupported files"""
        doc = create_oipf_details_document_path_only(
            file_path="/data/research/project/image.png",
            base_folder="/data/research",
        )

        assert doc.id is not None
        assert doc.oipf_file_path == "project/image.png"
        assert doc.oipf_file_name == "image.png"
        assert doc.oipf_file_type == ".png"
        assert doc.oipf_file_abstract == ""
        assert doc.oipf_abstract_embedding == []
        assert doc.oipf_file_richtext == ""
        assert doc.oipf_file_tags == []
        assert doc.oipf_folder_path == "project"
        assert doc.is_content_extracted is False
        assert doc.created_at is not None
        assert doc.updated_at is not None

    def test_path_only_document_validates_without_embedding(self):
        """Test that path-only documents validate without embedding"""
        doc = create_oipf_details_document_path_only(
            file_path="/data/image.png",
        )

        errors = doc.validate()
        assert len(errors) == 0

    def test_path_only_document_to_dict_excludes_embedding(self):
        """Test that to_dict excludes empty embedding"""
        doc = create_oipf_details_document_path_only(
            file_path="/data/image.png",
        )

        result = doc.to_dict()
        assert "oipf_abstract_embedding" not in result
        assert result["is_content_extracted"] is False

    def test_path_only_document_various_extensions(self):
        """Test path-only documents for various unsupported extensions"""
        extensions = [".png", ".jpg", ".mp4", ".exe", ".zip", ".dll"]

        for ext in extensions:
            doc = create_oipf_details_document_path_only(
                file_path=f"/data/file{ext}",
            )
            assert doc.oipf_file_type == ext
            assert doc.is_content_extracted is False
            assert len(doc.validate()) == 0


class TestOIPFDetailsDocumentContentExtracted:
    """Tests for is_content_extracted flag behavior"""

    def test_validation_requires_embedding_when_content_extracted(self):
        """Test that validation requires embedding when is_content_extracted=True"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[],
            is_content_extracted=True,
        )

        errors = doc.validate()
        assert len(errors) == 1
        assert "embedding is required" in errors[0]

    def test_validation_skips_embedding_when_content_not_extracted(self):
        """Test that validation skips embedding check when is_content_extracted=False"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[],
            is_content_extracted=False,
        )

        errors = doc.validate()
        assert len(errors) == 0

    def test_to_dict_includes_embedding_when_present(self):
        """Test that to_dict includes embedding when present"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[0.1] * 1024,
            is_content_extracted=True,
        )

        result = doc.to_dict()
        assert "oipf_abstract_embedding" in result
        assert len(result["oipf_abstract_embedding"]) == 1024

    def test_to_dict_excludes_embedding_when_empty(self):
        """Test that to_dict excludes embedding when empty"""
        doc = OIPFDetailsDocument(
            id="test-id",
            oipf_abstract_embedding=[],
            is_content_extracted=False,
        )

        result = doc.to_dict()
        assert "oipf_abstract_embedding" not in result
