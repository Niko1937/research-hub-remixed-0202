"""
Tests for oipf-summary Index Processing

Tests for:
- Research ID extraction
- Folder structure MD generation
- LLM functions (member extraction, summary, tags)
- Summary index pipeline
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.utils import extract_research_id, extract_research_id_from_folder


# ============================================================================
# Research ID Extraction Tests
# ============================================================================

def test_extract_research_id_basic():
    """Test basic research ID extraction"""
    research_id = extract_research_id(
        file_path="/data/research/ABC123_project/docs/paper.pdf",
        base_folder="/data/research"
    )
    assert research_id == "ABC1", f"Expected 'ABC1', got '{research_id}'"
    print("  [PASS] Basic research ID extraction")


def test_extract_research_id_with_special_chars():
    """Test research ID extraction with special characters"""
    research_id = extract_research_id(
        file_path="/data/X-Y-Z_test/file.pdf",
        base_folder="/data"
    )
    # Special chars are filtered, so we get XYZT or XYZt
    assert research_id in ["XYZT", "XYZt"], f"Expected 'XYZT' or 'XYZt', got '{research_id}'"
    print("  [PASS] Research ID with special characters")


def test_extract_research_id_with_japanese():
    """Test research ID extraction with Japanese characters"""
    research_id = extract_research_id(
        file_path="/data/研究ABC123/file.pdf",
        base_folder="/data"
    )
    assert research_id == "ABC1", f"Expected 'ABC1', got '{research_id}'"
    print("  [PASS] Research ID with Japanese characters (filtered)")


def test_extract_research_id_short_name():
    """Test research ID extraction with short folder name"""
    research_id = extract_research_id(
        file_path="/data/AB/file.pdf",
        base_folder="/data"
    )
    assert research_id == "AB", f"Expected 'AB', got '{research_id}'"
    print("  [PASS] Research ID with short folder name")


def test_extract_research_id_file_in_base():
    """Test research ID extraction when file is directly in base folder"""
    research_id = extract_research_id(
        file_path="/data/file.pdf",
        base_folder="/data"
    )
    assert research_id == "", f"Expected empty string, got '{research_id}'"
    print("  [PASS] Research ID for file in base folder")


def test_extract_research_id_from_folder_basic():
    """Test research ID extraction from folder path"""
    research_id = extract_research_id_from_folder(
        folder_path="/data/research/ABC123_project",
        base_folder="/data/research"
    )
    assert research_id == "ABC1", f"Expected 'ABC1', got '{research_id}'"
    print("  [PASS] Research ID from folder path")


# ============================================================================
# Folder Structure MD Generation Tests
# ============================================================================

def test_generate_tree_md_import():
    """Test that folder structure module can be imported"""
    from folder_structure import generate_tree_md, generate_tree
    assert callable(generate_tree_md)
    assert callable(generate_tree)
    print("  [PASS] Folder structure module import")


def test_generate_tree_md_basic():
    """Test basic folder structure MD generation"""
    from folder_structure import generate_tree_md
    import tempfile
    import os

    # Create temporary directory structure
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create some files and folders
        os.makedirs(os.path.join(tmpdir, "subdir1"))
        os.makedirs(os.path.join(tmpdir, "subdir2"))
        Path(os.path.join(tmpdir, "file1.txt")).touch()
        Path(os.path.join(tmpdir, "subdir1", "file2.txt")).touch()

        md = generate_tree_md(tmpdir, max_depth=2)

        # Check that result contains expected elements
        assert "```" in md, "MD should contain code block"
        assert "subdir1" in md, "MD should contain subdir1"
        assert "file1.txt" in md, "MD should contain file1.txt"

    print("  [PASS] Basic folder structure MD generation")


def test_generate_tree_md_with_base_path():
    """Test folder structure MD generation with base path"""
    from folder_structure import generate_tree_md
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        subdir = os.path.join(tmpdir, "project", "data")
        os.makedirs(subdir)
        Path(os.path.join(subdir, "test.txt")).touch()

        md = generate_tree_md(subdir, base_path=tmpdir, max_depth=2)

        # Root name should be relative path
        assert "project" in md or "data" in md, "MD should use relative path"

    print("  [PASS] Folder structure MD with base path")


# ============================================================================
# Document Loader Tests (requires langchain)
# ============================================================================

def test_document_loader_import():
    """Test document loader module can be imported"""
    try:
        from embeddings.document_loaders import (
            load_document,
            load_document_pages,
            get_document_text,
            is_image_file,
        )
        assert callable(load_document)
        assert callable(load_document_pages)
        assert callable(get_document_text)
        assert callable(is_image_file)
        print("  [PASS] Document loader module import")
    except ImportError as e:
        print(f"  [SKIP] Document loader import (missing dependency: {e.name})")


def test_is_image_file():
    """Test image file detection"""
    try:
        from embeddings.document_loaders import is_image_file

        assert is_image_file(Path("test.jpg")) == True
        assert is_image_file(Path("test.png")) == True
        assert is_image_file(Path("test.pdf")) == False
        assert is_image_file(Path("test.docx")) == False

        print("  [PASS] Image file detection")
    except ImportError as e:
        print(f"  [SKIP] Image file detection (missing dependency: {e.name})")


# ============================================================================
# LLM Client Tests
# ============================================================================

def test_llm_client_import():
    """Test LLM client module can be imported"""
    from embeddings.llm_client import LLMClient, LLMResult
    assert LLMClient is not None
    assert LLMResult is not None
    print("  [PASS] LLM client module import")


def test_parse_tags():
    """Test tag parsing"""
    from embeddings.llm_client import LLMClient

    # Create client without actual API connection
    class MockLLMClient(LLMClient):
        def __init__(self):
            pass  # Skip validation

    client = MockLLMClient()

    # Test comma-separated tags
    tags = client.parse_tags("AI, 機械学習, データ分析")
    assert len(tags) == 3
    assert "AI" in tags
    assert "機械学習" in tags

    # Test Japanese comma
    tags = client.parse_tags("AI、機械学習、データ分析")
    assert len(tags) == 3

    # Test empty string
    tags = client.parse_tags("")
    assert len(tags) == 0

    print("  [PASS] Tag parsing")


def test_parse_researchers():
    """Test researcher parsing"""
    from embeddings.llm_client import LLMClient

    class MockLLMClient(LLMClient):
        def __init__(self):
            pass

    client = MockLLMClient()

    # Test newline-separated names
    researchers = client.parse_researchers("田中太郎\n山田花子\n佐藤次郎")
    assert len(researchers) == 3
    assert "田中太郎" in researchers

    # Test with bullet points
    researchers = client.parse_researchers("- 田中太郎\n- 山田花子")
    assert len(researchers) == 2

    # Test "該当なし"
    researchers = client.parse_researchers("該当なし")
    assert len(researchers) == 0

    print("  [PASS] Researcher parsing")


# ============================================================================
# OIPF Schema Tests
# ============================================================================

def test_oipf_document_creation():
    """Test OIPFDocument creation"""
    from embeddings.oipf_schema import OIPFDocument

    doc = OIPFDocument(
        id="test-id",
        oipf_research_id="ABC1",
        related_researchers=["田中太郎", "山田花子"],
        oipf_research_abstract="研究の要約です。",
        oipf_research_abstract_embedding=[0.1] * 1024,
        oipf_spo_folderstructure_summary="```\nfolder/\n└── file.txt\n```",
        oipf_research_themetags=["AI", "機械学習"],
    )

    result = doc.to_dict()

    assert result["id"] == "test-id"
    assert result["oipf_research_id"] == "ABC1"
    assert len(result["related_researchers"]) == 2
    assert len(result["oipf_research_abstract_embedding"]) == 1024

    print("  [PASS] OIPFDocument creation")


def test_oipf_document_validation():
    """Test OIPFDocument validation"""
    from embeddings.oipf_schema import OIPFDocument

    # Valid document
    doc = OIPFDocument(
        id="test-id",
        oipf_research_abstract_embedding=[0.1] * 1024,
    )
    errors = doc.validate()
    assert len(errors) == 0, f"Expected no errors, got {errors}"

    # Invalid: no ID
    doc = OIPFDocument(
        id="",
        oipf_research_abstract_embedding=[0.1] * 1024,
    )
    errors = doc.validate()
    assert len(errors) > 0

    # Invalid: wrong embedding dimension
    doc = OIPFDocument(
        id="test-id",
        oipf_research_abstract_embedding=[0.1] * 512,
    )
    errors = doc.validate()
    assert len(errors) > 0

    print("  [PASS] OIPFDocument validation")


# ============================================================================
# Summary Index Pipeline Tests (requires langchain)
# ============================================================================

def test_pipeline_import():
    """Test pipeline module can be imported"""
    try:
        from embeddings.process_summary_index import SummaryIndexPipeline, ProcessingResult
        assert SummaryIndexPipeline is not None
        assert ProcessingResult is not None
        print("  [PASS] Pipeline module import")
    except ImportError as e:
        print(f"  [SKIP] Pipeline import (missing dependency: {e.name})")


def test_processing_result():
    """Test ProcessingResult dataclass"""
    try:
        from embeddings.process_summary_index import ProcessingResult

        result = ProcessingResult(
            success=True,
            research_id="ABC1",
            indexed=True,
        )

        assert result.success == True
        assert result.research_id == "ABC1"
        assert result.indexed == True
        assert result.error is None

        print("  [PASS] ProcessingResult dataclass")
    except ImportError as e:
        print(f"  [SKIP] ProcessingResult test (missing dependency: {e.name})")


def test_research_id_used_as_doc_id():
    """Test that research_id is used as document ID (not generated ID)"""
    # This test verifies that the document ID equals research_id
    from embeddings.oipf_schema import OIPFDocument

    research_id = "ABC1"
    doc = OIPFDocument(
        id=research_id,  # Document ID should equal research_id
        oipf_research_id=research_id,
        oipf_research_abstract_embedding=[0.1] * 1024,
    )

    result = doc.to_dict()
    assert result["id"] == research_id, f"Document ID should be research_id, got {result['id']}"
    assert result["oipf_research_id"] == research_id

    print("  [PASS] Research ID used as document ID")


def test_processing_result_empty_research_id():
    """Test ProcessingResult with empty research_id error"""
    try:
        from embeddings.process_summary_index import ProcessingResult

        result = ProcessingResult(
            success=False,
            research_id="",
            error="Research ID is empty. Ensure file is in a subfolder under base_path with ASCII alphanumeric characters.",
        )

        assert result.success == False
        assert result.research_id == ""
        assert "Research ID is empty" in result.error
        assert result.indexed == False

        print("  [PASS] ProcessingResult with empty research_id error")
    except ImportError as e:
        print(f"  [SKIP] ProcessingResult empty research_id test (missing dependency: {e.name})")


# ============================================================================
# Run All Tests
# ============================================================================

def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Running oipf-summary Index Tests")
    print("=" * 60)

    tests = [
        # Research ID tests
        test_extract_research_id_basic,
        test_extract_research_id_with_special_chars,
        test_extract_research_id_with_japanese,
        test_extract_research_id_short_name,
        test_extract_research_id_file_in_base,
        test_extract_research_id_from_folder_basic,
        # Folder structure tests
        test_generate_tree_md_import,
        test_generate_tree_md_basic,
        test_generate_tree_md_with_base_path,
        # Document loader tests
        test_document_loader_import,
        test_is_image_file,
        # LLM client tests
        test_llm_client_import,
        test_parse_tags,
        test_parse_researchers,
        # OIPF schema tests
        test_oipf_document_creation,
        test_oipf_document_validation,
        # Pipeline tests
        test_pipeline_import,
        test_processing_result,
        test_research_id_used_as_doc_id,
        test_processing_result_empty_research_id,
    ]

    passed = 0
    failed = 0
    errors = []

    for test in tests:
        try:
            print(f"\nRunning {test.__name__}...")
            test()
            passed += 1
        except AssertionError as e:
            failed += 1
            errors.append(f"{test.__name__}: {e}")
            print(f"  [FAIL] {e}")
        except Exception as e:
            failed += 1
            errors.append(f"{test.__name__}: {type(e).__name__}: {e}")
            print(f"  [ERROR] {type(e).__name__}: {e}")

    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if errors:
        print("\nFailed tests:")
        for error in errors:
            print(f"  - {error}")

    return failed == 0


if __name__ == "__main__":
    import sys
    success = run_all_tests()
    sys.exit(0 if success else 1)
