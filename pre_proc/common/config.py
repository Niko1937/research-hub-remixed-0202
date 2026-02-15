"""
Pre-proc Common Configuration

前処理スクリプト共通の設定管理
環境変数からプロキシ、OpenSearch、エンベディング設定を読み込む
"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv


# Load .env from project root
def _find_and_load_env():
    """Find and load .env file from project root"""
    current = Path(__file__).resolve()
    # Search upward for .env
    for parent in [current.parent, *current.parents]:
        env_file = parent / ".env"
        if env_file.exists():
            load_dotenv(env_file)
            print(f"Loaded .env from: {env_file}")
            return env_file
    print("Warning: .env file not found")
    return None


_find_and_load_env()


@dataclass
class ProxyConfig:
    """Proxy configuration"""
    enabled: bool = False
    url: str = ""

    @classmethod
    def from_env(cls) -> "ProxyConfig":
        return cls(
            enabled=os.getenv("PROXY_ENABLED", "false").lower() == "true",
            url=os.getenv("PROXY_URL", ""),
        )

    def get_httpx_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {}
        if self.enabled and self.url:
            kwargs["proxy"] = self.url
        return kwargs


@dataclass
class OpenSearchConfig:
    """OpenSearch configuration"""
    url: str = ""
    username: str = ""
    password: str = ""
    verify_ssl: bool = False
    proxy_enabled: bool = False
    proxy_url: str = ""

    @classmethod
    def from_env(cls) -> "OpenSearchConfig":
        return cls(
            url=os.getenv("OPENSEARCH_URL", "").rstrip("/"),
            username=os.getenv("OPENSEARCH_USERNAME", ""),
            password=os.getenv("OPENSEARCH_PASSWORD", ""),
            verify_ssl=os.getenv("OPENSEARCH_VERIFY_SSL", "false").lower() == "true",
            proxy_enabled=os.getenv("OPENSEARCH_PROXY_ENABLED", "false").lower() == "true",
            proxy_url=os.getenv("OPENSEARCH_PROXY_URL", ""),
        )

    @property
    def auth(self) -> Optional[tuple[str, str]]:
        """Get auth tuple if credentials are configured"""
        if self.username and self.password:
            return (self.username, self.password)
        return None

    def is_configured(self) -> bool:
        """Check if OpenSearch is properly configured"""
        return bool(self.url)

    def get_httpx_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {}
        if self.proxy_enabled and self.proxy_url:
            kwargs["proxy"] = self.proxy_url
        return kwargs


@dataclass
class EmbeddingConfig:
    """Embedding API configuration"""
    api_url: str = ""
    api_key: str = ""
    model: str = "text-embedding-3-large"
    dimensions: int = 1024
    batch_size: int = 10
    timeout: int = 60
    proxy_enabled: bool = False
    proxy_url: str = ""

    @classmethod
    def from_env(cls) -> "EmbeddingConfig":
        return cls(
            api_url=os.getenv("EMBEDDING_API_URL", "").rstrip("/"),
            api_key=os.getenv("EMBEDDING_API_KEY", ""),
            model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-large"),
            dimensions=int(os.getenv("EMBEDDING_DIMENSIONS", "1024")),
            batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "10")),
            timeout=int(os.getenv("EMBEDDING_TIMEOUT", "60")),
            proxy_enabled=os.getenv("EMBEDDING_PROXY_ENABLED", "false").lower() == "true",
            proxy_url=os.getenv("EMBEDDING_PROXY_URL", ""),
        )

    def is_configured(self) -> bool:
        """Check if embedding API is properly configured"""
        return bool(self.api_url and self.api_key)

    def get_httpx_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {}
        if self.proxy_enabled and self.proxy_url:
            kwargs["proxy"] = self.proxy_url
        return kwargs


@dataclass
class LLMConfig:
    """LLM API configuration (for summarization, tag extraction)"""
    base_url: str = ""
    api_key: str = ""
    model: str = "vertex_ai.gemini-2.5-flash"
    timeout: int = 60
    proxy_enabled: bool = False
    proxy_url: str = ""

    @classmethod
    def from_env(cls) -> "LLMConfig":
        return cls(
            base_url=os.getenv("LLM_BASE_URL", "").rstrip("/"),
            api_key=os.getenv("LLM_API_KEY", ""),
            model=os.getenv("LLM_MODEL", "vertex_ai.gemini-2.5-flash"),
            timeout=int(os.getenv("LLM_TIMEOUT", "60")),
            proxy_enabled=os.getenv("LLM_PROXY_ENABLED", "false").lower() == "true",
            proxy_url=os.getenv("LLM_PROXY_URL", ""),
        )

    def is_configured(self) -> bool:
        """Check if LLM API is properly configured"""
        return bool(self.base_url and self.api_key)

    def get_httpx_kwargs(self) -> dict:
        """Get httpx client kwargs with proxy if configured"""
        kwargs = {}
        if self.proxy_enabled and self.proxy_url:
            kwargs["proxy"] = self.proxy_url
        return kwargs


@dataclass
class ProcessingConfig:
    """File processing configuration"""
    max_file_size_mb: float = 100.0  # Default: 100MB
    max_depth: int = 4
    skip_indexed_folders: bool = False  # Skip subfolders that have already been indexed
    embedding_file_types: str = "all"  # "all", "documents", "images"

    @classmethod
    def from_env(cls) -> "ProcessingConfig":
        file_types = os.getenv("EMBEDDING_FILE_TYPES", "all").lower()
        # Validate file_types
        if file_types not in ("all", "documents", "images"):
            print(f"Warning: Invalid EMBEDDING_FILE_TYPES '{file_types}', using 'all'")
            file_types = "all"
        return cls(
            max_file_size_mb=float(os.getenv("MAX_FILE_SIZE_MB", "100.0")),
            max_depth=int(os.getenv("MAX_FOLDER_DEPTH", "4")),
            skip_indexed_folders=os.getenv("SKIP_INDEXED_FOLDERS", "false").lower() == "true",
            embedding_file_types=file_types,
        )

    @property
    def process_documents(self) -> bool:
        """Check if documents should be processed"""
        return self.embedding_file_types in ("all", "documents")

    @property
    def process_images(self) -> bool:
        """Check if images should be processed"""
        return self.embedding_file_types in ("all", "images")


@dataclass
class Config:
    """Main configuration container"""
    proxy: ProxyConfig = field(default_factory=ProxyConfig.from_env)
    opensearch: OpenSearchConfig = field(default_factory=OpenSearchConfig.from_env)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig.from_env)
    llm: LLMConfig = field(default_factory=LLMConfig.from_env)
    processing: ProcessingConfig = field(default_factory=ProcessingConfig.from_env)

    @classmethod
    def load(cls) -> "Config":
        """Load configuration from environment"""
        return cls(
            proxy=ProxyConfig.from_env(),
            opensearch=OpenSearchConfig.from_env(),
            embedding=EmbeddingConfig.from_env(),
            llm=LLMConfig.from_env(),
            processing=ProcessingConfig.from_env(),
        )

    def validate(self) -> list[str]:
        """Validate configuration and return list of errors"""
        errors = []

        if not self.opensearch.is_configured():
            errors.append("OpenSearch: OPENSEARCH_URL is not configured")

        if not self.embedding.is_configured():
            errors.append("Embedding: EMBEDDING_API_URL or EMBEDDING_API_KEY is not configured")

        if not self.llm.is_configured():
            errors.append("LLM: LLM_BASE_URL or LLM_API_KEY is not configured")

        return errors

    def print_status(self):
        """Print configuration status"""
        print("\n=== Configuration Status ===")
        print(f"Proxy: {'Enabled' if self.proxy.enabled else 'Disabled'}")
        if self.proxy.enabled:
            print(f"  URL: {self.proxy.url}")

        print(f"OpenSearch: {'Configured' if self.opensearch.is_configured() else 'NOT CONFIGURED'}")
        if self.opensearch.is_configured():
            print(f"  URL: {self.opensearch.url}")
            print(f"  Proxy: {'Enabled (' + self.opensearch.proxy_url + ')' if self.opensearch.proxy_enabled else 'Disabled'}")

        print(f"Embedding: {'Configured' if self.embedding.is_configured() else 'NOT CONFIGURED'}")
        if self.embedding.is_configured():
            print(f"  Model: {self.embedding.model}")
            print(f"  Dimensions: {self.embedding.dimensions}")
            print(f"  Proxy: {'Enabled (' + self.embedding.proxy_url + ')' if self.embedding.proxy_enabled else 'Disabled'}")

        print(f"LLM: {'Configured' if self.llm.is_configured() else 'NOT CONFIGURED'}")
        if self.llm.is_configured():
            print(f"  Model: {self.llm.model}")
            print(f"  Proxy: {'Enabled (' + self.llm.proxy_url + ')' if self.llm.proxy_enabled else 'Disabled'}")

        print(f"Processing:")
        print(f"  Max File Size: {self.processing.max_file_size_mb}MB")
        print(f"  Max Folder Depth: {self.processing.max_depth}")
        print(f"  Embedding File Types: {self.processing.embedding_file_types}")
        print("=" * 28 + "\n")


# Global config instance
config = Config.load()
