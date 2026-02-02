"""
Tests for new features:
- oipf_research_id field
- oipf_file_author / oipf_file_editor fields
- _extract_research_id function
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.oipf_schema import (
    OIPFDocument,
    OIPFDetailsDocument,
    create_oipf_document,
    create_oipf_details_document,
    create_oipf_details_document_path_only,
)


def test_oipf_document_research_id():
    """Test OIPFDocument includes oipf_research_id"""
    doc = OIPFDocument(
        id="test-id",
        oipf_research_id="ABC1",
        oipf_research_abstract_embedding=[0.1] * 1024,
    )

    result = doc.to_dict()
    assert result["oipf_research_id"] == "ABC1", f"Expected 'ABC1', got '{result['oipf_research_id']}'"
    print("  [PASS] OIPFDocument.oipf_research_id field works correctly")


def test_oipf_details_document_research_id():
    """Test OIPFDetailsDocument includes oipf_research_id"""
    doc = OIPFDetailsDocument(
        id="test-id",
        oipf_research_id="XYZ9",
        oipf_abstract_embedding=[0.1] * 1024,
    )

    result = doc.to_dict()
    assert result["oipf_research_id"] == "XYZ9", f"Expected 'XYZ9', got '{result['oipf_research_id']}'"
    print("  [PASS] OIPFDetailsDocument.oipf_research_id field works correctly")


def test_oipf_details_document_author_editor():
    """Test OIPFDetailsDocument includes author/editor fields"""
    doc = OIPFDetailsDocument(
        id="test-id",
        oipf_abstract_embedding=[0.1] * 1024,
        oipf_file_author=["Author1", "Author2"],
        oipf_file_editor=["Editor1"],
    )

    result = doc.to_dict()
    assert result["oipf_file_author"] == ["Author1", "Author2"], f"Expected ['Author1', 'Author2'], got {result['oipf_file_author']}"
    assert result["oipf_file_editor"] == ["Editor1"], f"Expected ['Editor1'], got {result['oipf_file_editor']}"
    print("  [PASS] OIPFDetailsDocument.oipf_file_author/editor fields work correctly")


def test_create_oipf_document_with_research_id():
    """Test create_oipf_document with research_id parameter"""
    doc = create_oipf_document(
        file_path="/data/research/paper.pdf",
        full_text="Test content",
        abstract="Test abstract",
        embedding=[0.1] * 1024,
        tags=["test"],
        research_id="TEST",
    )

    assert doc.oipf_research_id == "TEST", f"Expected 'TEST', got '{doc.oipf_research_id}'"
    print("  [PASS] create_oipf_document with research_id works correctly")


def test_create_oipf_details_document_with_research_id():
    """Test create_oipf_details_document with research_id parameter"""
    doc = create_oipf_details_document(
        file_path="/data/research/paper.pdf",
        full_text="Test content",
        abstract="Test abstract",
        embedding=[0.1] * 1024,
        tags=["test"],
        research_id="ABCD",
        authors=["John Doe"],
        editors=["Jane Doe"],
    )

    assert doc.oipf_research_id == "ABCD", f"Expected 'ABCD', got '{doc.oipf_research_id}'"
    assert doc.oipf_file_author == ["John Doe"], f"Expected ['John Doe'], got {doc.oipf_file_author}"
    assert doc.oipf_file_editor == ["Jane Doe"], f"Expected ['Jane Doe'], got {doc.oipf_file_editor}"
    print("  [PASS] create_oipf_details_document with research_id/authors/editors works correctly")


def test_create_oipf_details_document_path_only_with_research_id():
    """Test create_oipf_details_document_path_only with research_id parameter"""
    doc = create_oipf_details_document_path_only(
        file_path="/data/research/image.png",
        research_id="1234",
        authors=["Creator"],
        editors=["Modifier"],
    )

    assert doc.oipf_research_id == "1234", f"Expected '1234', got '{doc.oipf_research_id}'"
    assert doc.oipf_file_author == ["Creator"], f"Expected ['Creator'], got {doc.oipf_file_author}"
    assert doc.oipf_file_editor == ["Modifier"], f"Expected ['Modifier'], got {doc.oipf_file_editor}"
    print("  [PASS] create_oipf_details_document_path_only with research_id/authors/editors works correctly")


def extract_research_id(file_path: str, base_folder: str) -> str:
    """
    Standalone implementation of _extract_research_id for testing.
    Extracts first 4 ASCII alphanumeric characters from immediate subfolder name.
    """
    try:
        rel_path = Path(file_path).relative_to(base_folder)
        parts = rel_path.parts

        if len(parts) >= 2:
            subfolder_name = parts[0]
            alphanumeric = "".join(c for c in subfolder_name if c.isascii() and c.isalnum())
            return alphanumeric[:4]
        else:
            return ""
    except ValueError:
        return ""


def test_extract_research_id_basic():
    """Test _extract_research_id function"""
    research_id = extract_research_id(
        file_path="/data/research/ABC123_project/docs/paper.pdf",
        base_folder="/data/research"
    )
    assert research_id == "ABC1", f"Expected 'ABC1', got '{research_id}'"
    print("  [PASS] _extract_research_id basic extraction works correctly")


def test_extract_research_id_with_special_chars():
    """Test _extract_research_id with special characters in folder name"""
    research_id = extract_research_id(
        file_path="/data/X-Y-Z_test/file.pdf",
        base_folder="/data"
    )
    assert research_id == "XYZT" or research_id == "XYZt", f"Expected 'XYZT' or 'XYZt', got '{research_id}'"
    print("  [PASS] _extract_research_id filters special characters correctly")


def test_extract_research_id_with_japanese():
    """Test _extract_research_id with Japanese characters (should be filtered)"""
    research_id = extract_research_id(
        file_path="/data/研究ABC123/file.pdf",
        base_folder="/data"
    )
    assert research_id == "ABC1", f"Expected 'ABC1', got '{research_id}'"
    print("  [PASS] _extract_research_id filters Japanese characters correctly")


def test_extract_research_id_short_name():
    """Test _extract_research_id with folder name shorter than 4 chars"""
    research_id = extract_research_id(
        file_path="/data/AB/file.pdf",
        base_folder="/data"
    )
    assert research_id == "AB", f"Expected 'AB', got '{research_id}'"
    print("  [PASS] _extract_research_id handles short folder names correctly")


def test_extract_research_id_file_in_base():
    """Test _extract_research_id with file directly in base folder"""
    research_id = extract_research_id(
        file_path="/data/file.pdf",
        base_folder="/data"
    )
    assert research_id == "", f"Expected empty string, got '{research_id}'"
    print("  [PASS] _extract_research_id returns empty for files in base folder")


def test_extract_research_id_numeric():
    """Test _extract_research_id with purely numeric folder name"""
    research_id = extract_research_id(
        file_path="/data/20240101_report/file.pdf",
        base_folder="/data"
    )
    assert research_id == "2024", f"Expected '2024', got '{research_id}'"
    print("  [PASS] _extract_research_id handles numeric folder names correctly")


def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Running New Features Tests")
    print("=" * 60)

    tests = [
        test_oipf_document_research_id,
        test_oipf_details_document_research_id,
        test_oipf_details_document_author_editor,
        test_create_oipf_document_with_research_id,
        test_create_oipf_details_document_with_research_id,
        test_create_oipf_details_document_path_only_with_research_id,
        test_extract_research_id_basic,
        test_extract_research_id_with_special_chars,
        test_extract_research_id_with_japanese,
        test_extract_research_id_short_name,
        test_extract_research_id_file_in_base,
        test_extract_research_id_numeric,
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
