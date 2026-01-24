"""
Research Chat Router

/api/research-chat エンドポイント
SSE (Server-Sent Events) ストリーミング対応
"""

import json
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.models.schemas import ResearchChatRequest, ChatMessage
from app.services.llm_client import LLMClient, ChatMessage as LLMChatMessage, get_llm_client
from app.services.external_search import search_all_sources, search_openalex, search_semantic_scholar, search_arxiv
from app.services.mock_data import (
    search_internal_research,
    search_business_challenges,
    search_experts,
    search_sharepoint_coarse2fine,
    deep_file_search,
    get_all_employees_for_tsne,
    get_cluster_metadata,
    MOCK_EMPLOYEES,
    CURRENT_USER_ID,
    get_employee_by_id,
)

router = APIRouter()


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

    # Generate or use provided steps
    steps = []

    # DeepDive mode: use fixed tool set
    if request.deepDiveContext:
        yield create_sse_message({"type": "thinking_start"})

        steps = [
            {"tool": "deep-file-search", "query": user_message, "description": "関連する社内資料を検索"},
            {"tool": "knowwho", "query": user_message, "description": "関連する専門家を検索"},
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
- deep-file-search: Search related files in research data folders (DeepDive mode)
- knowwho: Search for experts and researchers
- positioning-analysis: Create positioning analysis
- seeds-needs-matching: Match research seeds with business needs
- html-generation: Generate HTML infographics
- chat: Summarize or format results

Return JSON: {"steps": [{"tool": "name", "query": "query", "description": "desc"}]}
Keep it concise, 2-4 steps. Always end with "chat"."""

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
            # Search external papers
            papers = await search_all_sources(query)

            # Generate summary with citations
            summary = ""
            if papers:
                paper_context = "\n\n".join(
                    f'[{p.id}] "{p.title}" ({", ".join(p.authors[:3])}, {p.year})\n概要: {p.abstract[:200] if p.abstract else "N/A"}...'
                    for p in papers
                )

                answer_prompt = f"""あなたは研究支援AIです。以下の論文を引用しながら回答してください。

## ユーザーの質問
{user_message}

## 参照可能な論文
{paper_context}

## 指示
- 回答は300-600文字の日本語で
- [1]、[2] のように論文番号で引用"""

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
            # Search internal SharePoint documents (Coarse-to-Fine)
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
            yield create_sse_message({
                "type": "knowwho_thinking",
                "step": "departments",
                "message": "関連部署を特定中...",
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

            # Search experts
            experts = search_experts(departments)

            tool_results.append({
                "tool": "knowwho",
                "query": query,
                "results": experts,
            })

            yield create_sse_message({
                "type": "knowwho_results",
                "experts": experts,
                "searchContext": {"departments": departments, "candidateCount": len(experts)},
                "allEmployees": get_all_employees_for_tsne(),
                "clusters": get_cluster_metadata(),
            })

        elif tool_name == "positioning-analysis":
            # Generate positioning analysis
            positioning_context = f"ユーザーの質問「{query}」に基づき、研究のポジショニング分析を行ってください。"

            if tool_results:
                positioning_context += f"\n\n## 既存の結果:\n{json.dumps(tool_results, ensure_ascii=False)}"

            positioning_prompt = f"""{positioning_context}

以下のJSON形式で出力:
{{
  "axes": [{{"name": "軸名", "type": "quantitative"}}],
  "items": [{{"name": "項目", "type": "internal|external|target", "values": {{"軸名": 50}}}}],
  "insights": ["分析結果"]
}}"""

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
            yield create_sse_message({
                "type": "deep_file_search_thinking",
                "message": "関連する社内資料を検索中...",
            })

            # Extract keywords from deepDiveContext if available
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

            # Perform deep file search
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

    context_prompt = f"""あなたはR&D研究支援AIアシスタントです。

## ユーザーの質問:
{user_message}"""

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

        context_prompt += f"\n\n## 参照可能な論文:\n{paper_context}\n\n[1]、[2] のように引用してください。"

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

    # Search all sources in parallel
    papers, internal, challenges = await asyncio.gather(
        search_all_sources(user_message),
        asyncio.to_thread(search_internal_research, user_message),
        asyncio.to_thread(search_business_challenges, user_message),
    )

    # Send research data
    yield create_sse_message({
        "type": "research_data",
        "internal": [{"title": r.title, "tags": r.tags, "similarity": r.similarity, "year": r.year} for r in internal],
        "business": [{"challenge": c.challenge, "business_unit": c.business_unit, "priority": c.priority, "keywords": c.keywords} for c in challenges],
        "external": [p.to_dict() for p in papers],
    })

    # Build context and stream AI response
    context_prompt = f"""あなたはR&D研究者向けのアシスタントです。

【社内研究】
{chr(10).join(f'- {r.title}' for r in internal) or '- なし'}

【外部論文】
{chr(10).join(f'{i+1}. {p.title}' for i, p in enumerate(papers)) or '- なし'}

ユーザーの質問: {user_message}"""

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

    try:
        llm_client = get_llm_client()
    except Exception as e:
        return {"error": str(e)}

    async def event_generator():
        if request.mode == "assistant":
            async for event in handle_assistant_mode(request, llm_client):
                yield event
        else:
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
