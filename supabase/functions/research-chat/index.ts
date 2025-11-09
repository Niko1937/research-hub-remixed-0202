import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ExternalPaper {
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  citations?: number;
}

function stripCodeFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

// Search OpenAlex
async function searchOpenAlex(query: string): Promise<ExternalPaper[]> {
  try {
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=10&sort=cited_by_count:desc`,
      { headers: { "User-Agent": "Research-Hub/1.0 (mailto:research@example.com)" } }
    );
    const data = await response.json();
    
    return (data.results || [])
      .filter((work: any) => work.open_access?.oa_url)
      .slice(0, 3)
      .map((work: any) => ({
        title: work.title || "No title",
        abstract: work.abstract || work.display_name || "",
        authors: (work.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name || "Unknown"),
        year: work.publication_year?.toString() || "N/A",
        source: "OpenAlex",
        url: work.open_access.oa_url,
        citations: work.cited_by_count,
      }));
  } catch (error) {
    console.error("OpenAlex search error:", error);
    return [];
  }
}

// Search Semantic Scholar
async function searchSemanticScholar(query: string): Promise<ExternalPaper[]> {
  try {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,year,authors,venue,citationCount,openAccessPdf`,
      { headers: { "User-Agent": "Research-Hub/1.0" } }
    );
    const data = await response.json();
    
    return (data.data || [])
      .filter((paper: any) => paper.openAccessPdf?.url)
      .slice(0, 3)
      .map((paper: any) => ({
        title: paper.title || "No title",
        abstract: paper.abstract || "",
        authors: (paper.authors || []).slice(0, 3).map((a: any) => a.name),
        year: paper.year?.toString() || "N/A",
        source: "Semantic Scholar",
        url: paper.openAccessPdf.url,
        citations: paper.citationCount,
      }));
  } catch (error) {
    console.error("Semantic Scholar search error:", error);
    return [];
  }
}

// Search arXiv
async function searchArXiv(query: string): Promise<ExternalPaper[]> {
  try {
    const response = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`
    );
    const text = await response.text();
    
    const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.map(entry => {
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || "No title";
      const abstract = entry.match(/<summary>(.*?)<\/summary>/)?.[1]?.replace(/\n/g, " ").trim() || "";
      const authors = [...entry.matchAll(/<name>(.*?)<\/name>/g)].map(m => m[1]);
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 4) || "N/A";
      const id = entry.match(/<id>(.*?)<\/id>/)?.[1] || "";
      
      return {
        title: title.replace(/\n/g, " ").trim(),
        abstract,
        authors: authors.slice(0, 3),
        year: published,
        source: "arXiv",
        url: id.replace('/abs/', '/pdf/') + '.pdf',
      };
    });
  } catch (error) {
    console.error("arXiv search error:", error);
    return [];
  }
}

// Mock internal research data
function searchInternalResearch(query: string) {
  const mockData = [
    {
      title: "次世代バッテリー材料の開発と評価",
      tags: ["エネルギー事業部", "材料科学", "電池"],
      similarity: 0.85,
      year: "2023",
    },
    {
      title: "AI駆動型プロセス最適化システム",
      tags: ["製造事業部", "AI/ML", "最適化"],
      similarity: 0.72,
      year: "2024",
    },
  ];
  
  return mockData.filter(d => 
    d.title.toLowerCase().includes(query.toLowerCase().slice(0, 5))
  );
}

// Mock business challenges
function searchBusinessChallenges(query: string) {
  const mockChallenges = [
    {
      challenge: "製造ラインの歩留まり向上（目標：5%改善）",
      business_unit: "製造事業部",
      priority: "高",
      keywords: ["歩留まり", "品質管理", "プロセス改善"],
    },
    {
      challenge: "新規エネルギー貯蔵システムの開発",
      business_unit: "エネルギー事業部",
      priority: "中",
      keywords: ["バッテリー", "エネルギー", "持続可能性"],
    },
  ];
  
  return mockChallenges.filter(c =>
    c.keywords.some(k => query.toLowerCase().includes(k.toLowerCase()))
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, tool, toolQuery, pdfContext, highlightedText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = messages[messages.length - 1].content;
    const encoder = new TextEncoder();

    // For assistant mode, create execution plan first
    if (mode === "assistant") {
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let steps = [];

            // If a specific tool is selected, force execute only that tool
            if (tool && tool !== "none") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "thinking_start" })}\n\n`)
              );

              steps = [{
                tool: tool,
                query: toolQuery || userMessage,
                description: `Execute ${tool} tool with user query`
              }, {
                tool: "chat",
                query: "Summarize the results",
                description: "AI summary of results"
              }];

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "plan", steps })}\n\n`)
              );
            } else {
              // Step 1: Generate execution plan
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "thinking_start" })}\n\n`)
              );

              // Build context-aware planning prompt
              let planningContext = `User query: ${userMessage}\nSelected tool: ${tool || "none"}`;
              
              if (pdfContext) {
                planningContext += `\n\n**IMPORTANT**: User is currently viewing a PDF document. Unless they explicitly ask "他に何か研究はあるか" or similar requests for additional research, DO NOT use the wide-knowledge tool. Focus on analyzing the PDF content they are viewing.`;
              }

              const planResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content: `You are a research planning assistant. Analyze the user query and create a step-by-step execution plan.
Available tools:
- wide-knowledge: Search external papers and research (SKIP if user is viewing a PDF unless they explicitly ask for additional research)
- theme-evaluation: Evaluate research themes against internal research and business needs
- knowwho: Search for experts and researchers
- positioning-analysis: Create positioning analysis comparing research items across multiple axes
- html-generation: Generate HTML infographics summarizing the conversation
- chat: Use AI to summarize or format results

Return a JSON object with "steps" array containing objects with this structure:
{"steps": [
  {"tool": "tool_name", "query": "search query or input", "description": "what this step does"},
  ...
]}

Keep it concise, 2-4 steps maximum. Always end with a "chat" step to summarize.`
                    },
                    { role: "user", content: planningContext }
                  ],
                  response_format: { type: "json_object" }
                }),
              });

              if (!planResponse.ok) {
                throw new Error("Failed to generate plan");
              }

              const planData = await planResponse.json();
              const planRaw = planData.choices?.[0]?.message?.content || "{}";
              const planContent = JSON.parse(stripCodeFence(planRaw));
              steps = planContent.steps || [];

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "plan", steps })}\n\n`)
              );
            }

            // Step 2: Execute each tool in the plan and accumulate results
            let toolResults: any[] = [];
            
            for (let i = 0; i < steps.length; i++) {
              const step = steps[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "step_start", step: i })}\n\n`)
              );

              if (step.tool === "wide-knowledge") {
                const [openAlexResults, semanticResults, arxivResults] = await Promise.all([
                  searchOpenAlex(step.query),
                  searchSemanticScholar(step.query),
                  searchArXiv(step.query),
                ]);

                const externalPapers = [...openAlexResults, ...semanticResults, ...arxivResults]
                  .sort((a, b) => (b.citations || 0) - (a.citations || 0))
                  .slice(0, 5);

                // Store results for later use
                toolResults.push({
                  tool: "wide-knowledge",
                  query: step.query,
                  results: externalPapers
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "research_data",
                      external: externalPapers,
                    })}\n\n`
                  )
                );
              } else if (step.tool === "theme-evaluation") {
                const internalResearch = searchInternalResearch(step.query);
                const businessChallenges = searchBusinessChallenges(step.query);

                const comparison = [
                  {
                    aspect: "技術成熟度",
                    internal: "プロトタイプレベル（TRL 4-5）",
                    external: "研究段階（TRL 2-3）",
                    evaluation: "advantage"
                  },
                  {
                    aspect: "市場適用性",
                    internal: "特定業界向け",
                    external: "汎用的アプローチ",
                    evaluation: "neutral"
                  },
                  {
                    aspect: "理論的新規性",
                    internal: "既存手法の改良",
                    external: "新規アルゴリズム提案",
                    evaluation: "gap"
                  }
                ];

                const needs = businessChallenges.map(c => ({
                  title: c.challenge,
                  department: c.business_unit,
                  priority: c.priority === "高" ? "high" : c.priority === "中" ? "medium" : "low",
                  match_score: Math.floor(Math.random() * 30) + 65
                }));

                // Store results
                toolResults.push({
                  tool: "theme-evaluation",
                  query: step.query,
                  results: { comparison, needs }
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "theme_evaluation",
                      comparison,
                      needs,
                    })}\n\n`
                  )
                );
              } else if (step.tool === "knowwho") {
                const experts = [
                  {
                    name: "Dr. 山田太郎",
                    affiliation: "東京大学 情報理工学研究科",
                    expertise: ["機械学習", "深層学習", "自然言語処理"],
                    publications: 87,
                    h_index: 24,
                    email: "yamada@example.jp"
                  },
                  {
                    name: "Dr. 佐藤花子",
                    affiliation: "京都大学 工学研究科",
                    expertise: ["推薦システム", "情報検索", "Two-Tower Model"],
                    publications: 62,
                    h_index: 19,
                    email: "sato@example.jp"
                  },
                  {
                    name: "Dr. 田中直人",
                    affiliation: "大阪大学 基礎工学研究科",
                    expertise: ["ニューラルネットワーク", "表現学習"],
                    publications: 45,
                    h_index: 16
                  }
                ];

                // Store results
                toolResults.push({
                  tool: "knowwho",
                  query: step.query,
                  results: experts
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "knowwho_results",
                      experts,
                    })}\n\n`
                  )
                );
              } else if (step.tool === "positioning-analysis") {
                console.log("Starting positioning-analysis tool execution");
                
                const positioningPrompt = `あなたは研究ポジショニング分析の専門家です。ユーザーの質問「${step.query}」に基づき、研究のポジショニング分析を行ってください。

以下のJSON形式で出力してください：

{
  "axes": [
    { "name": "軸の名前", "type": "quantitative" }
  ],
  "items": [
    {
      "name": "研究項目名",
      "values": { "軸の名前1": 50, "軸の名前2": 60 },
      "type": "internal"
    }
  ],
  "insights": ["分析結果1"]
}

**指示：**
- axesは最低2軸、推奨3-5軸を生成
- 各軸はquantitative（定量）またはqualitative（定性）
- itemsには internal（社内2-3個）、external（外部3-4個）、target（目標1個）を含む
- 各itemのvaluesには全軸の評価値（0-100）を含む
- insightsは3-5個の実践的分析結果
- 全て日本語で記述`;

                const positioningResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: positioningPrompt },
                      { role: "user", content: step.query }
                    ],
                    response_format: { type: "json_object" }
                  }),
                });

                if (positioningResponse.ok) {
                  const posData = await positioningResponse.json();
                  const positioningContent = JSON.parse(stripCodeFence(posData.choices?.[0]?.message?.content || "{}"));
                  
                  const axisCount = positioningContent.axes?.length || 0;
                  let suggestedChartType = "scatter";
                  if (axisCount === 1) {
                    suggestedChartType = "box";
                  } else if (axisCount >= 3) {
                    suggestedChartType = "radar";
                  }
                  
                  const positioningData = {
                    axes: positioningContent.axes || [],
                    suggestedChartType,
                    items: positioningContent.items || [],
                    insights: positioningContent.insights || []
                  };
                  
                  // Store results
                  toolResults.push({
                    tool: "positioning-analysis",
                    query: step.query,
                    results: positioningData
                  });
                  
                  console.log("Sending dynamic positioning data:", positioningData);
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "positioning_analysis",
                        data: positioningData,
                      })}\n\n`
                    )
                  );
                  
                  console.log("Positioning data sent successfully");
                }
              } else if (step.tool === "add-axis") {
                console.log("[BACKEND] Executing add-axis tool");
                const requestData = JSON.parse(step.query);
                const { positioningData, axisName, axisType } = requestData;
                
                const addAxisPrompt = `既存のポジショニング分析に新しい軸「${axisName}」(${axisType})を追加します。
既存データ: ${JSON.stringify(positioningData)}

各項目(Internal Research, External Research, Target)に対して、新しい軸の評価値(0-100)を生成してください。
既存データとの整合性を保ってください。

JSON形式で出力:
{
  "Internal Research": 75,
  "External Research": 85,
  "Target": 90
}`;

                const addAxisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [{ role: "user", content: addAxisPrompt }],
                    response_format: { type: "json_object" }
                  }),
                });

                if (addAxisResponse.ok) {
                  const addAxisData = await addAxisResponse.json();
                  const addAxisContent = JSON.parse(stripCodeFence(addAxisData.choices?.[0]?.message?.content || "{}"));

                  const updatedPositioning = {
                    ...positioningData,
                    axes: [...positioningData.axes, { name: axisName, type: axisType }],
                    items: positioningData.items.map((item: any) => ({
                      ...item,
                      values: {
                        ...item.values,
                        [axisName]: addAxisContent[item.name] || 50
                      }
                    }))
                  };

                  const axisCount = updatedPositioning.axes?.length || 0;
                  let suggestedChartType = "scatter";
                  if (axisCount === 1) suggestedChartType = "box";
                  else if (axisCount >= 3) suggestedChartType = "radar";
                  updatedPositioning.suggestedChartType = suggestedChartType;

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "positioning_analysis",
                        data: updatedPositioning
                      })}\n\n`
                    )
                  );
                }
              } else if (step.tool === "remove-axis") {
                console.log("[BACKEND] Executing remove-axis tool");
                const requestData = JSON.parse(step.query);
                const { positioningData, axisName } = requestData;
                
                const updatedPositioning = {
                  ...positioningData,
                  axes: positioningData.axes.filter((axis: any) => axis.name !== axisName),
                  items: positioningData.items.map((item: any) => {
                    const { [axisName]: removed, ...remainingValues } = item.values;
                    return {
                      ...item,
                      values: remainingValues
                    };
                  })
                };

                const axisCount = updatedPositioning.axes?.length || 0;
                let suggestedChartType = "scatter";
                if (axisCount === 1) suggestedChartType = "box";
                else if (axisCount >= 3) suggestedChartType = "radar";
                updatedPositioning.suggestedChartType = suggestedChartType;

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "positioning_analysis",
                      data: updatedPositioning
                    })}\n\n`
                  )
                );
              } else if (step.tool === "regenerate-axis") {
                console.log("[BACKEND] Executing regenerate-axis tool");
                const requestData = JSON.parse(step.query);
                const { positioningData, axisName } = requestData;
                
                const regeneratePrompt = `ポジショニング分析の軸「${axisName}」の値を再生成します。
既存データ: ${JSON.stringify(positioningData)}

各項目に対して、新しい評価値(0-100)を生成してください。既存データとの整合性を保ってください。

JSON形式で出力:
{
  "Internal Research": 75,
  "External Research": 85,
  "Target": 90
}`;

                const regenerateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [{ role: "user", content: regeneratePrompt }],
                    response_format: { type: "json_object" }
                  }),
                });

                if (regenerateResponse.ok) {
                  const regenerateData = await regenerateResponse.json();
                  const regenerateContent = JSON.parse(stripCodeFence(regenerateData.choices?.[0]?.message?.content || "{}"));

                  const updatedPositioning = {
                    ...positioningData,
                    items: positioningData.items.map((item: any) => ({
                      ...item,
                      values: {
                        ...item.values,
                        [axisName]: regenerateContent[item.name] || item.values[axisName]
                      }
                    }))
                  };

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "positioning_analysis",
                        data: updatedPositioning
                      })}\n\n`
                    )
                  );
                }
              } else if (step.tool === "seeds-needs-matching") {
                // Generate seeds-needs matching with AI
                const matchingPrompt = `You are a technology transfer analyst. Based on the user's research seed about "${step.query}", generate a seeds-needs matching analysis.

Return a JSON object with this structure:
{
  "seedTitle": "研究シーズのタイトル",
  "seedDescription": "研究シーズの詳細説明（2-3文）",
  "candidates": [
    {
      "title": "ニーズ候補のタイトル",
      "description": "ニーズの詳細（1-2文）",
      "department": "部門名",
      "evaluation": "high" | "medium" | "low",
      "reason": "評価理由の詳細説明",
      "score": 0-100の適合度スコア
    }
  ]
}

- candidates配列には必ず5個のニーズ候補を含めてください
- evaluationは high:2個、medium:2個、low:1個 の配分で
- reasonは具体的で説得力のある評価理由を記述
- scoreはevaluationと整合性を持たせる（high:75-95, medium:50-74, low:30-49）`;

                const matchingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: matchingPrompt },
                      { role: "user", content: step.query }
                    ],
                    response_format: { type: "json_object" }
                  }),
                });

                if (matchingResponse.ok) {
                  const matchData = await matchingResponse.json();
                  const matchContent = JSON.parse(stripCodeFence(matchData.choices?.[0]?.message?.content || "{}"));
                  
                  const matchingData = {
                    seedTitle: matchContent.seedTitle || "",
                    seedDescription: matchContent.seedDescription || "",
                    candidates: matchContent.candidates || []
                  };
                  
                  // Store results
                  toolResults.push({
                    tool: "seeds-needs-matching",
                    query: step.query,
                    results: matchingData
                  });
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "seeds_needs_matching",
                        ...matchingData,
                      })}\n\n`
                    )
                  );
                }
              } else if (step.tool === "html-generation") {
                // Generate HTML infographic with all accumulated tool results
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "html_start" })}\n\n`)
                );

                // Build context from accumulated tool results
                let toolResultsContext = "\n\n**これまでに実行したツールの結果:**\n";
                for (const result of toolResults) {
                  toolResultsContext += `\n### ${result.tool} (Query: ${result.query})\n`;
                  toolResultsContext += JSON.stringify(result.results, null, 2) + "\n";
                }

                const htmlPrompt = `You are an expert HTML generator for an advanced research laboratory. Your sole purpose is to create a single, complete, and visually rich HTML file.

**CRITICAL INSTRUCTIONS**
1. **NEVER** wrap the output in markdown code blocks (no \`\`\`, \`\`\`html, or similar). The first characters must be \`<!DOCTYPE html>\`.
2. ALL CSS and JavaScript **must** live inside <style> and <script> tags in the same file. Do not reference external CSS/JS except well-known icon CDNs if absolutely necessary.
3. Return only valid HTML. No explanations, no commentary, no markdown.

**VISUAL & CONTENT GUIDELINES**
- Emulate a cutting-edge R&D lab briefing or infographic panel.
- Include at least three distinct sections (e.g., overview, metrics, experiments, roadmap) with clear headings.
- Provide multiple data-rich elements: metric cards, comparison tables, timelines, annotated diagrams, or faux sensor readouts. It is acceptable (encouraged) to include synthetic but plausible data/figures as long as they are clearly labeled.
- Incorporate at least two visual flourishes such as SVG charts, CSS-driven graphs, or animated highlights to convey a "noisy", information-dense research environment.
- Use a modern dark theme with gradients, neon accents, and smooth transitions. Icons from a CDN (Font Awesome) are allowed.
- All copy must be in Japanese.

**TASK**
Create a beautiful, interactive HTML infographic summarizing our conversation and all tool results.

**User Query:** ${userMessage}
${toolResultsContext}

Your final output will be rendered directly in a browser. Ensure it is flawless and self-contained.`;

                const htmlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: htmlPrompt },
                      { role: "user", content: userMessage }
                    ],
                    stream: true,
                  }),
                });

                if (htmlResponse.ok && htmlResponse.body) {
                  const reader = htmlResponse.body.getReader();
                  let htmlContent = "";
                  
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      
                      const chunk = new TextDecoder().decode(value);
                      const lines = chunk.split("\n");
                      
                      for (const line of lines) {
                        if (line.startsWith("data: ") && line !== "data: [DONE]") {
                          try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) {
                              htmlContent += content;
                              controller.enqueue(
                                encoder.encode(
                                  `data: ${JSON.stringify({
                                    type: "html_chunk",
                                    content: content,
                                  })}\n\n`
                                )
                              );
                            }
                          } catch (e) {
                            // Skip invalid JSON
                          }
                        }
                      }
                    }
                  } finally {
                    reader.releaseLock();
                  }

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "html_complete" })}\n\n`)
                  );
                }
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "step_complete", step: i })}\n\n`)
              );
            }

            // Step 3: Generate final AI summary with all tool results
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chat_start" })}\n\n`)
            );

            let contextPrompt = `ユーザーの質問: ${userMessage}`;
            
            // Add accumulated tool results
            if (toolResults.length > 0) {
              contextPrompt += `\n\n## これまでに実行したツールの結果:\n`;
              for (const result of toolResults) {
                contextPrompt += `\n### ${result.tool} (Query: ${result.query})\n`;
                contextPrompt += JSON.stringify(result.results, null, 2) + "\n";
              }
            }
            
            contextPrompt += `\n\n上記の検索結果とツール実行結果を踏まえて、R&D研究者向けに簡潔で実践的な回答を生成してください。`;

            // Add PDF context if available
            if (pdfContext) {
              const pdfSnippet = pdfContext.slice(0, 10000);
              contextPrompt += `\n\n<User is showing a document>${pdfSnippet}</User is showing a document>`;
              contextPrompt += `\n\n**重要**: ユーザーは現在PDFを参照しています。このPDFの内容に基づいて回答してください。`;
            }

            if (highlightedText) {
              contextPrompt += `\n\n## ユーザーがハイライトしているテキスト\nユーザーは現在、PDFの以下の部分を選択しています：\n\n「${highlightedText}」\n\nこの部分について質問されている可能性があります。`;
            }

            const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: contextPrompt },
                  ...messages,
                ],
                stream: true,
              }),
            });

            if (summaryResponse.ok && summaryResponse.body) {
              const reader = summaryResponse.body.getReader();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              } finally {
                reader.releaseLock();
              }
            }

          } catch (error) {
            console.error("Assistant mode error:", error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: error instanceof Error ? error.message : "Unknown error",
                })}\n\n`
              )
            );
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Search mode: Execute searches in parallel
    const [openAlexResults, semanticResults, arxivResults, internalResearch, businessChallenges] = 
      await Promise.all([
        searchOpenAlex(userMessage),
        searchSemanticScholar(userMessage),
        searchArXiv(userMessage),
        Promise.resolve(searchInternalResearch(userMessage)),
        Promise.resolve(searchBusinessChallenges(userMessage)),
      ]);

    // Combine external papers
    const externalPapers = [...openAlexResults, ...semanticResults, ...arxivResults]
      .sort((a, b) => (b.citations || 0) - (a.citations || 0))
      .slice(0, 5);

    // Build context for AI
    let contextPrompt = `
あなたはR&D研究者向けのアシスタントです。以下の3つの視点から回答してください：

【社内研究との関連】
${internalResearch.length > 0 ? internalResearch.map(r => 
  `- ${r.title} (類似度: ${(r.similarity * 100).toFixed(0)}%, ${r.year}年)\n  タグ: ${r.tags.join(", ")}`
).join("\n") : "- 関連する社内研究は見つかりませんでした"}

【事業部課題とのひもづけ】
${businessChallenges.length > 0 ? businessChallenges.map(c =>
  `- ${c.challenge}\n  事業部: ${c.business_unit} | 優先度: ${c.priority}\n  キーワード: ${c.keywords.join(", ")}`
).join("\n") : "- 該当する事業部課題は見つかりませんでした"}

【外部論文からの知見】
${externalPapers.length > 0 ? externalPapers.map((p, i) =>
  `${i + 1}. ${p.title}\n   著者: ${p.authors.join(", ")}\n   ${p.source} (${p.year}年)${p.citations ? ` | 被引用数: ${p.citations}` : ""}\n   ${p.abstract.slice(0, 150)}...`
).join("\n\n") : "- 関連する外部論文は見つかりませんでした"}

ユーザーの質問: ${userMessage}

上記の情報を踏まえて、R&D研究者が「提案フェーズ」と「実施フェーズ」の両方で活用できるよう、具体的で実践的な回答を提供してください。`;

    // Add PDF context if available
    if (pdfContext) {
      const pdfSnippet = pdfContext.slice(0, 10000);
      contextPrompt += `\n\n<User is showing a document >${pdfSnippet}</User is showing a document >`;
    }

    if (highlightedText) {
      contextPrompt += `\n\n## ユーザーがハイライトしているテキスト\nユーザーは現在、PDFの以下の部分を選択しています：\n\n「${highlightedText}」\n\nこの部分について質問されている可能性があります。`;
    }

    // Stream AI response
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: contextPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add research data to stream
    const readable = new ReadableStream({
      async start(controller) {
        // First, send the research data
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "research_data",
              internal: internalResearch,
              business: businessChallenges,
              external: externalPapers,
            })}\n\n`
          )
        );

        // Then stream AI response
        const reader = aiResponse.body?.getReader();
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Research chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
