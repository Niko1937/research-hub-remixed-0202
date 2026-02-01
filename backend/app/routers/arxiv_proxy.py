"""
arXiv Proxy Router

arXiv APIへのプロキシエンドポイント
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings

router = APIRouter()


def _get_httpx_kwargs(timeout: float = 30.0) -> dict:
    """Get httpx.AsyncClient kwargs including proxy if configured"""
    kwargs = {"timeout": timeout, "follow_redirects": True}
    if settings.proxy_enabled and settings.proxy_url:
        kwargs["proxy"] = settings.proxy_url
    return kwargs


class ArxivSearchRequest(BaseModel):
    searchQuery: str
    maxResults: int = 10


class ArxivSearchResponse(BaseModel):
    xmlData: str


@router.post("")
@router.post("/")
async def arxiv_proxy(request: ArxivSearchRequest) -> ArxivSearchResponse:
    """
    arXiv APIへのプロキシ
    CORSの問題を回避するために使用
    """

    params = {
        "search_query": f"all:{request.searchQuery}",
        "start": 0,
        "max_results": request.maxResults,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    async with httpx.AsyncClient(**_get_httpx_kwargs(timeout=30.0)) as client:
        response = await client.get(
            "https://export.arxiv.org/api/query",
            params=params,
        )
        response.raise_for_status()

    return ArxivSearchResponse(xmlData=response.text)
