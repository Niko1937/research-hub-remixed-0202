"""
Tests for Internal Research Search Services

Tests for:
- OpenSearch client
- Embedding client
- Internal research search service
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ============================================================================
# Config Tests
# ============================================================================

class TestConfig:
    """Test configuration settings"""

    def test_settings_default_values(self):
        """Test that settings have expected default values"""
        from app.config import Settings

        settings = Settings()

        # LLM defaults
        assert settings.llm_model == "vertex_ai.gemini-2.5-flash"
        assert settings.llm_timeout == 60

        # OpenSearch defaults
        assert settings.opensearch_url == ""
        assert settings.opensearch_verify_ssl == False
        assert settings.opensearch_proxy_enabled == False

        # Embedding defaults
        assert settings.embedding_model == "text-embedding-3-large"
        assert settings.embedding_dimensions == 1024
        assert settings.embedding_timeout == 60

    def test_is_opensearch_configured_false(self):
        """Test is_opensearch_configured returns False when not configured"""
        from app.config import Settings

        settings = Settings()
        assert settings.is_opensearch_configured() == False

    def test_is_opensearch_configured_true(self):
        """Test is_opensearch_configured returns True when URL is set"""
        from app.config import Settings

        settings = Settings(opensearch_url="https://localhost:9200")
        assert settings.is_opensearch_configured() == True

    def test_is_embedding_configured_false(self):
        """Test is_embedding_configured returns False when not configured"""
        from app.config import Settings

        settings = Settings()
        assert settings.is_embedding_configured() == False

    def test_is_embedding_configured_true(self):
        """Test is_embedding_configured returns True when URL and key are set"""
        from app.config import Settings

        settings = Settings(
            embedding_api_url="https://api.example.com",
            embedding_api_key="test-key"
        )
        assert settings.is_embedding_configured() == True


# ============================================================================
# OpenSearch Client Tests
# ============================================================================

class TestOpenSearchClient:
    """Test OpenSearch client"""

    def test_client_initialization(self):
        """Test OpenSearch client initializes correctly"""
        from app.services.opensearch_client import OpenSearchClient

        client = OpenSearchClient()
        assert client is not None
        assert client._client is None  # Client not created until first use

    def test_is_configured_property(self):
        """Test is_configured property"""
        from app.services.opensearch_client import OpenSearchClient

        client = OpenSearchClient()
        # Should be False with default settings (no URL)
        # This depends on the actual settings, so we just check it doesn't error
        assert isinstance(client.is_configured, bool)

    @pytest.mark.asyncio
    async def test_vector_search_not_configured(self):
        """Test vector_search raises error when not configured"""
        from app.services.opensearch_client import OpenSearchClient

        with patch("app.services.opensearch_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                opensearch_url="",
                is_opensearch_configured=lambda: False
            )

            client = OpenSearchClient()

            with pytest.raises(RuntimeError, match="not configured"):
                await client.vector_search(
                    index="test",
                    vector_field="embedding",
                    query_vector=[0.1] * 1024,
                    k=10
                )

    @pytest.mark.asyncio
    async def test_vector_search_success(self):
        """Test vector_search returns results when configured"""
        from app.services.opensearch_client import OpenSearchClient

        mock_response = {
            "hits": {
                "hits": [
                    {
                        "_id": "doc1",
                        "_score": 0.95,
                        "_source": {
                            "oipf_research_id": "ABC1",
                            "oipf_research_abstract": "Test abstract",
                            "oipf_research_themetags": ["AI", "ML"],
                        }
                    }
                ]
            }
        }

        with patch("app.services.opensearch_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                opensearch_url="https://localhost:9200",
                opensearch_username="admin",
                opensearch_password="password",
                opensearch_verify_ssl=False,
                opensearch_proxy_enabled=False,
                opensearch_proxy_url="",
                is_opensearch_configured=lambda: True
            )

            client = OpenSearchClient()

            # Mock the httpx client
            mock_http_client = AsyncMock()
            mock_http_client.post = AsyncMock(return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            ))
            client._client = mock_http_client

            result = await client.vector_search(
                index="oipf-summary",
                vector_field="oipf_research_abstract_embedding",
                query_vector=[0.1] * 1024,
                k=10
            )

            assert "hits" in result
            assert len(result["hits"]["hits"]) == 1
            assert result["hits"]["hits"][0]["_source"]["oipf_research_id"] == "ABC1"

    @pytest.mark.asyncio
    async def test_get_unique_field_values_success(self):
        """Test get_unique_field_values returns unique values"""
        from app.services.opensearch_client import OpenSearchClient

        mock_response = {
            "aggregations": {
                "unique_values": {
                    "buckets": [
                        {"key": "OIPF-2024-001", "doc_count": 10},
                        {"key": "OIPF-2024-002", "doc_count": 5},
                        {"key": "TEST-123", "doc_count": 3},
                    ]
                }
            }
        }

        with patch("app.services.opensearch_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                opensearch_url="https://localhost:9200",
                opensearch_username="admin",
                opensearch_password="password",
                opensearch_verify_ssl=False,
                opensearch_proxy_enabled=False,
                opensearch_proxy_url="",
                is_opensearch_configured=lambda: True
            )

            client = OpenSearchClient()

            # Mock the httpx client
            mock_http_client = AsyncMock()
            mock_http_client.post = AsyncMock(return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            ))
            client._client = mock_http_client

            result = await client.get_unique_field_values(
                index="oipf-summary",
                field="oipf_research_id"
            )

            assert isinstance(result, list)
            assert len(result) == 3
            assert "OIPF-2024-001" in result
            assert "OIPF-2024-002" in result
            assert "TEST-123" in result


# ============================================================================
# Embedding Client Tests
# ============================================================================

class TestEmbeddingClient:
    """Test Embedding client"""

    def test_client_initialization(self):
        """Test Embedding client initializes correctly"""
        from app.services.embedding_client import EmbeddingClient

        client = EmbeddingClient()
        assert client is not None
        assert client._client is None

    @pytest.mark.asyncio
    async def test_embed_text_not_configured(self):
        """Test embed_text raises error when not configured"""
        from app.services.embedding_client import EmbeddingClient

        with patch("app.services.embedding_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                embedding_api_url="",
                embedding_api_key="",
                is_embedding_configured=lambda: False
            )

            client = EmbeddingClient()

            with pytest.raises(RuntimeError, match="not configured"):
                await client.embed_text("test query")

    @pytest.mark.asyncio
    async def test_embed_text_success(self):
        """Test embed_text returns embedding vector"""
        from app.services.embedding_client import EmbeddingClient

        mock_response = {
            "data": [
                {
                    "embedding": [0.1] * 1024,
                    "index": 0
                }
            ]
        }

        with patch("app.services.embedding_client.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                embedding_api_url="https://api.example.com",
                embedding_api_key="test-key",
                embedding_model="text-embedding-3-large",
                embedding_dimensions=1024,
                embedding_timeout=60,
                embedding_proxy_enabled=False,
                embedding_proxy_url="",
                is_embedding_configured=lambda: True
            )

            client = EmbeddingClient()

            # Mock the httpx client
            mock_http_client = AsyncMock()
            mock_http_client.post = AsyncMock(return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            ))
            client._client = mock_http_client

            result = await client.embed_text("test query")

            assert isinstance(result, list)
            assert len(result) == 1024
            assert result[0] == 0.1


# ============================================================================
# Internal Research Search Service Tests
# ============================================================================

class TestInternalResearchSearchService:
    """Test Internal Research Search Service"""

    def test_service_initialization(self):
        """Test service initializes correctly"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()
        assert service is not None

    def test_create_title_from_abstract(self):
        """Test _create_title extracts title from abstract"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Short abstract
        title = service._create_title("短い要約です。", "")
        assert title == "短い要約です。"

        # Long abstract
        long_abstract = "これは非常に長い要約文です。" * 10
        title = service._create_title(long_abstract, "")
        assert len(title) <= 53  # 50 + "..."

        # Empty abstract, use folder summary
        title = service._create_title("", "フォルダ/サブフォルダ/ファイル")
        assert "フォルダ" in title

    def test_extract_year_from_tags(self):
        """Test _extract_year_from_tags extracts year correctly"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Year in tag
        year = service._extract_year_from_tags(["AI", "2024", "ML"])
        assert year == "2024"

        # Year in tag string
        year = service._extract_year_from_tags(["研究2023年度", "AI"])
        assert year == "2023"

        # No year
        year = service._extract_year_from_tags(["AI", "ML"])
        assert year is None

    @pytest.mark.asyncio
    async def test_search_initial_not_configured(self):
        """Test search_initial returns empty when not configured"""
        from app.services.internal_research_search import InternalResearchSearchService

        with patch("app.services.internal_research_search.opensearch_client") as mock_os:
            with patch("app.services.internal_research_search.embedding_client") as mock_emb:
                mock_os.is_configured = False
                mock_emb.is_configured = False

                service = InternalResearchSearchService()
                results = await service.search_initial("test query")

                assert results == []

    @pytest.mark.asyncio
    async def test_search_initial_success(self):
        """Test search_initial returns results when configured"""
        from app.services.internal_research_search import InternalResearchSearchService

        mock_opensearch_response = {
            "hits": {
                "hits": [
                    {
                        "_id": "doc1",
                        "_score": 0.95,
                        "_source": {
                            "oipf_research_id": "TEST",
                            "oipf_research_abstract": "これはテスト用の要約です。AIと機械学習について。",
                            "oipf_research_themetags": ["AI", "ML", "2024"],
                            "oipf_spo_folderstructure_summary": "研究/AI/プロジェクト"
                        }
                    },
                    {
                        "_id": "doc2",
                        "_score": 0.85,
                        "_source": {
                            "oipf_research_id": "ABCD",
                            "oipf_research_abstract": "自然言語処理の研究です。",
                            "oipf_research_themetags": ["NLP", "2023"],
                        }
                    }
                ]
            }
        }

        with patch("app.services.internal_research_search.opensearch_client") as mock_os:
            with patch("app.services.internal_research_search.embedding_client") as mock_emb:
                mock_os.is_configured = True
                mock_emb.is_configured = True
                mock_emb.embed_text = AsyncMock(return_value=[0.1] * 1024)
                mock_os.unified_search = AsyncMock(return_value=mock_opensearch_response)

                service = InternalResearchSearchService()
                results = await service.search_initial("AIについて教えて")

                assert len(results) == 2
                assert results[0].research_id == "TEST"
                assert results[0].year == "2024"
                assert "AI" in results[0].tags
                assert results[1].research_id == "ABCD"
                assert results[1].year == "2023"

    @pytest.mark.asyncio
    async def test_search_determines_initial_vs_followup(self):
        """Test search method correctly routes based on query type

        New routing logic (2024):
        - Default: oipf-details (search_followup)
        - Research discovery queries (e.g., "研究業績は？"): oipf-summary (search_initial)
        """
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Mock search_initial and search_followup
        with patch.object(service, 'search_initial', new_callable=AsyncMock) as mock_initial:
            with patch.object(service, 'search_followup', new_callable=AsyncMock) as mock_followup:
                mock_initial.return_value = []
                mock_followup.return_value = []

                # Default query routes to oipf-details (search_followup)
                await service.search("test query", chat_history=None)
                mock_followup.assert_called_once()
                mock_initial.assert_not_called()

                # Reset mocks
                mock_initial.reset_mock()
                mock_followup.reset_mock()

                # Research discovery query routes to oipf-summary (search_initial)
                await service.search("過去にこんな研究はされていたか", chat_history=None)
                mock_initial.assert_called_once()
                mock_followup.assert_not_called()

    def test_research_id_cache_initialization(self):
        """Test research_id cache is initialized correctly"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Cache should be empty initially
        assert service._known_research_ids == set()
        assert service._cache_loaded == False

        # get_cache_status should return correct values
        status = service.get_cache_status()
        assert status["loaded"] == False
        assert status["count"] == 0

    def test_find_research_id_in_query_not_loaded(self):
        """Test find_research_id_in_query returns None when cache not loaded"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Cache not loaded, should return None
        result = service.find_research_id_in_query("OIPF-2024-001 について教えて")
        assert result is None

    def test_find_research_id_in_query_found(self):
        """Test find_research_id_in_query finds known research_id"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Manually set cache
        service._known_research_ids = {"OIPF-2024-001", "OIPF-2024-002", "TEST-123"}
        service._cache_loaded = True

        # Should find research_id in query
        result = service.find_research_id_in_query("OIPF-2024-001 の詳細を教えて")
        assert result == "OIPF-2024-001"

        result = service.find_research_id_in_query("TEST-123 について")
        assert result == "TEST-123"

    def test_find_research_id_in_query_case_insensitive(self):
        """Test find_research_id_in_query is case-insensitive"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Cache has uppercase research IDs
        service._known_research_ids = {"OIPF-2024-001", "TEST-ABC-123"}
        service._cache_loaded = True

        # Should find even with lowercase input
        result = service.find_research_id_in_query("oipf-2024-001 の詳細を教えて")
        assert result == "OIPF-2024-001"

        # Should find with mixed case
        result = service.find_research_id_in_query("Test-ABC-123 について")
        assert result == "TEST-ABC-123"

    def test_find_research_id_in_query_word_boundary(self):
        """Test find_research_id_in_query uses word boundaries to avoid false positives"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Short 4-character research IDs
        service._known_research_ids = {"AB12", "TEST", "X001"}
        service._cache_loaded = True

        # Should find when ID is a standalone word
        result = service.find_research_id_in_query("AB12について教えて")
        assert result == "AB12"

        result = service.find_research_id_in_query("研究ID: AB12 の詳細")
        assert result == "AB12"

        # Should NOT find when ID is part of a larger word
        result = service.find_research_id_in_query("FAB12Cという製品について")
        assert result is None

        result = service.find_research_id_in_query("CONTEST の結果")  # Contains TEST but not as word
        assert result is None

        result = service.find_research_id_in_query("AX001Bのデータ")  # X001 embedded
        assert result is None

        # Should find at start/end of query
        result = service.find_research_id_in_query("TEST の実験結果")
        assert result == "TEST"

        result = service.find_research_id_in_query("これは X001")
        assert result == "X001"

    def test_find_research_id_in_query_not_found(self):
        """Test find_research_id_in_query returns None when not found"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Manually set cache
        service._known_research_ids = {"OIPF-2024-001", "OIPF-2024-002"}
        service._cache_loaded = True

        # Should not find unknown research_id
        result = service.find_research_id_in_query("アルミニウムの研究について")
        assert result is None

    @pytest.mark.asyncio
    async def test_search_routes_to_details_when_research_id_found(self):
        """Test search routes to oipf-details when research_id found in query"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Manually set cache with known research_id
        service._known_research_ids = {"OIPF-2024-001"}
        service._cache_loaded = True

        with patch.object(service, 'search_initial', new_callable=AsyncMock) as mock_initial:
            with patch.object(service, 'search_followup', new_callable=AsyncMock) as mock_followup:
                mock_initial.return_value = []
                mock_followup.return_value = []

                # Query contains known research_id - should route to followup (oipf-details)
                await service.search("OIPF-2024-001 の詳細を教えて", chat_history=None)

                # Should call search_followup with research_id_filter
                mock_followup.assert_called_once()
                call_args = mock_followup.call_args
                assert call_args[0][2] == "OIPF-2024-001"  # research_id_filter
                mock_initial.assert_not_called()

    @pytest.mark.asyncio
    async def test_load_research_ids_cache(self):
        """Test load_research_ids_cache loads IDs from OpenSearch"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        with patch("app.services.internal_research_search.opensearch_client") as mock_os:
            mock_os.is_configured = True
            mock_os.get_unique_field_values = AsyncMock(
                return_value=["OIPF-2024-001", "OIPF-2024-002", "TEST-123"]
            )

            await service.load_research_ids_cache()

            assert service._cache_loaded == True
            assert len(service._known_research_ids) == 3
            assert "OIPF-2024-001" in service._known_research_ids
            assert "TEST-123" in service._known_research_ids

    def test_is_research_discovery_query(self):
        """Test is_research_discovery_query detects research exploration queries"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()

        # Should detect research discovery queries
        assert service.is_research_discovery_query("過去にこんな研究はされていたか") == True
        assert service.is_research_discovery_query("類似の研究はありますか") == True
        assert service.is_research_discovery_query("関連する研究を探してください") == True
        assert service.is_research_discovery_query("他に同じような研究はあるか") == True
        assert service.is_research_discovery_query("社内で類似の事例はありますか") == True
        assert service.is_research_discovery_query("どんな研究が行われていますか") == True

        # Should NOT detect regular queries
        assert service.is_research_discovery_query("この実験結果を説明して") == False
        assert service.is_research_discovery_query("D2PDの見積書を見せて") == False
        assert service.is_research_discovery_query("委託先はどこですか") == False

    @pytest.mark.asyncio
    async def test_search_routes_to_summary_for_discovery_query(self):
        """Test search routes to oipf-summary for research discovery queries even on follow-up"""
        from app.services.internal_research_search import InternalResearchSearchService

        service = InternalResearchSearchService()
        service._cache_loaded = True
        service._known_research_ids = set()  # Empty cache

        with patch.object(service, 'search_initial', new_callable=AsyncMock) as mock_initial:
            with patch.object(service, 'search_followup', new_callable=AsyncMock) as mock_followup:
                mock_initial.return_value = []
                mock_followup.return_value = []

                # Follow-up query (chat_history has messages) but is a discovery query
                chat_history = [
                    {"role": "user", "content": "最初の質問"},
                    {"role": "assistant", "content": "回答"},
                    {"role": "user", "content": "過去に類似の研究はありますか"},
                ]

                await service.search("過去に類似の研究はありますか", chat_history=chat_history)

                # Should call search_initial (oipf-summary) even though it's a follow-up
                mock_initial.assert_called_once()
                mock_followup.assert_not_called()


# ============================================================================
# InternalResearchResult Tests
# ============================================================================

class TestInternalResearchResult:
    """Test InternalResearchResult dataclass"""

    def test_result_creation(self):
        """Test InternalResearchResult can be created"""
        from app.services.internal_research_search import InternalResearchResult

        result = InternalResearchResult(
            title="Test Research",
            tags=["AI", "ML"],
            similarity=0.95,
            year="2024",
            research_id="TEST",
            abstract="This is a test abstract",
            file_path="/path/to/file.pdf"
        )

        assert result.title == "Test Research"
        assert result.tags == ["AI", "ML"]
        assert result.similarity == 0.95
        assert result.year == "2024"
        assert result.research_id == "TEST"
        assert result.abstract == "This is a test abstract"
        assert result.file_path == "/path/to/file.pdf"

    def test_result_defaults(self):
        """Test InternalResearchResult default values"""
        from app.services.internal_research_search import InternalResearchResult

        result = InternalResearchResult(
            title="Test",
            tags=[],
            similarity=0.5,
            year="2024"
        )

        assert result.research_id == ""
        assert result.abstract == ""
        assert result.file_path == ""


# ============================================================================
# Integration Tests (Mock External Services)
# ============================================================================

class TestSearchModeIntegration:
    """Integration tests for search mode with mocked services"""

    @pytest.mark.asyncio
    async def test_search_mode_uses_opensearch_when_configured(self):
        """Test that search mode uses OpenSearch when configured

        Default routing goes to oipf-details (search_followup)
        """
        from app.services.internal_research_search import InternalResearchSearchService, InternalResearchResult

        service = InternalResearchSearchService()

        # Mock the search_followup method (default routing is oipf-details)
        expected_results = [
            InternalResearchResult(
                title="Internal research about AI",
                tags=["AI", "2024"],
                similarity=0.9,
                year="2024",
                research_id="INT1",
                abstract="Internal research about AI",
                source_type="details",
            )
        ]

        with patch.object(service, 'search_followup', new_callable=AsyncMock) as mock_search:
            mock_search.return_value = expected_results

            results = await service.search("AI research", chat_history=None)

            mock_search.assert_called_once()
            assert len(results) == 1
            assert results[0].research_id == "INT1"
            assert results[0].title == "Internal research about AI"


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
