"""
FastAPI Backend Application

Research Hub API Server
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import research_chat, research_chat_v1, arxiv_proxy, pdf_proxy, expert_network_graph
from app.services.internal_research_search import internal_research_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.
    - Startup: Load research_ids cache from OpenSearch
    - Shutdown: Cleanup resources
    """
    # Startup
    print("[Startup] Loading research_ids cache...")
    await internal_research_service.load_research_ids_cache()
    cache_status = internal_research_service.get_cache_status()
    print(f"[Startup] Research ID cache: {cache_status['count']} IDs loaded")

    yield

    # Shutdown
    print("[Shutdown] Cleaning up...")


app = FastAPI(
    title="Research Hub API",
    description="Research Hub Backend API - FastAPI Version",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Research Hub API is running",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


# Register routers
app.include_router(
    research_chat.router,
    prefix="/api/research-chat",
    tags=["research-chat"],
)

# V1 API (Legacy) - preserved for backward compatibility
app.include_router(
    research_chat_v1.router,
    prefix="/api-v1/research-chat",
    tags=["research-chat-v1"],
)

app.include_router(
    arxiv_proxy.router,
    prefix="/api/arxiv-proxy",
    tags=["arxiv-proxy"],
)

app.include_router(
    pdf_proxy.router,
    prefix="/api/pdf-proxy",
    tags=["pdf-proxy"],
)

app.include_router(
    expert_network_graph.router,
    prefix="/api/expert-network",
    tags=["expert-network"],
)


if __name__ == "__main__":
    import uvicorn

    print(f"""
╔════════════════════════════════════════════╗
║     Research Hub API Server                ║
╠════════════════════════════════════════════╣
║  Status: Starting...                       ║
║  Port:   {settings.port}                              ║
║  API:    http://localhost:{settings.port}/api         ║
╚════════════════════════════════════════════╝
    """)
    print("Environment:")
    print(f"  LLM_BASE_URL: {settings.llm_base_url or 'NOT SET'}")
    print(f"  LLM_MODEL:    {settings.llm_model or 'NOT SET'}")
    print(f"  LLM_API_KEY:  {'SET' if settings.llm_api_key else 'NOT SET'}")
    print("")
    print("OpenSearch Configuration:")
    print(f"  OPENSEARCH_URL:      {settings.opensearch_url or 'NOT SET'}")
    print(f"  OPENSEARCH_USERNAME: {'SET' if settings.opensearch_username else 'NOT SET'}")
    print(f"  OPENSEARCH_PASSWORD: {'SET' if settings.opensearch_password else 'NOT SET'}")
    print(f"  Status: {'CONFIGURED' if settings.is_opensearch_configured() else 'NOT CONFIGURED'}")
    print("")
    print("Embedding Configuration:")
    print(f"  EMBEDDING_API_URL: {settings.embedding_api_url or 'NOT SET'}")
    print(f"  EMBEDDING_API_KEY: {'SET' if settings.embedding_api_key else 'NOT SET'}")
    print(f"  EMBEDDING_MODEL:   {settings.embedding_model}")
    print(f"  Status: {'CONFIGURED' if settings.is_embedding_configured() else 'NOT CONFIGURED'}")
    print("")
    print("Internal Research Search:")
    opensearch_ready = settings.is_opensearch_configured() and settings.is_embedding_configured()
    print(f"  Status: {'ENABLED (OpenSearch)' if opensearch_ready else 'DISABLED (Mock Data)'}")

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
