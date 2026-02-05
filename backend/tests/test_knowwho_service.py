"""
Tests for KnowWho Service

Tests for:
- Service initialization
- Mock data loading
- Status reporting
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_knowwho_service_import():
    """Test KnowWhoService can be imported"""
    from app.services.knowwho_service import KnowWhoService, knowwho_service, Employee

    assert KnowWhoService is not None
    assert knowwho_service is not None
    assert Employee is not None
    print("  [PASS] KnowWhoService import")


def test_employee_dataclass():
    """Test Employee dataclass"""
    from app.services.knowwho_service import Employee

    emp = Employee(
        employee_id="E001",
        display_name="山田太郎",
        mail="yamada@example.com",
        job_title="部長",
        department="研究開発部",
        manager_employee_id="E000",
        research_summary="AI研究",
        expertise=["AI", "ML"],
        keywords=["深層学習"],
    )

    assert emp.employee_id == "E001"
    assert emp.display_name == "山田太郎"
    assert emp.expertise == ["AI", "ML"]
    print("  [PASS] Employee dataclass")


def test_employee_default_values():
    """Test Employee dataclass default values"""
    from app.services.knowwho_service import Employee

    emp = Employee(
        employee_id="E001",
        display_name="山田太郎",
        mail="yamada@example.com",
        job_title="部長",
        department="研究開発部",
    )

    assert emp.manager_employee_id is None
    assert emp.research_summary == ""
    assert emp.expertise == []
    assert emp.keywords == []
    assert emp.tsne_x == 0.0
    assert emp.tsne_y == 0.0
    print("  [PASS] Employee default values")


def test_service_status_mock_mode():
    """Test service status returns mock mode by default"""
    from app.services.knowwho_service import KnowWhoService

    # Ensure KNOWWHO_USE_OPENSEARCH is not set
    os.environ.pop("KNOWWHO_USE_OPENSEARCH", None)

    service = KnowWhoService()
    status = service.get_status()

    assert status["mode"] == "mock"
    assert "opensearch_available" in status
    assert "opensearch_enabled" in status
    assert status["opensearch_enabled"] == False
    print("  [PASS] Service status mock mode")


def test_use_opensearch_property():
    """Test use_opensearch property"""
    from app.services.knowwho_service import KnowWhoService

    # Test with env var set to false
    os.environ["KNOWWHO_USE_OPENSEARCH"] = "false"
    service = KnowWhoService()
    assert service.use_opensearch == False

    # Test with env var set to true (but OpenSearch not configured)
    os.environ["KNOWWHO_USE_OPENSEARCH"] = "true"
    service = KnowWhoService()
    # Will be False because OpenSearch client is not configured
    # (is_configured requires OPENSEARCH_URL to be set)
    # Just checking the property doesn't throw
    _ = service.use_opensearch

    # Clean up
    os.environ.pop("KNOWWHO_USE_OPENSEARCH", None)
    print("  [PASS] use_opensearch property")


def test_get_current_user_id():
    """Test get_current_user_id method"""
    from app.services.knowwho_service import KnowWhoService

    os.environ.pop("KNOWWHO_USE_OPENSEARCH", None)
    os.environ.pop("KNOWWHO_CURRENT_USER_ID", None)

    service = KnowWhoService()

    # In mock mode, should return the ID from mock data
    user_id = service.get_current_user_id()
    assert user_id is not None
    assert isinstance(user_id, str)
    print("  [PASS] get_current_user_id")


def test_mock_data_lazy_loading():
    """Test that mock data is loaded lazily"""
    from app.services.knowwho_service import KnowWhoService

    os.environ.pop("KNOWWHO_USE_OPENSEARCH", None)

    service = KnowWhoService()

    # Data should not be loaded yet
    assert service._mock_data_loaded == False

    # Trigger loading
    _ = service.get_current_user_id()

    # Data should now be loaded
    assert service._mock_data_loaded == True
    print("  [PASS] Mock data lazy loading")


# ============================================================================
# Run All Tests
# ============================================================================

def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Running KnowWho Service Tests")
    print("=" * 60)

    tests = [
        test_knowwho_service_import,
        test_employee_dataclass,
        test_employee_default_values,
        test_service_status_mock_mode,
        test_use_opensearch_property,
        test_get_current_user_id,
        test_mock_data_lazy_loading,
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
    success = run_all_tests()
    sys.exit(0 if success else 1)
