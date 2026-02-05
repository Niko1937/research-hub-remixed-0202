"""
Tests for OpenSearch Export/Import Scripts

Tests for:
- NDJSON file generation and parsing
- Export/Import helper functions
"""

import sys
import json
import tempfile
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ============================================================================
# NDJSON Helper Tests
# ============================================================================

def test_ndjson_write_and_read():
    """Test NDJSON write and read cycle"""
    from opensearch.import_indices import read_ndjson

    # Create test NDJSON file
    test_docs = [
        {"_id": "doc1", "_source": {"field1": "value1", "field2": 123}},
        {"_id": "doc2", "_source": {"field1": "value2", "field2": 456}},
        {"_id": "doc3", "_source": {"field1": "value3", "japanese": "日本語テスト"}},
    ]

    with tempfile.NamedTemporaryFile(mode='w', suffix='.ndjson', delete=False, encoding='utf-8') as f:
        for doc in test_docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        temp_path = Path(f.name)

    try:
        # Read back and verify
        all_docs = []
        for batch in read_ndjson(temp_path, batch_size=2):
            all_docs.extend(batch)

        assert len(all_docs) == 3
        assert all_docs[0]["_id"] == "doc1"
        assert all_docs[0]["_source"]["field1"] == "value1"
        assert all_docs[2]["_source"]["japanese"] == "日本語テスト"

        print("  [PASS] NDJSON write and read cycle")
    finally:
        temp_path.unlink()


def test_ndjson_batch_size():
    """Test NDJSON read with different batch sizes"""
    from opensearch.import_indices import read_ndjson

    # Create test NDJSON with 10 documents
    test_docs = [
        {"_id": f"doc{i}", "_source": {"index": i}}
        for i in range(10)
    ]

    with tempfile.NamedTemporaryFile(mode='w', suffix='.ndjson', delete=False, encoding='utf-8') as f:
        for doc in test_docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        temp_path = Path(f.name)

    try:
        # Read with batch size 3
        batches = list(read_ndjson(temp_path, batch_size=3))

        # Should have 4 batches: 3, 3, 3, 1
        assert len(batches) == 4
        assert len(batches[0]) == 3
        assert len(batches[1]) == 3
        assert len(batches[2]) == 3
        assert len(batches[3]) == 1

        print("  [PASS] NDJSON batch size handling")
    finally:
        temp_path.unlink()


def test_ndjson_empty_lines():
    """Test NDJSON read with empty lines"""
    from opensearch.import_indices import read_ndjson

    with tempfile.NamedTemporaryFile(mode='w', suffix='.ndjson', delete=False, encoding='utf-8') as f:
        f.write('{"_id": "doc1", "_source": {"a": 1}}\n')
        f.write('\n')  # Empty line
        f.write('{"_id": "doc2", "_source": {"a": 2}}\n')
        f.write('   \n')  # Whitespace only
        f.write('{"_id": "doc3", "_source": {"a": 3}}\n')
        temp_path = Path(f.name)

    try:
        all_docs = []
        for batch in read_ndjson(temp_path, batch_size=10):
            all_docs.extend(batch)

        assert len(all_docs) == 3
        print("  [PASS] NDJSON empty lines handling")
    finally:
        temp_path.unlink()


# ============================================================================
# Manifest Tests
# ============================================================================

def test_manifest_structure():
    """Test manifest file structure"""
    from datetime import datetime

    manifest = {
        "exported_at": datetime.now().isoformat(),
        "indices": {
            "oipf-summary": {
                "documents": 100,
                "success": True,
                "mapping_file": "oipf-summary_mapping.json",
                "data_file": "oipf-summary_data.ndjson",
            },
            "employees": {
                "documents": 50,
                "success": True,
                "mapping_file": "employees_mapping.json",
                "data_file": "employees_data.ndjson",
            },
        },
        "exclude_embeddings": False,
    }

    # Verify structure
    assert "exported_at" in manifest
    assert "indices" in manifest
    assert len(manifest["indices"]) == 2
    assert manifest["indices"]["oipf-summary"]["documents"] == 100

    print("  [PASS] Manifest structure")


# ============================================================================
# File Path Tests
# ============================================================================

def test_export_file_naming():
    """Test export file naming convention"""
    index_name = "oipf-summary"

    mapping_file = f"{index_name}_mapping.json"
    data_file = f"{index_name}_data.ndjson"

    assert mapping_file == "oipf-summary_mapping.json"
    assert data_file == "oipf-summary_data.ndjson"

    print("  [PASS] Export file naming")


def test_timestamp_directory():
    """Test timestamp directory creation"""
    from datetime import datetime

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Verify format (YYYYMMDD_HHMMSS)
    assert len(timestamp) == 15
    assert timestamp[8] == "_"

    output_dir = f"export_{timestamp}"
    assert output_dir.startswith("export_20")

    print("  [PASS] Timestamp directory naming")


# ============================================================================
# Document Structure Tests
# ============================================================================

def test_document_export_structure():
    """Test document structure for export"""
    # Document structure for export
    doc = {
        "_id": "ABC1",
        "_source": {
            "id": "ABC1",
            "oipf_research_id": "ABC1",
            "related_researchers": ["山田太郎", "佐藤花子"],
            "oipf_research_abstract": "AI研究の要約",
            "oipf_research_abstract_embedding": [0.1] * 1024,
            "oipf_research_themetags": ["AI", "ML"],
        }
    }

    # Verify structure
    assert "_id" in doc
    assert "_source" in doc
    assert "oipf_research_id" in doc["_source"]
    assert len(doc["_source"]["oipf_research_abstract_embedding"]) == 1024

    print("  [PASS] Document export structure")


def test_bulk_action_line():
    """Test bulk API action line format"""
    index_name = "oipf-summary"
    doc_id = "ABC1"

    action = {"index": {"_index": index_name, "_id": doc_id}}

    action_json = json.dumps(action, ensure_ascii=False)
    assert action_json == '{"index": {"_index": "oipf-summary", "_id": "ABC1"}}'

    print("  [PASS] Bulk action line format")


# ============================================================================
# Embedding Exclusion Tests
# ============================================================================

def test_embedding_exclusion_pattern():
    """Test embedding field exclusion patterns"""
    source_filter = {
        "excludes": [
            "*_embedding",
            "oipf_research_abstract_embedding",
            "oipf_abstract_embedding",
        ]
    }

    # Fields that should be excluded
    embedding_fields = [
        "oipf_research_abstract_embedding",
        "oipf_abstract_embedding",
        "custom_embedding",
    ]

    for field in embedding_fields:
        # Check if field matches any exclusion pattern
        matches = False
        for pattern in source_filter["excludes"]:
            if pattern == field:
                matches = True
            elif pattern.startswith("*") and field.endswith(pattern[1:]):
                matches = True

        assert matches, f"Field {field} should be excluded"

    print("  [PASS] Embedding exclusion patterns")


# ============================================================================
# Run All Tests
# ============================================================================

def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Running Export/Import Tests")
    print("=" * 60)

    tests = [
        # NDJSON tests
        test_ndjson_write_and_read,
        test_ndjson_batch_size,
        test_ndjson_empty_lines,
        # Manifest tests
        test_manifest_structure,
        # File path tests
        test_export_file_naming,
        test_timestamp_directory,
        # Document structure tests
        test_document_export_structure,
        test_bulk_action_line,
        # Embedding exclusion tests
        test_embedding_exclusion_pattern,
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
