"""
Test AWS Bedrock provider functionality for LLM and Embedding APIs
"""

import asyncio
import json
from unittest.mock import patch, MagicMock, AsyncMock
from io import BytesIO
import sys
import os

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)


# ============================================================
# LLM Client Tests
# ============================================================

def test_llm_client_openai_provider_validation():
    """OpenAI provider should require BASE_URL and API_KEY"""
    print("[Test 1] LLM Client - OpenAI provider validation")

    from app.services.llm_client import LLMClient

    mock_settings = MagicMock()
    mock_settings.llm_provider = "openai"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "gpt-4"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        try:
            client = LLMClient()
            assert False, "Should raise ValueError for missing BASE_URL/API_KEY"
        except ValueError as e:
            assert "LLM_BASE_URL and LLM_API_KEY" in str(e)
            print("✓ Raises ValueError when BASE_URL/API_KEY missing for OpenAI")


def test_llm_client_bedrock_provider_validation():
    """Bedrock provider should require MODEL only"""
    print("[Test 2] LLM Client - Bedrock provider validation")

    from app.services.llm_client import LLMClient

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = ""
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        try:
            client = LLMClient()
            assert False, "Should raise ValueError for missing MODEL"
        except ValueError as e:
            assert "LLM_MODEL must be set" in str(e)
            print("✓ Raises ValueError when MODEL missing for Bedrock")


def test_llm_client_bedrock_initialization():
    """Bedrock provider should initialize without BASE_URL/API_KEY"""
    print("[Test 3] LLM Client - Bedrock initialization")

    from app.services.llm_client import LLMClient

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "anthropic.claude-3-sonnet-20240229-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        client = LLMClient()
        assert client.provider == "bedrock"
        assert client.model == "anthropic.claude-3-sonnet-20240229-v1:0"
        print("✓ Bedrock client initializes correctly without API key")


async def test_llm_client_bedrock_claude_completion():
    """Test Bedrock Claude model completion"""
    print("[Test 4] LLM Client - Bedrock Claude completion")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "anthropic.claude-3-sonnet-20240229-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Mock Bedrock response
    mock_response_body = {
        "id": "msg_123",
        "content": [{"text": "Hello! I'm Claude."}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 10, "output_tokens": 5}
    }

    mock_boto_response = {
        "body": BytesIO(json.dumps(mock_response_body).encode())
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.return_value = mock_boto_response

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]
            response = await client.chat_completion(messages)

            assert response.content == "Hello! I'm Claude."
            assert response.model == "anthropic.claude-3-sonnet-20240229-v1:0"
            assert response.finish_reason == "end_turn"
            print("✓ Claude model returns expected response")


async def test_llm_client_bedrock_titan_completion():
    """Test Bedrock Titan model completion"""
    print("[Test 5] LLM Client - Bedrock Titan completion")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "amazon.titan-text-premier-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Mock Titan response
    mock_response_body = {
        "results": [
            {"outputText": "Hello from Titan!", "completionReason": "FINISH"}
        ]
    }

    mock_boto_response = {
        "body": BytesIO(json.dumps(mock_response_body).encode())
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.return_value = mock_boto_response

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]
            response = await client.chat_completion(messages)

            assert response.content == "Hello from Titan!"
            assert response.model == "amazon.titan-text-premier-v1:0"
            print("✓ Titan model returns expected response")


async def test_llm_client_bedrock_llama_completion():
    """Test Bedrock Llama model completion"""
    print("[Test 6] LLM Client - Bedrock Llama completion")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "meta.llama3-70b-instruct-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Mock Llama response
    mock_response_body = {
        "generation": "Hello from Llama!",
        "stop_reason": "stop"
    }

    mock_boto_response = {
        "body": BytesIO(json.dumps(mock_response_body).encode())
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.return_value = mock_boto_response

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]
            response = await client.chat_completion(messages)

            assert response.content == "Hello from Llama!"
            assert response.model == "meta.llama3-70b-instruct-v1:0"
            print("✓ Llama model returns expected response")


async def test_llm_client_bedrock_converse_api():
    """Test Bedrock Converse API for unsupported models"""
    print("[Test 7] LLM Client - Bedrock Converse API fallback")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "some.other-model-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Mock Converse API response
    mock_converse_response = {
        "ResponseMetadata": {"RequestId": "req_123"},
        "output": {
            "message": {
                "content": [{"text": "Hello from Converse API!"}]
            }
        },
        "stopReason": "end_turn",
        "usage": {"inputTokens": 10, "outputTokens": 5}
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.converse.return_value = mock_converse_response

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]
            response = await client.chat_completion(messages)

            assert response.content == "Hello from Converse API!"
            print("✓ Converse API fallback works correctly")


async def test_llm_client_bedrock_streaming():
    """Test Bedrock streaming completion"""
    print("[Test 8] LLM Client - Bedrock streaming")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "bedrock"
    mock_settings.llm_base_url = ""
    mock_settings.llm_api_key = ""
    mock_settings.llm_model = "anthropic.claude-3-sonnet-20240229-v1:0"
    mock_settings.llm_aws_region = "ap-northeast-1"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    # Mock streaming events
    mock_stream_events = [
        {"contentBlockDelta": {"delta": {"text": "Hello"}}},
        {"contentBlockDelta": {"delta": {"text": " "}}},
        {"contentBlockDelta": {"delta": {"text": "World"}}},
    ]

    mock_converse_response = {
        "stream": iter(mock_stream_events)
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.converse_stream.return_value = mock_converse_response

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]

            chunks = []
            async for chunk in client.chat_completion_stream(messages):
                chunks.append(chunk)

            # Check we got SSE formatted chunks
            assert len(chunks) > 0
            assert "data:" in chunks[0]
            assert chunks[-1] == "data: [DONE]\n\n"
            print("✓ Streaming returns SSE formatted chunks")


async def test_llm_client_openai_completion():
    """Test OpenAI provider still works"""
    print("[Test 9] LLM Client - OpenAI provider completion")

    from app.services.llm_client import LLMClient, ChatMessage

    mock_settings = MagicMock()
    mock_settings.llm_provider = "openai"
    mock_settings.llm_base_url = "https://api.example.com"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_model = "gpt-4"
    mock_settings.proxy_enabled = False
    mock_settings.proxy_url = ""

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": "chatcmpl-123",
        "model": "gpt-4",
        "choices": [
            {
                "message": {"content": "Hello from OpenAI!"},
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5}
    }

    with patch('app.services.llm_client.get_settings', return_value=mock_settings):
        with patch('httpx.AsyncClient') as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            client = LLMClient()
            messages = [
                ChatMessage(role="user", content="Hello!")
            ]
            response = await client.chat_completion(messages)

            assert response.content == "Hello from OpenAI!"
            assert response.model == "gpt-4"
            print("✓ OpenAI provider still works correctly")


# ============================================================
# Embedding Client Tests
# ============================================================

def test_embedding_client_openai_configuration():
    """OpenAI provider should require API_URL and API_KEY"""
    print("[Test 10] Embedding Client - OpenAI configuration check")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "openai"
    mock_settings.embedding_api_url = ""
    mock_settings.embedding_api_key = ""
    mock_settings.embedding_model = "text-embedding-3-large"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""

    mock_settings.is_embedding_configured.return_value = False

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        client = EmbeddingClient()
        assert client.is_configured == False
        print("✓ OpenAI provider requires API_URL and API_KEY")


def test_embedding_client_bedrock_configuration():
    """Bedrock provider should not require API_URL/API_KEY"""
    print("[Test 11] Embedding Client - Bedrock configuration check")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "bedrock"
    mock_settings.embedding_model = "amazon.titan-embed-text-v2:0"
    mock_settings.embedding_aws_region = "ap-northeast-1"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""

    mock_settings.is_embedding_configured.return_value = True

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        client = EmbeddingClient()
        assert client.is_configured == True
        assert client.provider == "bedrock"
        print("✓ Bedrock provider configured without API key")


async def test_embedding_client_bedrock_titan():
    """Test Bedrock Titan embedding"""
    print("[Test 12] Embedding Client - Bedrock Titan embedding")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "bedrock"
    mock_settings.embedding_model = "amazon.titan-embed-text-v2:0"
    mock_settings.embedding_aws_region = "ap-northeast-1"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""
    mock_settings.is_embedding_configured.return_value = True

    # Mock Titan embedding response
    mock_embedding = [0.1] * 1024
    mock_response_body = {
        "embedding": mock_embedding
    }

    mock_boto_response = {
        "body": BytesIO(json.dumps(mock_response_body).encode())
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.return_value = mock_boto_response

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = EmbeddingClient()
            embedding = await client.embed_text("Test text")

            assert len(embedding) == 1024
            assert embedding == mock_embedding
            print("✓ Titan embedding returns expected vector")


async def test_embedding_client_bedrock_cohere():
    """Test Bedrock Cohere embedding"""
    print("[Test 13] Embedding Client - Bedrock Cohere embedding")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "bedrock"
    mock_settings.embedding_model = "cohere.embed-english-v3"
    mock_settings.embedding_aws_region = "ap-northeast-1"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""
    mock_settings.is_embedding_configured.return_value = True

    # Mock Cohere embedding response
    mock_embedding = [0.2] * 1024
    mock_response_body = {
        "embeddings": [mock_embedding]
    }

    mock_boto_response = {
        "body": BytesIO(json.dumps(mock_response_body).encode())
    }

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.return_value = mock_boto_response

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = EmbeddingClient()
            embedding = await client.embed_text("Test text")

            assert len(embedding) == 1024
            assert embedding == mock_embedding
            print("✓ Cohere embedding returns expected vector")


async def test_embedding_client_bedrock_batch():
    """Test Bedrock batch embedding"""
    print("[Test 14] Embedding Client - Bedrock batch embedding")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "bedrock"
    mock_settings.embedding_model = "amazon.titan-embed-text-v2:0"
    mock_settings.embedding_aws_region = "ap-northeast-1"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""
    mock_settings.is_embedding_configured.return_value = True

    # Mock responses for batch (called sequentially for Bedrock)
    mock_embeddings = [[0.1] * 1024, [0.2] * 1024, [0.3] * 1024]
    call_count = [0]

    def mock_invoke_model(**kwargs):
        response_body = {"embedding": mock_embeddings[call_count[0]]}
        call_count[0] += 1
        return {"body": BytesIO(json.dumps(response_body).encode())}

    mock_bedrock_client = MagicMock()
    mock_bedrock_client.invoke_model.side_effect = mock_invoke_model

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        with patch('boto3.client', return_value=mock_bedrock_client):
            client = EmbeddingClient()
            embeddings = await client.embed_texts(["Text 1", "Text 2", "Text 3"])

            assert len(embeddings) == 3
            assert embeddings[0] == mock_embeddings[0]
            assert embeddings[1] == mock_embeddings[1]
            assert embeddings[2] == mock_embeddings[2]
            print("✓ Batch embedding returns multiple vectors")


async def test_embedding_client_openai():
    """Test OpenAI provider still works"""
    print("[Test 15] Embedding Client - OpenAI provider")

    from app.services.embedding_client import EmbeddingClient

    mock_settings = MagicMock()
    mock_settings.embedding_provider = "openai"
    mock_settings.embedding_api_url = "https://api.example.com"
    mock_settings.embedding_api_key = "test-key"
    mock_settings.embedding_model = "text-embedding-3-large"
    mock_settings.embedding_dimensions = 1024
    mock_settings.embedding_timeout = 60
    mock_settings.embedding_proxy_enabled = False
    mock_settings.embedding_proxy_url = ""
    mock_settings.is_embedding_configured.return_value = True

    mock_embedding = [0.5] * 1024
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [{"embedding": mock_embedding, "index": 0}]
    }
    mock_response.raise_for_status = MagicMock()

    with patch('app.services.embedding_client.get_settings', return_value=mock_settings):
        client = EmbeddingClient()
        client._client = MagicMock()
        client._client.post = AsyncMock(return_value=mock_response)

        embedding = await client._embed_text_openai("Test text")

        assert len(embedding) == 1024
        assert embedding == mock_embedding
        print("✓ OpenAI provider still works correctly")


# ============================================================
# Main
# ============================================================

async def main():
    print("=" * 60)
    print("Testing AWS Bedrock Provider Functionality")
    print("=" * 60)
    print()

    print("-" * 60)
    print("LLM Client Tests")
    print("-" * 60)
    print()

    test_llm_client_openai_provider_validation()
    print()
    test_llm_client_bedrock_provider_validation()
    print()
    test_llm_client_bedrock_initialization()
    print()
    await test_llm_client_bedrock_claude_completion()
    print()
    await test_llm_client_bedrock_titan_completion()
    print()
    await test_llm_client_bedrock_llama_completion()
    print()
    await test_llm_client_bedrock_converse_api()
    print()
    await test_llm_client_bedrock_streaming()
    print()
    await test_llm_client_openai_completion()
    print()

    print("-" * 60)
    print("Embedding Client Tests")
    print("-" * 60)
    print()

    test_embedding_client_openai_configuration()
    print()
    test_embedding_client_bedrock_configuration()
    print()
    await test_embedding_client_bedrock_titan()
    print()
    await test_embedding_client_bedrock_cohere()
    print()
    await test_embedding_client_bedrock_batch()
    print()
    await test_embedding_client_openai()

    print()
    print("=" * 60)
    print("All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
