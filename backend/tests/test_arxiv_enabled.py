"""
Test ARXIV_ENABLED environment variable functionality
"""

import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
import sys
import os

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

# Import modules
from app.services import external_search
from app.routers import arxiv_proxy


async def test_search_arxiv_disabled():
    """When ARXIV_ENABLED=false, search_arxiv should return empty list"""
    print("[Test 1] search_arxiv with ARXIV_ENABLED=false")

    # Save original
    original_settings = external_search.settings

    # Create mock settings
    mock_settings = MagicMock()
    mock_settings.arxiv_enabled = False
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Patch settings
    external_search.settings = mock_settings

    try:
        result = await external_search.search_arxiv("test query")
        assert result == [], f"Expected empty list, got {result}"
        print("✓ search_arxiv returns empty list when disabled")
    finally:
        # Restore
        external_search.settings = original_settings


async def test_search_arxiv_enabled():
    """When ARXIV_ENABLED=true, search_arxiv should attempt to search"""
    print("[Test 2] search_arxiv with ARXIV_ENABLED=true (mocked HTTP)")

    original_settings = external_search.settings

    mock_settings = MagicMock()
    mock_settings.arxiv_enabled = True
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = """<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
            <title>Test Paper Title</title>
            <summary>Test abstract</summary>
            <published>2024-01-01T00:00:00Z</published>
            <id>http://arxiv.org/abs/2401.00001</id>
            <author><name>Test Author</name></author>
        </entry>
    </feed>"""

    external_search.settings = mock_settings

    try:
        with patch('httpx.AsyncClient') as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await external_search.search_arxiv("test query")

            assert len(result) > 0, "Expected results when enabled"
            assert result[0].title == "Test Paper Title"
            print("✓ search_arxiv returns results when enabled")
    finally:
        external_search.settings = original_settings


async def test_arxiv_proxy_disabled():
    """When ARXIV_ENABLED=false, arxiv_proxy should return empty XML"""
    print("[Test 3] arxiv_proxy with ARXIV_ENABLED=false")

    original_settings = arxiv_proxy.settings

    mock_settings = MagicMock()
    mock_settings.arxiv_enabled = False
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    arxiv_proxy.settings = mock_settings

    try:
        request = arxiv_proxy.ArxivSearchRequest(searchQuery="test", maxResults=10)
        result = await arxiv_proxy.arxiv_proxy(request)

        assert "<?xml" in result.xmlData
        assert "<feed" in result.xmlData
        assert "<entry>" not in result.xmlData, "Should not contain entries when disabled"
        print("✓ arxiv_proxy returns empty XML when disabled")
    finally:
        arxiv_proxy.settings = original_settings


async def test_arxiv_proxy_enabled():
    """When ARXIV_ENABLED=true, arxiv_proxy should attempt to fetch"""
    print("[Test 4] arxiv_proxy with ARXIV_ENABLED=true (mocked HTTP)")

    original_settings = arxiv_proxy.settings

    mock_settings = MagicMock()
    mock_settings.arxiv_enabled = True
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = """<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
        <entry><title>Test Paper</title></entry>
    </feed>"""
    mock_response.raise_for_status = MagicMock()

    arxiv_proxy.settings = mock_settings

    try:
        with patch('httpx.AsyncClient') as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            request = arxiv_proxy.ArxivSearchRequest(searchQuery="test", maxResults=10)
            result = await arxiv_proxy.arxiv_proxy(request)

            assert "<entry>" in result.xmlData, "Should contain entries when enabled"
            print("✓ arxiv_proxy fetches data when enabled")
    finally:
        arxiv_proxy.settings = original_settings


async def test_search_all_sources_disabled():
    """search_all_sources should return empty when arXiv is disabled"""
    print("[Test 5] search_all_sources with ARXIV_ENABLED=false")

    original_settings = external_search.settings

    mock_settings = MagicMock()
    mock_settings.arxiv_enabled = False
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    external_search.settings = mock_settings

    try:
        result = await external_search.search_all_sources("test query")
        assert result == [], f"Expected empty list, got {result}"
        print("✓ search_all_sources returns empty when arXiv disabled")
    finally:
        external_search.settings = original_settings


async def main():
    print("=" * 60)
    print("Testing ARXIV_ENABLED functionality")
    print("=" * 60)
    print()

    await test_search_arxiv_disabled()
    print()
    await test_search_arxiv_enabled()
    print()
    await test_arxiv_proxy_disabled()
    print()
    await test_arxiv_proxy_enabled()
    print()
    await test_search_all_sources_disabled()

    print()
    print("=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
