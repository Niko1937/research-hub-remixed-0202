"""
arXiv Proxy Router

arXiv APIへのプロキシエンドポイント
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


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

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(
            "https://export.arxiv.org/api/query",
            params=params,
            timeout=30.0,
        )
        response.raise_for_status()

    return ArxivSearchResponse(xmlData=response.text)
