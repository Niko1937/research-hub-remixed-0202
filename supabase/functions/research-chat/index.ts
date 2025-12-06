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

// Error handling utilities
function isRetryableError(error: any): boolean {
  // Network errors, timeouts, and 5xx errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error.name === 'AbortError') {
    return true;
  }
  if (error.status && error.status >= 500 && error.status < 600) {
    return true;
  }
  // Rate limiting
  if (error.status === 429) {
    return true;
  }
  return false;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry = () => {},
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable or if we've exhausted retries
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: (error as any).message || error,
        status: (error as any).status,
      });
      
      onRetry(error, attempt + 1);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Search OpenAlex
async function searchOpenAlex(query: string): Promise<ExternalPaper[]> {
  try {
    return await retryWithBackoff(
      async () => {
        const response = await fetchWithTimeout(
          `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=10&sort=cited_by_count:desc`,
          { 
            headers: { "User-Agent": "Research-Hub/1.0 (mailto:research@example.com)" },
            timeout: 15000
          }
        );
        
        if (!response.ok) {
          const error: any = new Error(`OpenAlex API error: ${response.status}`);
          error.status = response.status;
          throw error;
        }
        
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
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt) => {
          console.log(`OpenAlex retry ${attempt}/3:`, (error as any).message);
        }
      }
    );
  } catch (error) {
    console.error("OpenAlex search failed after retries:", {
      error: (error as any).message,
      query,
      stack: (error as any).stack,
    });
    return [];
  }
}

// Search Semantic Scholar
async function searchSemanticScholar(query: string): Promise<ExternalPaper[]> {
  try {
    return await retryWithBackoff(
      async () => {
        const response = await fetchWithTimeout(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,year,authors,venue,citationCount,openAccessPdf`,
          { 
            headers: { "User-Agent": "Research-Hub/1.0" },
            timeout: 15000
          }
        );
        
        if (!response.ok) {
          const error: any = new Error(`Semantic Scholar API error: ${response.status}`);
          error.status = response.status;
          throw error;
        }
        
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
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt) => {
          console.log(`Semantic Scholar retry ${attempt}/3:`, (error as any).message);
        }
      }
    );
  } catch (error) {
    console.error("Semantic Scholar search failed after retries:", {
      error: (error as any).message,
      query,
      stack: (error as any).stack,
    });
    return [];
  }
}

// Search arXiv
async function searchArXiv(query: string): Promise<ExternalPaper[]> {
  try {
    return await retryWithBackoff(
      async () => {
        const response = await fetchWithTimeout(
          `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`,
          { timeout: 15000 }
        );
        
        if (!response.ok) {
          const error: any = new Error(`arXiv API error: ${response.status}`);
          error.status = response.status;
          throw error;
        }
        
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
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt) => {
          console.log(`arXiv retry ${attempt}/3:`, (error as any).message);
        }
      }
    );
  } catch (error) {
    console.error("arXiv search failed after retries:", {
      error: (error as any).message,
      query,
      stack: (error as any).stack,
    });
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

              const planResponse = await retryWithBackoff(
                async () => {
                  const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
- knowwho: Search for experts and researchers
- positioning-analysis: Create positioning analysis comparing research items across multiple axes
- seeds-needs-matching: Match research seeds with business needs
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
                    timeout: 30000
                  });
                  
                  if (!response.ok) {
                    const error: any = new Error(`AI API error: ${response.status}`);
                    error.status = response.status;
                    throw error;
                  }
                  
                  return response;
                },
                {
                  maxRetries: 2,
                  onRetry: (error, attempt) => {
                    console.log(`Plan generation retry ${attempt}/2:`, (error as any).message);
                  }
                }
              );

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

                // Assign citation IDs [1], [2], [3]...
                const numberedPapers = externalPapers.map((paper, idx) => ({
                  ...paper,
                  id: idx + 1
                }));

                // Generate answer with citations using LLM
                let summary = "";
                try {
                  const paperContext = numberedPapers.map(p => 
                    `[${p.id}] "${p.title}" (${p.authors.slice(0, 3).join(", ")}${p.authors.length > 3 ? " et al." : ""}, ${p.year})\n概要: ${p.abstract?.substring(0, 200) || "N/A"}...`
                  ).join("\n\n");

                  const answerPrompt = `あなたは研究支援AIです。ユーザーの質問に対して、以下の論文を出典として引用しながら回答してください。

## ユーザーの質問
${userMessage}

## 検索クエリ
${step.query}

## 参照可能な論文
${paperContext}

## 指示
- ユーザーの質問に直接回答する（研究動向の要約ではない）
- 回答は300-600文字程度の日本語で
- 文中で論文を引用する際は [1]、[2] のように番号で参照
- 必ず複数の論文を引用して回答を裏付ける
- 引用は自然な文脈で埋め込む（例：「〇〇という手法が提案されています[1]」）
- 回答は具体的かつ実用的に`;

                  const answerResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [{ role: "user", content: answerPrompt }],
                      max_tokens: 1000,
                    }),
                  });

                  if (answerResponse.ok) {
                    const answerData = await answerResponse.json();
                    summary = answerData.choices?.[0]?.message?.content || "";
                    console.log("Generated summary with citations:", summary.substring(0, 100));
                  }
                } catch (e) {
                  console.error("Failed to generate summary:", e);
                }

                // Store results for later use (include summary)
                toolResults.push({
                  tool: "wide-knowledge",
                  query: step.query,
                  results: numberedPapers,
                  summary: summary
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "research_data",
                      summary: summary,
                      external: numberedPapers,
                    })}\n\n`
                  )
                );
              } else if (step.tool === "knowwho") {
                // Build context from conversation history and previous tool results
                let knowWhoContext = `ユーザーの質問「${userMessage}」に関連する専門家・研究者を検索します。`;
                
                // Add conversation history context
                if (messages.length > 1) {
                  knowWhoContext += `\n\n## 会話の経緯:\n`;
                  messages.slice(-5).forEach((msg: Message) => {
                    knowWhoContext += `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content.substring(0, 200)}...\n`;
                  });
                }
                
                // Add previous tool results
                if (toolResults.length > 0) {
                  knowWhoContext += `\n\n## これまでに実行したツールの結果:\n`;
                  for (const result of toolResults) {
                    knowWhoContext += `\n### ${result.tool} (Query: ${result.query})\n`;
                    if (result.tool === "wide-knowledge" && result.results) {
                      knowWhoContext += `検索された論文:\n`;
                      for (const paper of result.results.slice(0, 3)) {
                        knowWhoContext += `- "${paper.title}" by ${paper.authors.join(", ")}\n`;
                      }
                    } else {
                      knowWhoContext += JSON.stringify(result.results, null, 2).substring(0, 500) + "...\n";
                    }
                  }
                  knowWhoContext += `\n上記の研究結果や分析を踏まえて、最も関連性の高い専門家を検索してください。`;
                }

                const knowWhoPrompt = `あなたは社内の専門家データベースにアクセスできるシステムです。${knowWhoContext}

現在の検索クエリ: ${step.query}

**重要**: 会話履歴とツール実行結果を参考に、ユーザーの研究テーマに最も関連性の高い社内有識者を選定してください。

以下のJSON形式で専門家リストを返してください：

{
  "experts": [
    {
      "name": "専門家の名前",
      "affiliation": "所属部署（例: 研究開発本部 AI推進室）",
      "role": "役職（例: シニアリサーチャー、主任研究員など）",
      "approachability": "direct" | "introduction" | "via_manager",
      "connectionPath": "つながりの説明（例: 同じ部署 / 共通の知人: 田中さん（企画部）/ 以前のプロジェクトで協業）",
      "suggestedQuestions": [
        "この人に聞けそうな具体的な質問1",
        "この人に聞けそうな具体的な質問2",
        "この人に聞けそうな具体的な質問3"
      ],
      "contactMethods": ["slack", "email"]
    }
  ]
}

**approachability の基準:**
- "direct": 同じチーム、以前協業経験あり、オープンな人 → contactMethods: ["slack", "email"]
- "introduction": 別部署だが共通の知人がいる → contactMethods: ["email", "request_intro"]  
- "via_manager": 階層が離れている、面識なし → contactMethods: ["ask_manager"]

**suggestedQuestions の指針:**
- ユーザーの検索クエリと会話履歴から、この専門家に聞くと有益そうな具体的な質問を3つ生成
- 質問は「〇〇について教えていただけますか？」「〇〇の経験はありますか？」など具体的に
- ユーザーの研究テーマに直結する質問を優先

**指示:**
- experts配列には4-6名の専門家を含めてください
- approachabilityのバランス: direct 1-2名、introduction 2-3名、via_manager 1名程度
- 各専門家の専門性と聞けそうなことが異なるようにバリエーションを持たせる
- connectionPathは具体的に（「同じフロア」「前回のハッカソンで一緒」など）
- 実在しそうな部署名と役職を使用`;

                const knowWhoResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: knowWhoPrompt },
                      { role: "user", content: step.query }
                    ],
                    response_format: { type: "json_object" }
                  }),
                });

                if (knowWhoResponse.ok) {
                  const knowWhoData = await knowWhoResponse.json();
                  const knowWhoContent = JSON.parse(stripCodeFence(knowWhoData.choices?.[0]?.message?.content || "{}"));
                  const experts = knowWhoContent.experts || [];

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
                }
              } else if (step.tool === "positioning-analysis") {
                console.log("Starting positioning-analysis tool execution");
                
                // Build context from previous tool results
                let positioningContext = `ユーザーの質問「${step.query}」に基づき、研究のポジショニング分析を行ってください。`;
                
                if (toolResults.length > 0) {
                  positioningContext += `\n\n## これまでに実行したツールの結果:\n`;
                  for (const result of toolResults) {
                    positioningContext += `\n### ${result.tool} (Query: ${result.query})\n`;
                    positioningContext += JSON.stringify(result.results, null, 2) + "\n";
                  }
                  positioningContext += `\n上記の結果を踏まえて分析を行ってください。`;
                }
                
                const positioningPrompt = `あなたは研究ポジショニング分析の専門家です。${positioningContext}

**重要：比較対象（items）と比較軸（axes）の両方をコンテクストから動的に生成してください。**

比較対象は以下のいずれでも構いません：
- 具体的な研究論文（タイトル、著者を含む）
- 研究テーマや研究アプローチ
- 技術や手法
- 研究機関やプロジェクト

以下のJSON形式で出力してください：

{
  "axes": [
    { "name": "軸の名前（例：技術的新規性、実用性）", "type": "quantitative" }
  ],
  "items": [
    {
      "name": "短縮名（20文字以内、凡例表示用）",
      "fullTitle": "完全なタイトルや詳細な説明（論文の場合は完全なタイトル）",
      "authors": "著者名（論文の場合）または研究者・機関名",
      "source": "出典（例：arXiv, 社内研究, 目標設定）",
      "type": "internal | external | target",
      "values": { "軸の名前1": 50, "軸の名前2": 60 }
    }
  ],
  "insights": ["分析結果1", "分析結果2"]
}

**指示：**
- **比較対象（items）**：コンテクストから5-10個の具体的な比較対象を抽出・生成してください
  - external（外部研究・論文）: 3-5個
  - internal（社内研究・既存アプローチ）: 2-3個
  - target（目標とする位置）: 1-2個
- **比較軸（axes）**：コンテクストと比較対象に基づいて意味のある軸を2-5個生成
  - 各軸はquantitative（定量）またはqualitative（定性）
- 各itemには必ず name, fullTitle, authors, source, type, values を含める
- nameは凡例表示用の短縮名、fullTitleは完全な情報
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
                // Build comprehensive context from conversation and tool results
                let matchingContext = `ユーザーの質問「${userMessage}」に基づき、研究シーズとニーズのマッチング分析を行います。`;
                
                // Add conversation history
                if (messages.length > 1) {
                  matchingContext += `\n\n## 会話の経緯:\n`;
                  messages.slice(-5).forEach((msg: Message) => {
                    matchingContext += `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content.substring(0, 300)}...\n`;
                  });
                }
                
                // Add previous tool results with more detail
                if (toolResults.length > 0) {
                  matchingContext += `\n\n## これまでに実行したツールの結果:\n`;
                  for (const result of toolResults) {
                    matchingContext += `\n### ${result.tool}\n`;
                    matchingContext += `検索クエリ: ${result.query}\n`;
                    matchingContext += `結果:\n${JSON.stringify(result.results, null, 2)}\n\n`;
                  }
                  matchingContext += `\n上記の研究結果、専門家情報、ポジショニング分析を踏まえて、実践的なシーズニーズマッチングを行ってください。`;
                }
                
                // Generate seeds-needs matching with AI
                const matchingPrompt = `あなたは技術移転・産学連携の専門家です。${matchingContext}

現在の分析対象: ${step.query}

**重要**: 会話履歴とツール実行結果（外部論文、社内研究、専門家情報、ポジショニング分析など）を総合的に活用し、実現可能性の高いニーズ候補を提案してください。

以下のJSON形式で出力してください：

{
  "seedTitle": "研究シーズのタイトル（会話内容から具体的に）",
  "seedDescription": "研究シーズの詳細説明（3-4文、技術的特徴と強みを含む）",
  "candidates": [
    {
      "title": "ニーズ候補のタイトル（具体的な適用先）",
      "description": "ニーズの詳細（2-3文、なぜこのニーズに適合するか）",
      "department": "想定される事業部門名（製造、エネルギー、ヘルスケア等）",
      "evaluation": "high" | "medium" | "low",
      "reason": "評価理由の詳細説明（技術的適合性、市場性、実現可能性を含む、3-4文）",
      "score": 0-100の適合度スコア
    }
  ]
}

**指示:**
- candidates配列には必ず6個のニーズ候補を含めてください
- evaluationは high:2個、medium:3個、low:1個 の配分で
- seedDescriptionには、ツール結果から得られた技術的洞察を反映
- 各candidateは、会話やツール結果で言及された具体的な課題や応用分野に基づく
- reasonは、なぜこのシーズがこのニーズに適合するのか、技術的・ビジネス的観点から説得力のある説明
- scoreはevaluationと整合性を持たせる（high:80-95, medium:55-79, low:35-54）
- 全て日本語で記述`;

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

                const htmlPrompt = `あなたは研究レポート作成の専門家です。プロフェッショナルで読みやすいHTML資料を生成します。

**絶対に守るべき指示**
1. **絶対に**マークdownコードブロック(\`\`\`, \`\`\`html等)で囲まない。最初の文字は必ず\`<!DOCTYPE html>\`で始める
2. すべてのCSSとJavaScriptは<style>と<script>タグ内に記述。外部CSSは不可（アイコンCDNは可）
3. 有効なHTMLのみを返す。説明文やコメントは不要

**デザイン指針 - 色彩とコントラストの厳格なルール**

⚠️ **絶対禁止事項**:
- 白背景に白文字、または薄いグレー文字を使用すること
- 背景色との明度差が不十分な文字色を使用すること
- 全てのテキストは背景とのコントラスト比4.5:1以上を確保すること

✅ **必須の配色ルール**:
- **背景色**: 純白（#ffffff）または極薄グレー（#f8f9fa）のみ
- **テキスト色の指定** (以下以外は使用禁止):
  * 大見出し(h1): #1e3a8a（濃紺）
  * 中見出し(h2): #0e7490（ティール）
  * 小見出し(h3): #1f2937（ダークグレー）
  * 本文テキスト: #1f2937（ダークグレー）- 絶対にこの色を使う
  * 補足テキスト: #4b5563（ミディアムグレー）
- **アクセントカラー**:
  * 強調: #ea580c（オレンジ）
  * ポジティブ: #059669（グリーン）
  * データ可視化: #2563eb（ブルー）
- **背景の補助色**:
  * カード背景: #f3f4f6（極薄グレー）
  * 情報ボックス: #eff6ff（極薄ブルー）
  * 警告ボックス: #fef3c7（極薄イエロー）

**レイアウト構造**
- **幅**: 最大1200px、中央揃え、両端余白20-40px
- **縦スクロール型**: 情報密度の高いインフォグラフィックスタイル
- **セクション構成**: 
  1. ヘッダー（タイトル、日付、概要）
  2. エグゼクティブサマリー（要点を箇条書き）
  3. データ可視化セクション（チャート、グラフ、表）
  4. 主要な発見・インサイト（番号付きまたはアイコン付き）
  5. 詳細分析（サブセクションに分割）
  6. 結論と推奨事項
  7. フッター（メタデータ）

**ビジュアル要素**
- SVGやCSS Gridでのチャート・グラフ作成
- 適切なアイコン使用（Unicode記号: 📊 📈 🔍 💡 ✓）
- box-shadowで深度表現（例: 0 2px 8px rgba(0,0,0,0.1)）
- border-radius: 8-12pxでモダンな角丸
- セクション間マージン: 40-60px
- カード内パディング: 20-30px

**タイポグラフィ**
- フォント: system-ui, -apple-system, "Segoe UI", "Noto Sans JP", sans-serif
- h1: 32-40px, font-weight: 700, color: #1e3a8a
- h2: 24-28px, font-weight: 600, color: #0e7490
- h3: 18-20px, font-weight: 600, color: #1f2937
- body: 16px, line-height: 1.6, color: #1f2937
- 小見出し・キャプション: 14px, color: #4b5563

**必須のHTML/Bodyスタイル設定**
<style>タグ内に以下を必ず含めること:
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: #ffffff;
  }
  body {
    color: #1f2937;
  }

**レスポンシブ対応**
- @media (max-width: 768px)でモバイル最適化
- padding、font-sizeを画面幅に応じて調整
- 表は横スクロール可能にする

**タスク**
ユーザーの質問とツール実行結果を基に、研究レポートとしての価値が高い、構造的で読みやすいHTML資料を作成してください。

**ユーザーの質問:** ${userMessage}
${toolResultsContext}

**実装チェックリスト**:
- [ ] すべてのコンテンツは日本語で記述
- [ ] 本文テキストは必ず #1f2937 を使用
- [ ] 見出しは指定された濃い色のみ使用
- [ ] 白文字・薄い文字は一切使用していない
- [ ] データは実行結果から引用し視覚化
- [ ] 論理的な順序で情報を配置
- [ ] 各セクションに適切な見出しとアイコン
- [ ] レスポンシブデザインを実装

**最終確認**: 出力前に全てのテキスト色が白背景で明瞭に読めることを確認してください。`;

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
                      ...messages.filter((m: Message) => m.role !== "system"),
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

                  // Add HTML generation result to toolResults
                  toolResults.push({
                    tool: "html-generation",
                    query: step.query,
                    results: {
                      status: "completed",
                      htmlLength: htmlContent.length,
                      summary: "HTML資料を生成しました"
                    }
                  });

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

            // Build comprehensive context including current and historical tool results
            let contextPrompt = `あなたはR&D研究支援AIアシスタントです。

## 重要な指示:
- これまでの会話履歴全体を参照して、過去の検索結果やツール実行結果を活用してください
- ユーザーが「これまでの議論」「前回の結果」などと言及した場合、会話履歴に含まれる過去の検索結果や分析結果を必ず参照してください
- 会話履歴に含まれる情報を総合的に活用して、一貫性のある回答を提供してください

## 現在のリクエスト:
ユーザーの質問: ${userMessage}`;
            
            // Add accumulated tool results from current request
            if (toolResults.length > 0) {
              contextPrompt += `\n\n## 今回実行したツールの結果:\n`;
              for (const result of toolResults) {
                contextPrompt += `\n### ${result.tool} (Query: ${result.query})\n`;
                contextPrompt += JSON.stringify(result.results, null, 2) + "\n";
              }
            }
            
            // Check if HTML was generated
            const htmlWasGenerated = toolResults.some((result: any) => result.tool === "html-generation");
            
            contextPrompt += `\n\n## 回答方針:
- 会話履歴と今回のツール実行結果を統合して、簡潔で実践的な回答を生成してください
- 過去の検索結果や分析内容を適切に参照してください
- R&D研究者向けに、アクションにつながる具体的な情報を提供してください`;
            
            if (htmlWasGenerated) {
              contextPrompt += `\n\n**重要な指示**: すでにビジュアル資料（HTML）の生成が完了しています。
- この回答では、HTMLコードを一切表示しないでください
- 「資料を生成しました」「ビジュアル資料を作成しました」のような簡潔な完了報告のみを含めてください
- 資料の内容を2-3文で要約してください
- 「以下のHTMLコードを...」のような説明は不要です
- マークダウンのコードブロックやHTMLタグは絶対に出力しないでください`;
            }

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
