"""Expert Network Graph API

Thin read-only endpoint to fetch precomputed GraphData from OpenSearch (Index2).

Requirements:
- Read OpenSearch endpoint and Basic auth from env vars (OS_ENDPOINT, OS_USERNAME, OS_PASSWORD)
- Support self-signed TLS by disabling certificate verification (verify=False)
- Return only `_source.graph` without transformation
"""

from __future__ import annotations

import os
from typing import Any, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()

_INDEX_NAME = "expert_network_graph"


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise KeyError(name)
    return value


def _get_opensearch_config() -> tuple[str, str, str]:
    missing: list[str] = []

    def _get(name: str) -> Optional[str]:
        value = os.getenv(name)
        if value is None or value.strip() == "":
            missing.append(name)
            return None
        return value

    endpoint = _get("OS_ENDPOINT")
    username = _get("OS_USERNAME")
    password = _get("OS_PASSWORD")

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required env vars: {', '.join(missing)}",
        )

    # mypy: values are not None here
    return endpoint, username, password  # type: ignore[return-value]


def _resolve_graph_id(
    graph_id: Optional[str],
    query_id: Optional[str],
    center_id: Optional[str],
) -> str:
    if graph_id and graph_id.strip():
        return graph_id.strip()

    if (query_id and query_id.strip()) and (center_id and center_id.strip()):
        return f"{query_id.strip()}:{center_id.strip()}"

    raise HTTPException(
        status_code=400,
        detail="graphId is required (or specify queryId and centerId)",
    )


@router.get("/graph")
async def get_expert_network_graph(
    graphId: Optional[str] = Query(default=None),
    queryId: Optional[str] = Query(default=None),
    centerId: Optional[str] = Query(default=None),
) -> Any:
    """Fetch GraphData from OpenSearch and return it as-is."""

    resolved_graph_id = _resolve_graph_id(graphId, queryId, centerId)
    endpoint, username, password = _get_opensearch_config()

    doc_id = quote(resolved_graph_id, safe="")
    url = f"{endpoint.rstrip('/')}/{_INDEX_NAME}/_doc/{doc_id}"

    try:
        async with httpx.AsyncClient(
            verify=False,
            auth=(username, password),
            timeout=httpx.Timeout(30.0),
        ) as client:
            response = await client.get(url, params={"_source": "graph"})

        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Graph not found")
        if response.status_code in (401, 403):
            raise HTTPException(status_code=502, detail="OpenSearch authentication failed")
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="OpenSearch request failed")

        payload = response.json()
        graph = (payload.get("_source") or {}).get("graph")
        if graph is None:
            raise HTTPException(status_code=502, detail="Invalid OpenSearch response")

        return graph

    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="OpenSearch unavailable")
    except ValueError:
        # JSON parse error
        raise HTTPException(status_code=502, detail="Invalid OpenSearch response")
