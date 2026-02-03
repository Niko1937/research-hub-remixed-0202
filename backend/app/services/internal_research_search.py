"""
Internal Research Search Service

OpenSearchを使った社内研究検索サービス
- 初回質問: ベクトル類似検索 (oipf-summary)
- 2回目以降: LLMでクエリ生成 (oipf-details)
"""

import json
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings
from app.services.opensearch_client import opensearch_client
from app.services.embedding_client import embedding_client
from app.services.llm_client import LLMClient, get_llm_client


@dataclass
class InternalResearchResult:
    """Internal research search result (compatible with mock data)"""
    title: str
    tags: list[str]
    similarity: float
    year: str
    research_id: str = ""  # oipf_research_id
    abstract: str = ""
    file_path: str = ""


class InternalResearchSearchService:
    """
    OpenSearch-based internal research search service

    - Initial queries: Vector similarity search on oipf-summary
    - Follow-up queries: LLM-generated OpenSearch query on oipf-details
    """

    def __init__(self):
        self.settings = get_settings()

    @property
    def is_configured(self) -> bool:
        """Check if both OpenSearch and Embedding are configured"""
        return (
            opensearch_client.is_configured
            and embedding_client.is_configured
        )

    async def search_initial(
        self,
        query: str,
        limit: int = 10,
    ) -> list[InternalResearchResult]:
        """
        Initial query search using vector similarity on oipf-summary

        Args:
            query: User's question
            limit: Maximum number of results

        Returns:
            List of InternalResearchResult
        """
        if not self.is_configured:
            print("[InternalResearchSearch] search_initial: Not configured, returning empty results")
            print(f"  - OpenSearch configured: {opensearch_client.is_configured}")
            print(f"  - Embedding configured: {embedding_client.is_configured}")
            return []

        print(f"[InternalResearchSearch] search_initial: Searching for '{query[:50]}...'")

        try:
            # 1. Embed the query
            query_embedding = await embedding_client.embed_text(query)

            # 2. Perform vector search on oipf-summary
            response = await opensearch_client.vector_search(
                index="oipf-summary",
                vector_field="oipf_research_abstract_embedding",
                query_vector=query_embedding,
                k=limit,
            )

            # 3. Parse results
            results = []
            hits = response.get("hits", {}).get("hits", [])

            for hit in hits:
                source = hit.get("_source", {})
                score = hit.get("_score", 0.0)

                # Extract year from tags or use default
                tags = source.get("oipf_research_themetags", [])
                year = self._extract_year_from_tags(tags) or "2024"

                # Create title from abstract (first 50 chars) or folder summary
                abstract = source.get("oipf_research_abstract", "")
                folder_summary = source.get("oipf_spo_folderstructure_summary", "")
                title = self._create_title(abstract, folder_summary)

                results.append(InternalResearchResult(
                    title=title,
                    tags=tags[:5],  # Limit tags
                    similarity=min(score, 1.0),  # Normalize score
                    year=year,
                    research_id=source.get("oipf_research_id", ""),
                    abstract=abstract[:500] if abstract else "",
                ))

            return results

        except Exception as e:
            print(f"[InternalResearchSearch] Initial search failed: {e}")
            return []

    async def search_followup(
        self,
        query: str,
        chat_history: list[dict],
        research_id_filter: Optional[str] = None,
        limit: int = 10,
    ) -> list[InternalResearchResult]:
        """
        Follow-up query search using LLM-generated OpenSearch query on oipf-details

        Args:
            query: User's question
            chat_history: Previous chat messages
            research_id_filter: Optional oipf_research_id to filter by
            limit: Maximum number of results

        Returns:
            List of InternalResearchResult
        """
        if not self.is_configured:
            print("[InternalResearchSearch] search_followup: Not configured, returning empty results")
            print(f"  - OpenSearch configured: {opensearch_client.is_configured}")
            print(f"  - Embedding configured: {embedding_client.is_configured}")
            return []

        print(f"[InternalResearchSearch] search_followup: Searching for '{query[:50]}...'")

        try:
            # 1. Use LLM to generate OpenSearch query
            llm_client = get_llm_client()
            opensearch_query = await self._generate_opensearch_query(
                query, chat_history, research_id_filter, llm_client
            )

            if not opensearch_query:
                # Fallback to simple text search
                opensearch_query = {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "oipf_file_abstract^2",
                            "oipf_file_richtext",
                            "oipf_file_tags",
                            "oipf_file_name",
                        ],
                    }
                }

                # Add research_id filter if provided
                if research_id_filter:
                    opensearch_query = {
                        "bool": {
                            "must": [opensearch_query],
                            "filter": [
                                {"term": {"oipf_research_id": research_id_filter}}
                            ],
                        }
                    }

            # 2. Execute search on oipf-details
            response = await opensearch_client.search(
                index="oipf-details",
                query=opensearch_query,
                size=limit,
            )

            # 3. Parse results
            results = []
            hits = response.get("hits", {}).get("hits", [])

            for hit in hits:
                source = hit.get("_source", {})
                score = hit.get("_score", 0.0)

                # Use file name as title
                file_name = source.get("oipf_file_name", "")
                abstract = source.get("oipf_file_abstract", "")
                title = file_name or self._create_title(abstract, "")

                tags = source.get("oipf_file_tags", [])
                year = self._extract_year_from_source(source) or "2024"

                results.append(InternalResearchResult(
                    title=title,
                    tags=tags[:5],
                    similarity=min(score / 10.0, 1.0),  # Normalize BM25 score
                    year=year,
                    research_id=source.get("oipf_research_id", ""),
                    abstract=abstract[:500] if abstract else "",
                    file_path=source.get("oipf_file_path", ""),
                ))

            return results

        except Exception as e:
            print(f"[InternalResearchSearch] Follow-up search failed: {e}")
            return []

    async def search(
        self,
        query: str,
        chat_history: Optional[list[dict]] = None,
        research_id_filter: Optional[str] = None,
        limit: int = 10,
    ) -> list[InternalResearchResult]:
        """
        Smart search that chooses between initial and follow-up search

        Args:
            query: User's question
            chat_history: Previous chat messages (if None, treated as initial query)
            research_id_filter: Optional oipf_research_id to filter by
            limit: Maximum number of results

        Returns:
            List of InternalResearchResult
        """
        print(f"[InternalResearchSearch] search() called")
        print(f"  - Query: {query[:50]}...")
        print(f"  - is_configured: {self.is_configured}")

        # Determine if this is initial or follow-up query
        is_initial = (
            chat_history is None
            or len(chat_history) <= 2  # Only system + first user message
        )

        print(f"  - is_initial: {is_initial}")
        print(f"  - research_id_filter: {research_id_filter}")

        if is_initial and not research_id_filter:
            return await self.search_initial(query, limit)
        else:
            return await self.search_followup(
                query,
                chat_history or [],
                research_id_filter,
                limit,
            )

    async def _generate_opensearch_query(
        self,
        query: str,
        chat_history: list[dict],
        research_id_filter: Optional[str],
        llm_client: LLMClient,
    ) -> Optional[dict]:
        """
        Use LLM to generate OpenSearch query from natural language

        Args:
            query: User's question
            chat_history: Previous chat messages
            research_id_filter: Optional research_id to filter by
            llm_client: LLM client instance

        Returns:
            OpenSearch query dict or None if generation fails
        """
        # Build context from chat history
        history_context = ""
        if chat_history:
            recent_messages = chat_history[-6:]  # Last 6 messages
            history_context = "\n".join(
                f"{m.get('role', 'user')}: {m.get('content', '')[:200]}"
                for m in recent_messages
            )

        prompt = f"""あなたはOpenSearchクエリ生成アシスタントです。
ユーザーの質問をOpenSearchの検索クエリ（JSON）に変換してください。

## 対象インデックス: oipf-details
利用可能なフィールド:
- oipf_research_id (keyword): 研究ID（完全一致）
- oipf_file_path (text): ファイルパス
- oipf_file_name (text): ファイル名
- oipf_file_type (keyword): ファイル種別（.pdf, .docx等）
- oipf_file_abstract (text): ファイル要約
- oipf_file_richtext (text): ファイル本文
- oipf_file_tags (keyword): タグ
- oipf_file_author (keyword): 作成者
- oipf_file_editor (keyword): 編集者

## 会話履歴:
{history_context}

## 現在の質問:
{query}

{"## 研究IDフィルタ: " + research_id_filter if research_id_filter else ""}

## 指示:
- OpenSearchのクエリDSL（JSON）のみを出力
- bool queryを使用して複数条件を組み合わせる
- 研究IDフィルタがある場合はfilterに追加
- 日本語と英語の両方で検索可能にする

JSON形式で出力（説明不要）:"""

        try:
            result = await llm_client.generate_json(prompt)

            # Validate that result is a valid query structure
            if isinstance(result, dict) and ("bool" in result or "multi_match" in result or "match" in result or "query_string" in result):
                return result

            return None

        except Exception as e:
            print(f"[InternalResearchSearch] Query generation failed: {e}")
            return None

    def _create_title(self, abstract: str, folder_summary: str) -> str:
        """Create a title from abstract or folder summary"""
        if abstract:
            # Use first sentence or first 50 chars
            first_sentence = abstract.split("。")[0]
            if len(first_sentence) > 50:
                return first_sentence[:50] + "..."
            return first_sentence + ("。" if "。" not in first_sentence else "")

        if folder_summary:
            return folder_summary[:50]

        return "Untitled Research"

    def _extract_year_from_tags(self, tags: list[str]) -> Optional[str]:
        """Extract year from tags"""
        import re
        for tag in tags:
            match = re.search(r"(20\d{2})", tag)
            if match:
                return match.group(1)
        return None

    def _extract_year_from_source(self, source: dict) -> Optional[str]:
        """Extract year from source document (created_at or updated_at)"""
        import re

        for field in ["created_at", "updated_at"]:
            value = source.get(field, "")
            if value:
                match = re.search(r"(20\d{2})", str(value))
                if match:
                    return match.group(1)

        # Try tags
        tags = source.get("oipf_file_tags", [])
        return self._extract_year_from_tags(tags)


# Global service instance
internal_research_service = InternalResearchSearchService()


# Compatibility function for mock_data replacement
async def search_internal_research_opensearch(
    query: str,
    chat_history: Optional[list[dict]] = None,
) -> list[InternalResearchResult]:
    """
    Search internal research using OpenSearch

    This function can replace search_internal_research from mock_data.py
    """
    return await internal_research_service.search(query, chat_history)
