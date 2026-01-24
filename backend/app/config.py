"""
Application Configuration

環境変数から設定を読み込む
"""

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from project root
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env"
if env_file.exists():
    load_dotenv(env_file)


class Settings(BaseSettings):
    """Application settings"""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # LLM Configuration
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "vertex_ai.gemini-2.5-flash"
    llm_timeout: int = 60

    class Config:
        env_prefix = ""
        case_sensitive = False

        # Map environment variable names
        fields = {
            "llm_base_url": {"env": "LLM_BASE_URL"},
            "llm_api_key": {"env": "LLM_API_KEY"},
            "llm_model": {"env": "LLM_MODEL"},
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
