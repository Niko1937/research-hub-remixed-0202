"""
Internal Research Search Service

OpenSearchを使った社内研究検索サービス
- 初回質問: ベクトル類似検索 (oipf-summary)
- 2回目以降: LLMでクエリ生成 (oipf-details)
"""

import json
import re
from dataclasses import dataclass
from typing import Optional, Union
from pathlib import PurePosixPath

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


@dataclass
class DeepFileSearchResult:
    """Deep file search result for DeepDive mode"""
    path: str
    relevantContent: str
    type: str  # "data", "figure", "code", "reference", "folder"
    score: float
    keywords: list[str]
    research_id: str = ""
    file_name: str = ""


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
        Follow-up query search using vector similarity on oipf-details

        Uses cosine similarity (same as search_initial) for consistent scoring.
        The oipf-details index has oipf_abstract_embedding for KNN vector search.

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
            # 1. Embed the query (same as search_initial)
            query_embedding = await embedding_client.embed_text(query)

            # 2. Build filter if research_id is provided
            filters = None
            if research_id_filter:
                filters = {"term": {"oipf_research_id": research_id_filter}}

            # 3. Perform vector search on oipf-details
            # Fetch more results for deduplication (3x limit)
            fetch_size = limit * 3
            response = await opensearch_client.vector_search(
                index="oipf-details",
                vector_field="oipf_abstract_embedding",
                query_vector=query_embedding,
                k=fetch_size,
                filters=filters,
            )

            # 4. Parse results
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
                    similarity=min(score, 1.0),  # Cosine similarity is already 0-1
                    year=year,
                    research_id=source.get("oipf_research_id", ""),
                    abstract=abstract[:500] if abstract else "",
                    file_path=source.get("oipf_file_path", ""),
                ))

            # 5. Deduplicate similar files
            deduplicated_results = self._deduplicate_results(results, limit)
            print(f"[InternalResearchSearch] Deduplication: {len(results)} → {len(deduplicated_results)} results")

            return deduplicated_results

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

    async def deep_file_search(
        self,
        query: str,
        research_id_filter: Optional[str] = None,
        paper_keywords: Optional[list[str]] = None,
        limit: int = 10,
    ) -> list[DeepFileSearchResult]:
        """
        Deep file search for DeepDive mode using vector similarity on oipf-details.

        Search for files related to a query using cosine similarity,
        optionally filtered by research_id. This is used to find related
        internal documents when diving deep into a research topic.

        Args:
            query: User's search query
            research_id_filter: Optional oipf_research_id to filter by
            paper_keywords: Additional keywords from the paper being analyzed
            limit: Maximum number of results

        Returns:
            List of DeepFileSearchResult
        """
        if not self.is_configured:
            print("[InternalResearchSearch] deep_file_search: Not configured, returning empty results")
            return []

        print(f"[InternalResearchSearch] deep_file_search: '{query[:50]}...'")
        if research_id_filter:
            print(f"  - research_id_filter: {research_id_filter}")

        try:
            # Build search query combining user query and paper keywords
            search_terms = [query]
            if paper_keywords:
                search_terms.extend(paper_keywords[:5])  # Limit additional keywords

            combined_query = " ".join(search_terms)

            # 1. Embed the query
            query_embedding = await embedding_client.embed_text(combined_query)

            # 2. Build filter if research_id is provided
            filters = None
            if research_id_filter:
                filters = {"term": {"oipf_research_id": research_id_filter}}

            # 3. Perform vector search on oipf-details
            # Fetch more results for deduplication (3x limit)
            fetch_size = limit * 3
            response = await opensearch_client.vector_search(
                index="oipf-details",
                vector_field="oipf_abstract_embedding",
                query_vector=query_embedding,
                k=fetch_size,
                filters=filters,
            )

            # 4. Parse results
            results = []
            hits = response.get("hits", {}).get("hits", [])

            for hit in hits:
                source = hit.get("_source", {})
                score = hit.get("_score", 0.0)

                file_path = source.get("oipf_file_path", "")
                file_name = source.get("oipf_file_name", "")
                abstract = source.get("oipf_file_abstract", "")
                tags = source.get("oipf_file_tags", [])
                file_type = source.get("oipf_file_type", "")

                # Determine file type category for display
                type_category = self._categorize_file_type(file_path, file_name, file_type)

                results.append(DeepFileSearchResult(
                    path=file_path or file_name,
                    relevantContent=abstract[:300] if abstract else "",
                    type=type_category,
                    score=min(score, 1.0),  # Cosine similarity is already 0-1
                    keywords=tags[:5] if isinstance(tags, list) else [],
                    research_id=source.get("oipf_research_id", ""),
                    file_name=file_name,
                ))

            # 5. Deduplicate similar files
            deduplicated_results = self._deduplicate_deep_file_results(results, limit)
            print(f"[InternalResearchSearch] deep_file_search deduplication: {len(results)} → {len(deduplicated_results)} results")

            return deduplicated_results

        except Exception as e:
            print(f"[InternalResearchSearch] deep_file_search failed: {e}")
            return []

    def _categorize_file_type(
        self,
        file_path: str,
        file_name: str,
        file_type: str,
    ) -> str:
        """Categorize file type for display"""
        path_lower = (file_path + file_name).lower()
        file_type_lower = file_type.lower() if file_type else ""

        # Check by file extension
        if file_type_lower in [".py", ".js", ".ts", ".java", ".cpp", ".c", ".ipynb"]:
            return "code"
        if file_type_lower in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".pdf"]:
            return "figure"
        if file_type_lower in [".csv", ".xlsx", ".json", ".parquet"]:
            return "data"

        # Check by path/name keywords
        if any(kw in path_lower for kw in ["モデル", "データ", "実験", "model", "data", "experiment"]):
            return "data"
        if any(kw in path_lower for kw in ["図", "資料", "レポート", "figure", "report", "chart"]):
            return "figure"
        if any(kw in path_lower for kw in ["コード", "アーキテクチャ", "設計", "code", "src", "script"]):
            return "code"
        if any(kw in path_lower for kw in ["論文", "研究", "文献", "paper", "reference", "literature"]):
            return "reference"

        return "folder"

    def _extract_base_name(self, file_name: str) -> str:
        """
        Extract base name from file name by removing version/date suffixes.

        Examples:
            "analysis_v2.xlsx" → "analysis"
            "report_2024_final.pdf" → "report"
            "実験データ_修正版.csv" → "実験データ"
        """
        if not file_name:
            return ""

        # Remove extension
        name_without_ext = re.sub(r'\.[^.]+$', '', file_name)

        # Remove common suffixes (version, date, status)
        patterns = [
            r'[_\-\s]*(v\d+|ver\d+|version\d+)$',  # v1, ver2, version3
            r'[_\-\s]*\d{4}[_\-]?\d{0,2}[_\-]?\d{0,2}$',  # 2024, 2024_01, 20240115
            r'[_\-\s]*(final|最終|確定|完成)$',
            r'[_\-\s]*(draft|下書き|ドラフト)$',
            r'[_\-\s]*(revised|修正|改訂|修正版|改訂版)$',
            r'[_\-\s]*(backup|バックアップ|bak)$',
            r'[_\-\s]*(copy|コピー|\(\d+\))$',
            r'[_\-\s]*\d+$',  # trailing numbers
        ]

        base_name = name_without_ext
        for pattern in patterns:
            base_name = re.sub(pattern, '', base_name, flags=re.IGNORECASE)

        return base_name.strip('_- ')

    def _get_directory_path(self, file_path: str) -> str:
        """Extract directory path from file path"""
        if not file_path:
            return ""
        try:
            return str(PurePosixPath(file_path).parent)
        except Exception:
            # Fallback: remove last component
            parts = file_path.replace('\\', '/').rsplit('/', 1)
            return parts[0] if len(parts) > 1 else ""

    def _get_path_depth(self, file_path: str) -> int:
        """Get depth of file path (number of directory levels)"""
        if not file_path:
            return 0
        return file_path.replace('\\', '/').count('/')

    def _calculate_version_score(self, file_name: str, file_path: str) -> int:
        """
        Calculate version score for prioritization.
        Higher score = newer/more important version.
        """
        score = 0
        combined = (file_name + " " + file_path).lower()

        # Final/completed versions get highest priority
        if any(kw in combined for kw in ['final', '最終', '確定', '完成']):
            score += 100

        # Revised versions
        if any(kw in combined for kw in ['revised', '修正', '改訂', '改訂版', '修正版']):
            score += 50

        # Version numbers (higher = better)
        version_match = re.search(r'v(\d+)|ver(\d+)|version(\d+)', combined)
        if version_match:
            version_num = int(version_match.group(1) or version_match.group(2) or version_match.group(3))
            score += version_num * 10

        # Year (more recent = better)
        year_match = re.search(r'(20\d{2})', combined)
        if year_match:
            year = int(year_match.group(1))
            score += (year - 2000)  # 2024 → 24 points

        # Penalize backup/draft/copy
        if any(kw in combined for kw in ['backup', 'バックアップ', 'bak', 'draft', '下書き', 'copy', 'コピー']):
            score -= 50

        # Penalize deeper paths (likely backups or archives)
        depth = self._get_path_depth(file_path)
        score -= depth * 2

        return score

    def _are_paths_nearby(self, path1: str, path2: str, max_depth_diff: int = 2) -> bool:
        """
        Check if two paths are in nearby directories (within max_depth_diff levels).
        """
        dir1 = self._get_directory_path(path1)
        dir2 = self._get_directory_path(path2)

        # Same directory
        if dir1 == dir2:
            return True

        # Check if one is ancestor/descendant of the other
        dir1_normalized = dir1.replace('\\', '/').rstrip('/')
        dir2_normalized = dir2.replace('\\', '/').rstrip('/')

        if dir1_normalized.startswith(dir2_normalized) or dir2_normalized.startswith(dir1_normalized):
            depth_diff = abs(self._get_path_depth(dir1) - self._get_path_depth(dir2))
            return depth_diff <= max_depth_diff

        return False

    def _deduplicate_results(
        self,
        results: list[InternalResearchResult],
        limit: int,
    ) -> list[InternalResearchResult]:
        """
        Deduplicate similar files, keeping only the newest/most relevant version.

        Groups files by base name + nearby path, then selects the best from each group.
        """
        if not results:
            return []

        # Group by (base_name, directory_group)
        groups: dict[str, list[tuple[InternalResearchResult, int]]] = {}

        for result in results:
            base_name = self._extract_base_name(result.title)
            if not base_name:
                base_name = result.title

            # Find existing group with same base name and nearby path
            group_key = None
            for existing_key in groups.keys():
                existing_base, existing_path = existing_key.rsplit('|', 1) if '|' in existing_key else (existing_key, '')
                if existing_base == base_name:
                    # Check if paths are nearby
                    if existing_path and result.file_path:
                        if self._are_paths_nearby(existing_path, result.file_path):
                            group_key = existing_key
                            break
                    elif not existing_path or not result.file_path:
                        group_key = existing_key
                        break

            if group_key is None:
                group_key = f"{base_name}|{self._get_directory_path(result.file_path)}"

            version_score = self._calculate_version_score(result.title, result.file_path)

            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append((result, version_score))

        # Select best from each group
        deduplicated = []
        for group_key, group_items in groups.items():
            # Sort by version_score (desc), then by similarity (desc)
            group_items.sort(key=lambda x: (x[1], x[0].similarity), reverse=True)
            best_result = group_items[0][0]
            deduplicated.append(best_result)

        # Sort by similarity and return top limit
        deduplicated.sort(key=lambda x: x.similarity, reverse=True)
        return deduplicated[:limit]

    def _deduplicate_deep_file_results(
        self,
        results: list[DeepFileSearchResult],
        limit: int,
    ) -> list[DeepFileSearchResult]:
        """
        Deduplicate similar files for deep file search results.
        """
        if not results:
            return []

        # Group by (base_name, directory_group)
        groups: dict[str, list[tuple[DeepFileSearchResult, int]]] = {}

        for result in results:
            base_name = self._extract_base_name(result.file_name or result.path.split('/')[-1])
            if not base_name:
                base_name = result.file_name or result.path

            # Find existing group with same base name and nearby path
            group_key = None
            for existing_key in groups.keys():
                existing_base, existing_path = existing_key.rsplit('|', 1) if '|' in existing_key else (existing_key, '')
                if existing_base == base_name:
                    if existing_path and result.path:
                        if self._are_paths_nearby(existing_path, result.path):
                            group_key = existing_key
                            break
                    elif not existing_path or not result.path:
                        group_key = existing_key
                        break

            if group_key is None:
                group_key = f"{base_name}|{self._get_directory_path(result.path)}"

            version_score = self._calculate_version_score(result.file_name or "", result.path)

            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append((result, version_score))

        # Select best from each group
        deduplicated = []
        for group_key, group_items in groups.items():
            group_items.sort(key=lambda x: (x[1], x[0].score), reverse=True)
            best_result = group_items[0][0]
            deduplicated.append(best_result)

        # Sort by score and return top limit
        deduplicated.sort(key=lambda x: x.score, reverse=True)
        return deduplicated[:limit]


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
