"""
Research Chat Router

/api/research-chat エンドポイント
SSE (Server-Sent Events) ストリーミング対応
"""

import json
import asyncio
import re
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.models.schemas import ResearchChatRequest, ChatMessage
from app.services.llm_client import LLMClient, ChatMessage as LLMChatMessage, get_llm_client
from app.services.external_search import search_all_sources, search_openalex, search_semantic_scholar, search_arxiv, generate_search_keywords
from app.services.mock_data import (
    search_internal_research,
    search_business_challenges,
    search_sharepoint_coarse2fine,
    deep_file_search,
)
from app.services.internal_research_search import (
    internal_research_service,
    InternalResearchResult,
)
from app.services.knowwho_service import knowwho_service

router = APIRouter()


def extract_research_id_from_message(message: str) -> Optional[str]:
    """
    Extract research_id from user message.

    Looks for patterns like:
    - "調査対象の研究ID: OIPF-2024-001"
    - "研究ID: OIPF-2024-001"
    - "研究ID：OIPF-2024-001" (full-width colon)
    - "OIPF-2024-001について"

    Returns:
        Research ID string or None if not found
    """
    # Pattern 1: Explicit research ID mention
    patterns = [
        r'調査対象の研究ID[：:]\s*([A-Za-z0-9\-_]+)',
        r'研究ID[：:]\s*([A-Za-z0-9\-_]+)',
        r'対象ID[：:]\s*([A-Za-z0-9\-_]+)',
        r'research_id[：:]\s*([A-Za-z0-9\-_]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            research_id = match.group(1)
            print(f"[extract_research_id] Found research_id: {research_id}")
            return research_id

    return None


# Markdown formatting guidelines for LLM responses
MARKDOWN_FORMAT_GUIDE = """
## 回答フォーマット指示（必ず従ってください）

### 構造化されたMarkdown形式で回答
- **見出し**: 内容に応じて `## セクション名` や `### サブセクション名` を使用
- **箇条書き**: 複数の項目は `- 項目` や `1. 項目` で整理
- **強調**: 重要なキーワードや概念は **太字** で強調
- **引用**: 重要な引用や定義は `> 引用文` で表示
- **表**: 比較データがある場合は Markdown テーブルを使用

### 回答の構成例
```
## 概要
[簡潔な要約を1-2文で]

### 主なポイント
- **ポイント1**: 説明 [1]
- **ポイント2**: 説明 [2]

### 詳細分析
[詳細な説明]

> 重要な引用や結論

### まとめ
[結論や次のステップ]
```

### 禁止事項
- 見出しなしの長文回答
- 構造化されていない平文のみの回答
- 箇条書きを使わない列挙
"""

MARKDOWN_FORMAT_GUIDE_COMPACT = """
**回答フォーマット**: Markdown形式で構造化してください
- `## 見出し` でセクション分け
- `- 項目` で箇条書き
- `**太字**` で重要語を強調
- `> 引用` で重要な結論
- 比較データは `| 表 |` 形式で
- 論文引用は [1], [2] 形式
"""


def create_sse_message(data: dict) -> str:
    """Create SSE formatted message"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def handle_assistant_mode(
    request: ResearchChatRequest,
    llm_client: LLMClient,
) -> AsyncGenerator[str, None]:
    """Handle assistant mode with tool execution"""

    user_message = request.messages[-1].content
    tool_results = []
    internal_research_context = []  # OpenSearch results for LLM context

    # Always fetch internal research from OpenSearch if configured
    if internal_research_service.is_configured:
        print(f"[assistant_mode] Fetching internal research from OpenSearch...")
        try:
            chat_history = [{"role": m.role, "content": m.content} for m in request.messages]

            # Use researchIdFilter from request, or extract from message
            research_id_filter = request.researchIdFilter or extract_research_id_from_message(user_message)
            if research_id_filter:
                print(f"[assistant_mode] Filtering by research_id: {research_id_filter}")

            internal_results = await internal_research_service.search(
                user_message,
                chat_history,
                research_id_filter=research_id_filter,
            )

            if internal_results:
                print(f"[assistant_mode] Found {len(internal_results)} internal research results")

                # Store for LLM context
                internal_research_context = internal_results

                # Send results to frontend
                internal_data = []
                # Determine search type from first result (all results have same source_type)
                search_type = internal_results[0].source_type if internal_results else "summary"
                for r in internal_results:
                    item = {
                        "title": r.title,
                        "tags": r.tags,
                        "similarity": r.similarity,
                        "year": r.year,
                        "source_type": r.source_type,  # "summary" or "details"
                    }
                    if r.research_id:
                        item["research_id"] = r.research_id
                    if r.abstract:
                        item["abstract"] = r.abstract
                    if r.file_path:
                        item["file_path"] = r.file_path
                    internal_data.append(item)

                yield create_sse_message({
                    "type": "research_data",
                    "internal": internal_data,
                    "business": [],
                    "external": [],
                    "source": "opensearch_auto",
                    "search_type": search_type,  # "summary" (research projects) or "details" (files)
                })
            else:
                print(f"[assistant_mode] No internal research results found")
        except Exception as e:
            print(f"[assistant_mode] OpenSearch search failed: {e}")

    # Generate or use provided steps
    steps = []

    # DeepDive mode: use fixed tool set
    if request.deepDiveContext:
        yield create_sse_message({"type": "thinking_start"})

        steps = [
            {"tool": "deep-file-search", "query": user_message, "description": "関連する社内資料を検索"},
            {"tool": "chat", "query": "Summarize the results", "description": "AI summary"},
        ]

        yield create_sse_message({"type": "plan", "steps": steps})

    elif request.tool and request.tool != "none":
        # Specific tool selected (non-DeepDive mode)
        yield create_sse_message({"type": "thinking_start"})

        steps = [
            {"tool": request.tool, "query": request.toolQuery or user_message, "description": f"Execute {request.tool}"},
            {"tool": "chat", "query": "Summarize the results", "description": "AI summary"},
        ]

        yield create_sse_message({"type": "plan", "steps": steps})
    else:
        # Generate execution plan
        yield create_sse_message({"type": "thinking_start"})

        planning_context = f"User query: {user_message}"
        if request.pdfContext:
            planning_context += "\n\n**IMPORTANT**: User is viewing a PDF document."

        plan_system_prompt = """You are a research planning assistant. Create a step-by-step execution plan.
Available tools:
- wide-knowledge: Search external papers and research
- internal-docs: Search internal SharePoint documents (社内資料検索)
- chat: Summarize or format results

Return JSON: {"steps": [{"tool": "name", "query": "query", "description": "desc"}]}
Keep it concise, 2-3 steps. Always end with "chat"."""

        try:
            plan_content = await llm_client.generate_json(planning_context, plan_system_prompt)
            steps = plan_content.get("steps", [])
        except Exception as e:
            print(f"Plan generation failed: {e}")
            steps = [{"tool": "chat", "query": user_message, "description": "Direct AI response"}]

        yield create_sse_message({"type": "plan", "steps": steps})

    # Execute each step
    for i, step in enumerate(steps):
        yield create_sse_message({"type": "step_start", "step": i})

        tool_name = step.get("tool", "")
        query = step.get("query", user_message)

        if tool_name == "wide-knowledge":
            # Generate optimized search keywords using LLM
            chat_history = [{"role": m.role, "content": m.content} for m in request.messages]
            optimized_query = await generate_search_keywords(query, chat_history, llm_client)
            print(f"[wide-knowledge] Original query: {query}")
            print(f"[wide-knowledge] Optimized query: {optimized_query}")

            # Search arXiv only (PDF preview is only available for arXiv)
            papers = await search_all_sources(optimized_query)

            # Generate summary with citations
            summary = ""
            if papers:
                paper_context = "\n\n".join(
                    f'[{p.id}] "{p.title}" ({", ".join(p.authors[:3])}, {p.year})\n概要: {p.abstract[:200] if p.abstract else "N/A"}...'
                    for p in papers
                )

                answer_prompt = f"""あなたは研究支援AIです。以下の論文を引用しながら、構造化されたMarkdown形式で回答してください。

## ユーザーの質問
{user_message}

## 参照可能な論文
{paper_context}

## 回答形式の指示
以下の構造で回答してください：

### 概要
[質問への直接的な回答を2-3文で]

### 主な知見
- **知見1**: 説明 [引用番号]
- **知見2**: 説明 [引用番号]
- **知見3**: 説明 [引用番号]

### 詳細
[必要に応じて詳細な説明]

## 注意事項
- 回答は400-800文字の日本語
- [1]、[2] のように論文番号で必ず引用
- 重要なキーワードは **太字** で強調
- 箇条書きを積極的に使用"""

                try:
                    summary = await llm_client.generate_text(answer_prompt, max_tokens=1000)
                except Exception as e:
                    print(f"Summary generation failed: {e}")

            tool_results.append({
                "tool": "wide-knowledge",
                "query": query,
                "results": [p.to_dict() for p in papers],
                "summary": summary,
            })

        elif tool_name == "internal-docs":
            # Search internal documents
            # Use OpenSearch if configured, otherwise fall back to mock data
            if internal_research_service.is_configured:
                # Use OpenSearch-based search
                yield create_sse_message({
                    "type": "internal_docs_thinking",
                    "step": "coarse",
                    "message": "社内研究をOpenSearchで検索中...",
                })

                # Build chat history for context-aware search
                chat_history = [{"role": m.role, "content": m.content} for m in request.messages]

                # Use researchIdFilter from request, or extract from query
                research_id_filter = request.researchIdFilter or extract_research_id_from_message(query)
                if research_id_filter:
                    print(f"[internal-docs] Filtering by research_id: {research_id_filter}")

                # Perform OpenSearch search
                internal_results = await internal_research_service.search(
                    query,
                    chat_history,
                    research_id_filter=research_id_filter,
                )

                yield create_sse_message({
                    "type": "internal_docs_thinking",
                    "step": "fine",
                    "message": f"検索完了: {len(internal_results)}件の研究が見つかりました",
                })

                # Format results for display (convert to compatible format)
                fine_matches = []
                for r in internal_results:
                    fine_matches.append({
                        "title": r.title,
                        "path": r.file_path or f"/research/{r.research_id}",
                        "snippet": r.abstract[:200] + "..." if r.abstract else "",
                        "relevance": r.similarity,
                        "research_id": r.research_id,
                        "tags": r.tags,
                    })

                docs_results = {
                    "coarse_matches": [],  # OpenSearch doesn't use coarse/fine distinction
                    "fine_matches": fine_matches,
                    "total_coarse": 0,
                    "total_fine": len(fine_matches),
                    "source": "opensearch",
                }
            else:
                # Fall back to mock data (SharePoint Coarse-to-Fine)
                yield create_sse_message({
                    "type": "internal_docs_thinking",
                    "step": "coarse",
                    "message": "社内資料を検索中（カテゴリ特定）...",
                })

                # Perform Coarse-to-Fine search
                search_result = search_sharepoint_coarse2fine(query)

                yield create_sse_message({
                    "type": "internal_docs_thinking",
                    "step": "fine",
                    "message": f"詳細検索中... (カテゴリ: {search_result['total_coarse']}件, 資料: {search_result['total_fine']}件)",
                })

                # Format results for display
                docs_results = {
                    "coarse_matches": search_result["coarse_matches"],
                    "fine_matches": search_result["fine_matches"],
                    "total_coarse": search_result["total_coarse"],
                    "total_fine": search_result["total_fine"],
                    "source": "mock",
                }

            tool_results.append({
                "tool": "internal-docs",
                "query": query,
                "results": docs_results,
            })

            yield create_sse_message({
                "type": "internal_docs_results",
                "data": docs_results,
            })

        elif tool_name == "knowwho":
            # Find experts
            knowwho_status = knowwho_service.get_status()
            source_label = "OpenSearch" if knowwho_status["mode"] == "opensearch" else "モックデータ"

            # Check if target employees are specified in config
            target_employee_ids = knowwho_service.get_target_employee_ids()

            if target_employee_ids:
                # Use specified target employees
                yield create_sse_message({
                    "type": "knowwho_thinking",
                    "step": "target_employees",
                    "message": f"指定された従業員への経路を探索中... (データソース: {source_label})",
                    "targetEmployees": target_employee_ids,
                })

                # Search by target employee IDs
                experts = await knowwho_service.search_by_target_employees()

                tool_results.append({
                    "tool": "knowwho",
                    "query": query,
                    "results": experts,
                })

                # Get all employees and cluster metadata for visualization
                all_employees = await knowwho_service.get_all_employees_for_tsne()
                cluster_metadata = knowwho_service.get_cluster_metadata()

                yield create_sse_message({
                    "type": "knowwho_results",
                    "experts": experts,
                    "searchContext": {
                        "targetEmployees": target_employee_ids,
                        "candidateCount": len(experts),
                        "dataSource": knowwho_status["mode"],
                    },
                    "allEmployees": all_employees,
                    "clusters": cluster_metadata,
                })
            else:
                # Use department-based search (original behavior)
                yield create_sse_message({
                    "type": "knowwho_thinking",
                    "step": "departments",
                    "message": f"関連部署を特定中... (データソース: {source_label})",
                })

                # Identify relevant departments
                dept_prompt = f"""ユーザーの質問に関連する部署を特定してください。

質問: {query}

利用可能な部署: 研究開発部, AI推進部, 技術戦略室, 企画部, 事業開発部

JSON形式で回答: {{"departments": ["部署1", "部署2"]}}"""

                departments = ["研究開発部", "AI推進部"]
                try:
                    parsed = await llm_client.generate_json(dept_prompt)
                    departments = parsed.get("departments", departments)
                except Exception as e:
                    print(f"Department identification failed: {e}")

                yield create_sse_message({
                    "type": "knowwho_thinking",
                    "step": "searching",
                    "message": f"候補者を検索中... ({', '.join(departments)})",
                    "departments": departments,
                })

                # Search experts using knowwho_service
                experts = await knowwho_service.search_experts(departments)

                tool_results.append({
                    "tool": "knowwho",
                    "query": query,
                    "results": experts,
                })

                # Get all employees and cluster metadata for visualization
                all_employees = await knowwho_service.get_all_employees_for_tsne()
                cluster_metadata = knowwho_service.get_cluster_metadata()

                yield create_sse_message({
                    "type": "knowwho_results",
                    "experts": experts,
                    "searchContext": {
                        "departments": departments,
                        "candidateCount": len(experts),
                        "dataSource": knowwho_status["mode"],
                    },
                    "allEmployees": all_employees,
                    "clusters": cluster_metadata,
                })

        elif tool_name == "positioning-analysis":
            # Generate positioning analysis
            positioning_context = f"ユーザーの質問「{query}」に基づき、研究のポジショニング分析を行ってください。"

            if tool_results:
                positioning_context += f"\n\n## 既存の結果:\n{json.dumps(tool_results, ensure_ascii=False)}"

            positioning_prompt = f"""{positioning_context}

以下のJSON形式で出力してください。insightsは構造化されたMarkdown形式で記述してください：
{{
  "axes": [{{"name": "軸名", "type": "quantitative"}}],
  "items": [{{"name": "項目", "type": "internal|external|target", "values": {{"軸名": 50}}}}],
  "insights": [
    "## 分析サマリー\\n[全体的な傾向を1-2文で]",
    "### 主要な発見\\n- **発見1**: 説明\\n- **発見2**: 説明",
    "### 推奨事項\\n> 今後のアクションや検討事項"
  ]
}}

insightsの各要素はMarkdown形式で、見出し・箇条書き・太字・引用を適切に使用してください。"""

            try:
                pos_content = await llm_client.generate_json(positioning_prompt)

                axis_count = len(pos_content.get("axes", []))
                chart_type = "scatter" if axis_count == 2 else "radar" if axis_count >= 3 else "box"

                positioning_data = {
                    "axes": pos_content.get("axes", []),
                    "suggestedChartType": chart_type,
                    "items": pos_content.get("items", []),
                    "insights": pos_content.get("insights", []),
                }

                tool_results.append({
                    "tool": "positioning-analysis",
                    "query": query,
                    "results": positioning_data,
                })

                yield create_sse_message({"type": "positioning_analysis", "data": positioning_data})

            except Exception as e:
                print(f"Positioning analysis failed: {e}")

        elif tool_name == "seeds-needs-matching":
            # Generate seeds-needs matching
            matching_context = f"ユーザーの質問「{user_message}」に基づき、研究シーズとニーズのマッチング分析を行います。"

            if tool_results:
                matching_context += f"\n\n## 既存の結果:\n{json.dumps(tool_results, ensure_ascii=False)}"

            matching_prompt = f"""{matching_context}

以下のJSON形式で出力:
{{
  "seedTitle": "研究シーズのタイトル",
  "seedDescription": "研究シーズの説明",
  "candidates": [
    {{"title": "ニーズ候補", "department": "事業部", "evaluation": "high|medium|low", "score": 80}}
  ]
}}"""

            try:
                match_content = await llm_client.generate_json(matching_prompt)

                matching_data = {
                    "seedTitle": match_content.get("seedTitle", ""),
                    "seedDescription": match_content.get("seedDescription", ""),
                    "candidates": match_content.get("candidates", []),
                }

                tool_results.append({
                    "tool": "seeds-needs-matching",
                    "query": query,
                    "results": matching_data,
                })

                yield create_sse_message({"type": "seeds_needs_matching", **matching_data})

            except Exception as e:
                print(f"Seeds-needs matching failed: {e}")

        elif tool_name == "deep-file-search":
            # Deep file search for DeepDive mode
            # Extract research_id from deepDiveContext if available (for filtering)
            research_id_filter = None
            paper_keywords = []

            if request.deepDiveContext:
                source = request.deepDiveContext.get("source", {})
                title = source.get("title", "")
                # Extract keywords from title
                if title:
                    paper_keywords.extend(title.split()[:5])

                # Use virtual folder descriptions for additional context
                virtual_folder = request.deepDiveContext.get("virtualFolder", [])
                for item in virtual_folder[:3]:
                    if item.get("description"):
                        paper_keywords.append(item["description"][:20])

                # Get research_id if available
                research_id_filter = source.get("research_id")

            # Use OpenSearch if configured, otherwise fall back to mock data
            if internal_research_service.is_configured:
                yield create_sse_message({
                    "type": "deep_file_search_thinking",
                    "message": "関連する社内資料をOpenSearchで検索中...",
                })

                # Perform OpenSearch-based deep file search
                opensearch_results = await internal_research_service.deep_file_search(
                    query=query,
                    research_id_filter=research_id_filter,
                    paper_keywords=paper_keywords,
                    limit=10,
                )

                # Convert to dict format for response
                search_results = [
                    {
                        "path": r.path,
                        "relevantContent": r.relevantContent,
                        "type": r.type,
                        "score": r.score,
                        "keywords": r.keywords,
                        "research_id": r.research_id,
                        "file_name": r.file_name,
                    }
                    for r in opensearch_results
                ]
            else:
                yield create_sse_message({
                    "type": "deep_file_search_thinking",
                    "message": "関連する社内資料を検索中...",
                })

                # Fall back to mock data
                search_results = deep_file_search(query, paper_keywords)

            tool_results.append({
                "tool": "deep-file-search",
                "query": query,
                "results": search_results,
            })

            yield create_sse_message({
                "type": "deep_file_search_result",
                "results": search_results,
            })

        elif tool_name == "html-generation":
            # Generate HTML
            yield create_sse_message({"type": "html_start"})

            tool_context = "\n".join(
                f"### {r['tool']}\n{json.dumps(r['results'], ensure_ascii=False)}"
                for r in tool_results
            )

            html_prompt = f"""研究レポートとしてのHTML資料を生成してください。

**ユーザーの質問:** {user_message}

**ツール結果:**
{tool_context}

HTMLのみを出力。最初の文字は<!DOCTYPE html>で始める。"""

            messages = [
                LLMChatMessage(role="system", content=html_prompt),
                LLMChatMessage(role="user", content=user_message),
            ]

            try:
                async for chunk in llm_client.chat_completion_stream(messages):
                    if chunk.startswith("data: ") and chunk != "data: [DONE]\n\n":
                        try:
                            data = json.loads(chunk[6:].strip())
                            content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                yield create_sse_message({"type": "html_chunk", "content": content})
                        except json.JSONDecodeError:
                            pass

                yield create_sse_message({"type": "html_complete"})

            except Exception as e:
                print(f"HTML generation failed: {e}")

        yield create_sse_message({"type": "step_complete", "step": i})

    # Generate final AI summary
    yield create_sse_message({"type": "chat_start"})

    context_prompt = f"""あなたはR&D研究支援AIアシスタントです。構造化されたMarkdown形式で見やすく回答してください。
{MARKDOWN_FORMAT_GUIDE_COMPACT}

## ユーザーの質問:
{user_message}"""

    # Add internal research context from OpenSearch (if available)
    if internal_research_context:
        internal_context_lines = []
        # Check if results are from oipf-summary (research projects) or oipf-details (files)
        is_summary_results = internal_research_context[0].source_type == "summary" if internal_research_context else False

        for r in internal_research_context:
            if is_summary_results:
                # Research project level - emphasize research overview
                line = f"- 【研究プロジェクト】{r.title}"
                if r.research_id:
                    line += f"\n  研究ID: {r.research_id}"
                if r.abstract:
                    line += f"\n  研究概要: {r.abstract[:400]}"
                if r.tags:
                    line += f"\n  テーマタグ: {', '.join(r.tags[:5])}"
                if r.similarity:
                    line += f"\n  類似度: {r.similarity:.0%}"
            else:
                # File level - show file details
                line = f"- {r.title}"
                if r.research_id:
                    line += f" (研究ID: {r.research_id})"
                if r.file_path:
                    line += f"\n  ファイル: {r.file_path}"
                if r.abstract:
                    line += f"\n  要約: {r.abstract[:300]}..."
                if r.tags:
                    line += f"\n  タグ: {', '.join(r.tags[:5])}"
            internal_context_lines.append(line)

        if is_summary_results:
            context_prompt += f"\n\n## 関連する社内研究プロジェクト:\n以下は社内で実施された研究プロジェクトの一覧です。各プロジェクトの研究ID、概要、テーマタグを参考にして回答してください。\n\n" + "\n\n".join(internal_context_lines)
        else:
            context_prompt += f"\n\n## 関連する社内資料 (ファイル):\n" + "\n".join(internal_context_lines)

    if tool_results:
        context_prompt += f"\n\n## ツール実行結果:\n{json.dumps(tool_results, ensure_ascii=False, indent=2)}"

    if request.pdfContext:
        context_prompt += f"\n\n## PDFドキュメント:\n{request.pdfContext[:10000]}"

    # Collect sources from wide-knowledge
    all_sources = []
    source_id = 1
    for result in tool_results:
        if result["tool"] == "wide-knowledge":
            for paper in result["results"]:
                paper["id"] = source_id
                all_sources.append(paper)
                source_id += 1

    if all_sources:
        # Non-streaming with citations
        paper_context = "\n".join(
            f'[{p["id"]}] "{p["title"]}" ({", ".join(p["authors"][:3])}, {p["year"]})'
            for p in all_sources
        )

        context_prompt += f"""

## 参照可能な論文:
{paper_context}

## 回答形式
以下の構造で回答してください：
1. **概要**: 質問への直接的な回答（2-3文）
2. **主な知見**: 箇条書きで各論文からの知見を整理（[1], [2]で引用）
3. **詳細分析**: 必要に応じて詳しい説明
4. **まとめ**: 結論や示唆

重要なキーワードは **太字** で強調し、比較がある場合は表形式も活用してください。"""

        messages = [
            LLMChatMessage(role="system", content=context_prompt),
        ]
        for msg in request.messages:
            messages.append(LLMChatMessage(role=msg.role, content=msg.content))

        try:
            response = await llm_client.chat_completion(messages, max_tokens=2000)

            yield create_sse_message({
                "type": "final_answer",
                "content": response.content,
                "sources": all_sources,
            })

        except Exception as e:
            print(f"Final answer generation failed: {e}")
            yield create_sse_message({
                "type": "final_answer",
                "content": f"エラーが発生しました: {e}",
                "sources": all_sources,
            })
    else:
        # Streaming response
        messages = [
            LLMChatMessage(role="system", content=context_prompt),
        ]
        for msg in request.messages:
            messages.append(LLMChatMessage(role=msg.role, content=msg.content))

        try:
            async for chunk in llm_client.chat_completion_stream(messages):
                yield chunk
        except Exception as e:
            print(f"Streaming response failed: {e}")

    yield "data: [DONE]\n\n"


async def handle_search_mode(
    request: ResearchChatRequest,
    llm_client: LLMClient,
) -> AsyncGenerator[str, None]:
    """Handle search mode"""

    user_message = request.messages[-1].content

    # Build chat history for context-aware search
    chat_history = [{"role": m.role, "content": m.content} for m in request.messages]

    # Use researchIdFilter from request, or extract from message
    research_id_filter = request.researchIdFilter or extract_research_id_from_message(user_message)
    if research_id_filter:
        print(f"[search_mode] Filtering by research_id: {research_id_filter}")

    # Search all sources in parallel
    # Use OpenSearch for internal research if configured, otherwise fallback to mock data
    if internal_research_service.is_configured:
        papers, internal, challenges = await asyncio.gather(
            search_all_sources(user_message),
            internal_research_service.search(user_message, chat_history, research_id_filter=research_id_filter),
            asyncio.to_thread(search_business_challenges, user_message),
        )
    else:
        papers, internal, challenges = await asyncio.gather(
            search_all_sources(user_message),
            asyncio.to_thread(search_internal_research, user_message),
            asyncio.to_thread(search_business_challenges, user_message),
        )

    # Send research data
    # Include research_id and source_type for OpenSearch results
    internal_data = []
    # Determine search type from first result
    search_type = internal[0].source_type if internal and hasattr(internal[0], "source_type") else "summary"
    for r in internal:
        item = {
            "title": r.title,
            "tags": r.tags,
            "similarity": r.similarity,
            "year": r.year,
        }
        # Add source_type if available
        if hasattr(r, "source_type"):
            item["source_type"] = r.source_type
        # Add research_id if available (OpenSearch results)
        if hasattr(r, "research_id") and r.research_id:
            item["research_id"] = r.research_id
        if hasattr(r, "abstract") and r.abstract:
            item["abstract"] = r.abstract
        if hasattr(r, "file_path") and r.file_path:
            item["file_path"] = r.file_path
        internal_data.append(item)

    yield create_sse_message({
        "type": "research_data",
        "internal": internal_data,
        "business": [{"challenge": c.challenge, "business_unit": c.business_unit, "priority": c.priority, "keywords": c.keywords} for c in challenges],
        "external": [p.to_dict() for p in papers],
        "search_type": search_type,  # "summary" (research projects) or "details" (files)
    })

    # Build context and stream AI response
    # Format internal research with more details for OpenSearch results
    # Check if results are from oipf-summary (research projects) or oipf-details (files)
    is_summary_results = search_type == "summary"
    internal_context_lines = []
    for r in internal:
        if is_summary_results:
            # Research project level - emphasize research overview
            line = f"- 【研究プロジェクト】{r.title}"
            if hasattr(r, "research_id") and r.research_id:
                line += f"\n  研究ID: {r.research_id}"
            if hasattr(r, "abstract") and r.abstract:
                line += f"\n  研究概要: {r.abstract[:400]}"
            if r.tags:
                line += f"\n  テーマタグ: {', '.join(r.tags[:5])}"
            if r.similarity:
                line += f"\n  類似度: {r.similarity:.0%}"
        else:
            # File level - show file details
            line = f"- {r.title}"
            if hasattr(r, "research_id") and r.research_id:
                line += f" (研究ID: {r.research_id})"
            if hasattr(r, "file_path") and r.file_path:
                line += f"\n  ファイル: {r.file_path}"
            if hasattr(r, "abstract") and r.abstract:
                line += f"\n  要約: {r.abstract[:200]}..."
        internal_context_lines.append(line)

    # Different header based on search type
    internal_header = "### 社内研究プロジェクト" if is_summary_results else "### 社内資料"
    internal_instruction = ""
    if is_summary_results and internal_context_lines:
        internal_instruction = "\n以下は社内で実施された研究プロジェクトの一覧です。各プロジェクトの研究ID、概要を引用して回答してください。\n"

    context_prompt = f"""あなたはR&D研究者向けのアシスタントです。構造化されたMarkdown形式で見やすく回答してください。

## 利用可能な情報

{internal_header}{internal_instruction}
{chr(10).join(internal_context_lines) or '- なし'}

### 外部論文
{chr(10).join(f'{i+1}. {p.title}' for i, p in enumerate(papers)) or '- なし'}

## ユーザーの質問
{user_message}

## 回答形式の指示
{MARKDOWN_FORMAT_GUIDE_COMPACT}

上記の情報を踏まえ、構造化された形式で回答してください。社内研究と外部論文の両方を参照し、関連性の高い情報を優先的に紹介してください。"""

    messages = [
        LLMChatMessage(role="system", content=context_prompt),
    ]
    for msg in request.messages:
        messages.append(LLMChatMessage(role=msg.role, content=msg.content))

    try:
        async for chunk in llm_client.chat_completion_stream(messages):
            yield chunk
    except Exception as e:
        print(f"Search mode response failed: {e}")

    yield "data: [DONE]\n\n"


@router.post("")
@router.post("/")
async def research_chat(request: ResearchChatRequest):
    """
    Research chat endpoint with SSE streaming

    Supports two modes:
    - assistant: Tool execution with plan generation
    - search: Quick search across sources
    """

    # Log incoming request for debugging
    user_message = request.messages[-1].content if request.messages else "(empty)"
    print(f"\n[research_chat] Request received:")
    print(f"  - Mode: {request.mode}")
    print(f"  - Tool: {request.tool or '(none)'}")
    print(f"  - Message: {user_message[:50]}...")

    try:
        llm_client = get_llm_client()
    except Exception as e:
        return {"error": str(e)}

    async def event_generator():
        if request.mode == "assistant":
            print(f"[research_chat] Using assistant mode")
            async for event in handle_assistant_mode(request, llm_client):
                yield event
        else:
            print(f"[research_chat] Using search mode (OpenSearch enabled)")
            async for event in handle_search_mode(request, llm_client):
                yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )
