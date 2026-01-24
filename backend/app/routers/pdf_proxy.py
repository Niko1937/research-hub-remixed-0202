"""
PDF Proxy Router

PDFファイルのプロキシエンドポイント
CORSを回避するために使用
"""

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()


@router.get("")
@router.get("/")
async def pdf_proxy(url: str):
    """
    PDFファイルのプロキシ

    Query params:
        url: PDFのURL
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Only allow arxiv PDFs for security
    allowed_domains = ["arxiv.org", "export.arxiv.org"]
    if not any(domain in url for domain in allowed_domains):
        raise HTTPException(status_code=403, detail="Only arXiv PDFs are allowed")

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, timeout=60.0)
            response.raise_for_status()

        return Response(
            content=response.content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline",
                "Access-Control-Allow-Origin": "*",
            },
        )

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
