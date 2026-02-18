"""
Application Configuration

環境変数から設定を読み込む
"""

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from project root or parent directory
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env"
if not env_file.exists():
    # Try parent directory (LabApp/.env)
    env_file = project_root.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"Loaded .env from: {env_file}")


class Settings(BaseSettings):
    """Application settings"""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: list[str] = ["http://localhost:8000", "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:8000"]

    # LLM Configuration
    llm_provider: str = "openai"  # "openai" or "bedrock"
    llm_base_url: str = ""  # Required for openai provider
    llm_api_key: str = ""  # Required for openai provider
    llm_model: str = "vertex_ai.gemini-2.5-flash"
    llm_timeout: int = 60
    llm_aws_region: str = "ap-northeast-1"  # Required for bedrock provider

    # Proxy Configuration
    proxy_enabled: bool = False
    proxy_url: str = ""  # e.g., "http://proxy.example.com:8080"

    # OpenSearch Configuration
    opensearch_url: str = ""
    opensearch_username: str = ""
    opensearch_password: str = ""
    opensearch_verify_ssl: bool = False
    opensearch_proxy_enabled: bool = False
    opensearch_proxy_url: str = ""

    # Embedding Configuration
    embedding_provider: str = "openai"  # "openai" or "bedrock"
    embedding_api_url: str = ""  # Required for openai provider
    embedding_api_key: str = ""  # Required for openai provider
    embedding_model: str = "text-embedding-3-large"
    embedding_dimensions: int = 1024
    embedding_timeout: int = 60
    embedding_proxy_enabled: bool = False
    embedding_proxy_url: str = ""
    embedding_aws_region: str = "ap-northeast-1"  # Required for bedrock provider

    # KnowWho Configuration
    knowwho_current_user_id: str = ""  # Current user's employee_id
    knowwho_target_employees: str = ""  # Comma-separated target employee IDs (e.g., "E001,E002,E003")

    # External Search Configuration
    arxiv_enabled: bool = True  # Enable/disable arXiv search

    # Hybrid Vector Search Configuration
    search_mode: str = "hybrid"  # "abstract" | "tags" | "proper_nouns" | "hybrid" | "triple"
    search_abstract_weight: int = 50  # 0-100, weight for abstract embedding search
    search_tags_weight: int = 50  # 0-100, weight for tags embedding search
    search_proper_nouns_weight: int = 0  # 0-100, weight for proper nouns embedding search

    model_config = {
        "env_prefix": "",
        "case_sensitive": False,
    }

    def is_opensearch_configured(self) -> bool:
        """Check if OpenSearch is properly configured"""
        return bool(self.opensearch_url)

    def is_embedding_configured(self) -> bool:
        """Check if Embedding API is properly configured"""
        if self.embedding_provider == "bedrock":
            # Bedrock uses IAM role, no API key needed
            return bool(self.embedding_model and self.embedding_aws_region)
        else:
            # OpenAI-compatible requires URL and API key
            return bool(self.embedding_api_url and self.embedding_api_key)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Module-level settings instance for convenience
settings = get_settings()
