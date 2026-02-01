"""
Tests for common/config.py
"""

import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.config import (
    ProxyConfig,
    OpenSearchConfig,
    EmbeddingConfig,
    LLMConfig,
    Config,
)


class TestProxyConfig:
    """Tests for ProxyConfig"""

    def test_default_values(self):
        """Test default proxy config values"""
        config = ProxyConfig()
        assert config.enabled is False
        assert config.url == ""

    def test_get_httpx_kwargs_disabled(self):
        """Test httpx kwargs when proxy is disabled"""
        config = ProxyConfig(enabled=False, url="http://proxy.example.com:8080")
        kwargs = config.get_httpx_kwargs()
        assert "proxy" not in kwargs

    def test_get_httpx_kwargs_enabled(self):
        """Test httpx kwargs when proxy is enabled"""
        config = ProxyConfig(enabled=True, url="http://proxy.example.com:8080")
        kwargs = config.get_httpx_kwargs()
        assert kwargs["proxy"] == "http://proxy.example.com:8080"

    def test_get_httpx_kwargs_enabled_no_url(self):
        """Test httpx kwargs when proxy is enabled but URL is empty"""
        config = ProxyConfig(enabled=True, url="")
        kwargs = config.get_httpx_kwargs()
        assert "proxy" not in kwargs


class TestOpenSearchConfig:
    """Tests for OpenSearchConfig"""

    def test_default_values(self):
        """Test default OpenSearch config values"""
        config = OpenSearchConfig()
        assert config.url == ""
        assert config.username == ""
        assert config.password == ""
        assert config.verify_ssl is False

    def test_auth_with_credentials(self):
        """Test auth tuple when credentials are provided"""
        config = OpenSearchConfig(username="admin", password="secret")
        assert config.auth == ("admin", "secret")

    def test_auth_without_credentials(self):
        """Test auth tuple when credentials are not provided"""
        config = OpenSearchConfig()
        assert config.auth is None

    def test_auth_partial_credentials(self):
        """Test auth tuple when only username is provided"""
        config = OpenSearchConfig(username="admin", password="")
        assert config.auth is None

    def test_is_configured(self):
        """Test is_configured method"""
        config = OpenSearchConfig()
        assert config.is_configured() is False

        config = OpenSearchConfig(url="https://localhost:9200")
        assert config.is_configured() is True


class TestEmbeddingConfig:
    """Tests for EmbeddingConfig"""

    def test_default_values(self):
        """Test default embedding config values"""
        config = EmbeddingConfig()
        assert config.model == "text-embedding-3-large"
        assert config.dimensions == 1024
        assert config.batch_size == 10
        assert config.timeout == 60

    def test_is_configured(self):
        """Test is_configured method"""
        config = EmbeddingConfig()
        assert config.is_configured() is False

        config = EmbeddingConfig(api_url="https://api.example.com", api_key="key")
        assert config.is_configured() is True

        config = EmbeddingConfig(api_url="https://api.example.com", api_key="")
        assert config.is_configured() is False


class TestLLMConfig:
    """Tests for LLMConfig"""

    def test_default_values(self):
        """Test default LLM config values"""
        config = LLMConfig()
        assert config.model == "vertex_ai.gemini-2.5-flash"
        assert config.timeout == 60

    def test_is_configured(self):
        """Test is_configured method"""
        config = LLMConfig()
        assert config.is_configured() is False

        config = LLMConfig(base_url="https://api.example.com", api_key="key")
        assert config.is_configured() is True


class TestConfig:
    """Tests for main Config class"""

    def test_validate_unconfigured(self):
        """Test validation returns errors for unconfigured services"""
        config = Config(
            proxy=ProxyConfig(),
            opensearch=OpenSearchConfig(),
            embedding=EmbeddingConfig(),
            llm=LLMConfig(),
        )
        errors = config.validate()
        assert len(errors) == 3  # OpenSearch, Embedding, LLM
        assert any("OpenSearch" in e for e in errors)
        assert any("Embedding" in e for e in errors)
        assert any("LLM" in e for e in errors)

    def test_validate_configured(self):
        """Test validation returns no errors when configured"""
        config = Config(
            proxy=ProxyConfig(),
            opensearch=OpenSearchConfig(url="https://localhost:9200"),
            embedding=EmbeddingConfig(api_url="https://api.example.com", api_key="key"),
            llm=LLMConfig(base_url="https://api.example.com", api_key="key"),
        )
        errors = config.validate()
        assert len(errors) == 0
