"""
Tests for Employees Index Processing Pipeline

Tests for:
- CSV reading and parsing
- manager_employee_id lookup
- Name matching for profile generation
- Record conversion
"""

import sys
import tempfile
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.process_employees import (
    EmployeesPipeline,
    EmployeeRecord,
    EmployeeProfile,
)


# ============================================================================
# CSV Reading Tests
# ============================================================================

def test_read_csv_basic():
    """Test basic CSV reading"""
    pipeline = EmployeesPipeline(verbose=False)

    # Create temporary CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write("employee_id,display_name,mail,job_title,department,manager_mail\n")
        f.write("E001,山田 太郎,yamada@example.com,部長,研究開発部,\n")
        f.write("E002,佐藤 花子,sato@example.com,課長,研究開発部,yamada@example.com\n")
        temp_path = f.name

    try:
        records = pipeline.read_csv(temp_path)
        assert len(records) == 2
        assert records[0]['employee_id'] == 'E001'
        assert records[0]['display_name'] == '山田 太郎'
        assert records[1]['manager_mail'] == 'yamada@example.com'
        print("  [PASS] Basic CSV reading")
    finally:
        os.unlink(temp_path)


def test_read_csv_missing_columns():
    """Test CSV with missing required columns"""
    pipeline = EmployeesPipeline(verbose=False)

    # Create CSV without required columns
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write("name,email\n")
        f.write("Test,test@example.com\n")
        temp_path = f.name

    try:
        try:
            pipeline.read_csv(temp_path)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Missing required columns" in str(e)
            print("  [PASS] Missing columns validation")
    finally:
        os.unlink(temp_path)


# ============================================================================
# Mail Lookup Tests
# ============================================================================

def test_build_mail_lookup():
    """Test mail → employee_id lookup building"""
    pipeline = EmployeesPipeline(verbose=False)

    records = [
        {'mail': 'yamada@example.com', 'employee_id': 'E001'},
        {'mail': 'sato@example.com', 'employee_id': 'E002'},
        {'mail': 'TANAKA@EXAMPLE.COM', 'employee_id': 'E003'},  # Uppercase
    ]

    lookup = pipeline.build_mail_lookup(records)

    assert len(lookup) == 3
    assert lookup['yamada@example.com'] == 'E001'
    assert lookup['sato@example.com'] == 'E002'
    assert lookup['tanaka@example.com'] == 'E003'  # Should be lowercased

    print("  [PASS] Mail lookup building")


def test_get_manager_employee_id():
    """Test manager_employee_id lookup"""
    pipeline = EmployeesPipeline(verbose=False)

    # Build lookup
    records = [
        {'mail': 'yamada@example.com', 'employee_id': 'E001'},
        {'mail': 'sato@example.com', 'employee_id': 'E002'},
    ]
    pipeline.build_mail_lookup(records)

    # Test lookup
    assert pipeline.get_manager_employee_id('yamada@example.com') == 'E001'
    assert pipeline.get_manager_employee_id('YAMADA@EXAMPLE.COM') == 'E001'  # Case insensitive
    assert pipeline.get_manager_employee_id('unknown@example.com') is None
    assert pipeline.get_manager_employee_id('') is None
    assert pipeline.get_manager_employee_id(None) is None

    print("  [PASS] Manager employee_id lookup")


# ============================================================================
# Name Matching Tests
# ============================================================================

def test_normalize_name():
    """Test name normalization"""
    pipeline = EmployeesPipeline(verbose=False)

    assert pipeline._normalize_name("山田 太郎") == "山田太郎"
    assert pipeline._normalize_name("山田　太郎") == "山田太郎"  # Full-width space
    assert pipeline._normalize_name("Yamada Taro") == "yamadataro"

    print("  [PASS] Name normalization")


def test_name_matches():
    """Test name matching"""
    pipeline = EmployeesPipeline(verbose=False)

    # Exact match
    assert pipeline._name_matches("山田太郎", "山田太郎") == True

    # With spaces
    assert pipeline._name_matches("山田 太郎", "山田太郎") == True

    # Partial match
    assert pipeline._name_matches("山田", "山田太郎") == True
    assert pipeline._name_matches("山田太郎", "山田") == True

    # No match
    assert pipeline._name_matches("佐藤", "山田") == False

    # Too short
    assert pipeline._name_matches("山", "山田太郎") == False

    print("  [PASS] Name matching")


def test_find_matching_research():
    """Test finding matching research by researcher name"""
    pipeline = EmployeesPipeline(verbose=False)

    # Mock oipf-summary data
    pipeline.oipf_summary_data = [
        {
            "oipf_research_id": "R001",
            "related_researchers": ["山田 太郎", "佐藤 花子"],
            "oipf_research_abstract": "AI研究について",
            "oipf_research_themetags": ["AI", "機械学習"],
        },
        {
            "oipf_research_id": "R002",
            "related_researchers": ["田中 誠"],
            "oipf_research_abstract": "量子コンピューティング研究",
            "oipf_research_themetags": ["量子", "コンピューティング"],
        },
    ]

    # Test matching
    matches = pipeline.find_matching_research("山田太郎")
    assert len(matches) == 1
    assert matches[0]["oipf_research_id"] == "R001"

    matches = pipeline.find_matching_research("佐藤 花子")
    assert len(matches) == 1

    matches = pipeline.find_matching_research("unknown")
    assert len(matches) == 0

    print("  [PASS] Find matching research")


# ============================================================================
# Profile Generation Tests
# ============================================================================

def test_generate_profile():
    """Test profile generation from matching research"""
    pipeline = EmployeesPipeline(verbose=False)

    # Mock oipf-summary data
    pipeline.oipf_summary_data = [
        {
            "oipf_research_id": "R001",
            "related_researchers": ["山田 太郎"],
            "oipf_research_abstract": "AIを活用した自然言語処理の研究。",
            "oipf_research_themetags": ["AI", "NLP", "機械学習", "Transformer"],
        },
    ]

    profile = pipeline.generate_profile("山田太郎")

    assert profile.research_summary != ""
    assert "AI" in profile.research_summary or len(profile.expertise) > 0
    assert len(profile.expertise) > 0 or len(profile.keywords) > 0

    print("  [PASS] Profile generation")


def test_generate_profile_no_match():
    """Test profile generation when no matching research"""
    pipeline = EmployeesPipeline(verbose=False)
    pipeline.oipf_summary_data = []

    profile = pipeline.generate_profile("unknown")

    assert profile.research_summary == ""
    assert profile.expertise == []
    assert profile.keywords == []
    assert profile.bio == ""

    print("  [PASS] Profile generation (no match)")


# ============================================================================
# Record Conversion Tests
# ============================================================================

def test_convert_records():
    """Test CSV records to EmployeeRecord conversion"""
    pipeline = EmployeesPipeline(verbose=False)

    # Setup
    csv_records = [
        {
            'employee_id': 'E001',
            'display_name': '山田 太郎',
            'mail': 'yamada@example.com',
            'job_title': '部長',
            'department': '研究開発部',
            'manager_mail': '',
        },
        {
            'employee_id': 'E002',
            'display_name': '佐藤 花子',
            'mail': 'sato@example.com',
            'job_title': '課長',
            'department': '研究開発部',
            'manager_mail': 'yamada@example.com',
        },
    ]

    pipeline.build_mail_lookup(csv_records)
    pipeline.oipf_summary_data = []

    employees = pipeline.convert_records(csv_records)

    assert len(employees) == 2
    assert employees[0].employee_id == 'E001'
    assert employees[0].manager_employee_id is None
    assert employees[1].employee_id == 'E002'
    assert employees[1].manager_employee_id == 'E001'

    print("  [PASS] Record conversion")


def test_employee_record_to_dict():
    """Test EmployeeRecord.to_dict()"""
    profile = EmployeeProfile(
        research_summary="AI研究",
        expertise=["AI", "ML"],
        keywords=["深層学習"],
        bio="東京大学卒",
    )

    employee = EmployeeRecord(
        employee_id="E001",
        display_name="山田 太郎",
        mail="yamada@example.com",
        job_title="部長",
        department="研究開発部",
        manager_employee_id="E000",
        profile=profile,
    )

    result = employee.to_dict()

    assert result["employee_id"] == "E001"
    assert result["display_name"] == "山田 太郎"
    assert result["manager_employee_id"] == "E000"
    assert result["profile"]["research_summary"] == "AI研究"
    assert result["profile"]["expertise"] == ["AI", "ML"]
    assert result["profile"]["keywords"] == ["深層学習"]

    print("  [PASS] EmployeeRecord to_dict")


# ============================================================================
# Run All Tests
# ============================================================================

def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Running Employees Processing Tests")
    print("=" * 60)

    tests = [
        # CSV reading tests
        test_read_csv_basic,
        test_read_csv_missing_columns,
        # Mail lookup tests
        test_build_mail_lookup,
        test_get_manager_employee_id,
        # Name matching tests
        test_normalize_name,
        test_name_matches,
        test_find_matching_research,
        # Profile generation tests
        test_generate_profile,
        test_generate_profile_no_match,
        # Record conversion tests
        test_convert_records,
        test_employee_record_to_dict,
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
