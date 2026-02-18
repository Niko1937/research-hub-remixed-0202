"""Tests for expert network graph thin API.

These tests focus on parameter resolution and error mapping.
"""

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

from app.routers.expert_network_graph import get_expert_network_graph


@pytest.mark.asyncio
async def test_missing_graph_id_returns_400():
    with patch.dict(os.environ, {"OS_ENDPOINT": "https://localhost:9200", "OS_USERNAME": "u", "OS_PASSWORD": "p"}, clear=False):
        with pytest.raises(HTTPException) as exc:
            await get_expert_network_graph(graphId=None, queryId=None, centerId=None)
        assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_query_and_center_build_graph_id_and_return_graph():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json = MagicMock(return_value={"_source": {"graph": {"nodes": [], "edges": []}}})

    with patch.dict(os.environ, {"OS_ENDPOINT": "https://localhost:9200", "OS_USERNAME": "u", "OS_PASSWORD": "p"}, clear=False):
        with patch("app.routers.expert_network_graph.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await get_expert_network_graph(graphId=None, queryId="Q-0001", centerId="E001")

            assert result == {"nodes": [], "edges": []}
            assert mock_client.get.call_count == 1
            called_url = mock_client.get.call_args.args[0]
            # Ensure ':' is URL-encoded
            assert "Q-0001%3AE001" in called_url


@pytest.mark.asyncio
async def test_not_found_maps_to_404():
    mock_response = MagicMock()
    mock_response.status_code = 404

    with patch.dict(os.environ, {"OS_ENDPOINT": "https://localhost:9200", "OS_USERNAME": "u", "OS_PASSWORD": "p"}, clear=False):
        with patch("app.routers.expert_network_graph.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            with pytest.raises(HTTPException) as exc:
                await get_expert_network_graph(graphId="Q-0001:E001", queryId=None, centerId=None)
            assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_auth_failure_maps_to_502():
    mock_response = MagicMock()
    mock_response.status_code = 401

    with patch.dict(os.environ, {"OS_ENDPOINT": "https://localhost:9200", "OS_USERNAME": "u", "OS_PASSWORD": "p"}, clear=False):
        with patch("app.routers.expert_network_graph.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            with pytest.raises(HTTPException) as exc:
                await get_expert_network_graph(graphId="Q-0001:E001", queryId=None, centerId=None)
            assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_missing_env_vars_returns_500_with_names():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(HTTPException) as exc:
            await get_expert_network_graph(graphId="Q-0001:E001", queryId=None, centerId=None)
        assert exc.value.status_code == 500
        assert "OS_ENDPOINT" in str(exc.value.detail)
        assert "OS_USERNAME" in str(exc.value.detail)
        assert "OS_PASSWORD" in str(exc.value.detail)
