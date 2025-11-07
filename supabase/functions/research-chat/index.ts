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

// Search OpenAlex
async function searchOpenAlex(query: string): Promise<ExternalPaper[]> {
  try {
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=3&sort=cited_by_count:desc`,
      { headers: { "User-Agent": "Research-Hub/1.0 (mailto:research@example.com)" } }
    );
    const data = await response.json();
    
    return (data.results || []).map((work: any) => ({
      title: work.title || "No title",
      abstract: work.abstract || work.display_name || "",
      authors: (work.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name || "Unknown"),
      year: work.publication_year?.toString() || "N/A",
      source: "OpenAlex",
      url: work.doi ? `https://doi.org/${work.doi}` : work.id,
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
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,abstract,year,authors,venue,citationCount,url`,
      { headers: { "User-Agent": "Research-Hub/1.0" } }
    );
    const data = await response.json();
    
    return (data.data || []).map((paper: any) => ({
      title: paper.title || "No title",
      abstract: paper.abstract || "",
      authors: (paper.authors || []).slice(0, 3).map((a: any) => a.name),
      year: paper.year?.toString() || "N/A",
      source: "Semantic Scholar",
      url: paper.url || "",
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
        url: id,
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
    const { messages, mode, tool } = await req.json();
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
            // Step 1: Generate execution plan
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "thinking_start" })}\n\n`)
            );

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
- wide-knowledge: Search external papers and research
- theme-evaluation: Evaluate research themes against internal research and business needs
- knowwho: Search for experts and researchers
- chat: Use AI to summarize or format results

Return a JSON object with "steps" array containing objects with this structure:
{"steps": [
  {"tool": "tool_name", "query": "search query or input", "description": "what this step does"},
  ...
]}

Keep it concise, 2-4 steps maximum. Always end with a "chat" step to summarize.`
                  },
                  { role: "user", content: `User query: ${userMessage}\nSelected tool: ${tool || "none"}` }
                ],
                response_format: { type: "json_object" }
              }),
            });

            if (!planResponse.ok) {
              throw new Error("Failed to generate plan");
            }

            const planData = await planResponse.json();
            const planContent = JSON.parse(planData.choices[0].message.content);
            const steps = planContent.steps || [];

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "plan", steps })}\n\n`)
            );

            // Step 2: Execute each tool in the plan
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

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "knowwho_results",
                      experts,
                    })}\n\n`
                  )
                );
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "step_complete", step: i })}\n\n`)
              );
            }

            // Step 3: Generate final AI summary
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chat_start" })}\n\n`)
            );

            const contextPrompt = `ユーザーの質問: ${userMessage}\n\n上記の検索結果とツール実行結果を踏まえて、R&D研究者向けに簡潔で実践的な回答を生成してください。`;

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
    const contextPrompt = `
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
