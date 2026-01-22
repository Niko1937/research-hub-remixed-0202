import { useState, useCallback } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface TimelineItem {
  type: "user_message" | "thinking" | "research_result" | "theme_evaluation" | "knowwho_result" | "positioning_analysis" | "seeds_needs_matching" | "html_generation" | "assistant_message";
  timestamp: number;
  data: any;
}

export interface ResearchData {
  summary?: string;
  internal: Array<{
    title: string;
    tags: string[];
    similarity: number;
    year: string;
  }>;
  business: Array<{
    challenge: string;
    business_unit: string;
    priority: string;
    keywords: string[];
  }>;
  external: Array<{
    id?: number;
    title: string;
    abstract: string;
    authors: string[];
    year: string;
    source: string;
    url: string;
    citations?: number;
  }>;
}

export interface Step {
  tool: string;
  query: string;
  description: string;
}

export interface ThemeEvaluation {
  comparison: Array<{
    aspect: string;
    internal: string;
    external: string;
    evaluation: "advantage" | "neutral" | "gap";
  }>;
  needs: Array<{
    title: string;
    department: string;
    priority: "high" | "medium" | "low";
    match_score: number;
  }>;
}

export interface Expert {
  name: string;
  affiliation: string;
  expertise: string[];
  publications: number;
  h_index: number;
  email?: string;
}

const stripLeadingCodeFence = (input: string) =>
  input.replace(/^\s*```[^\n]*\n?/, "");

const stripTrailingCodeFence = (input: string) =>
  input.replace(/\n?\s*```[^\n]*\s*$/i, "");

export function useResearchChat() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (
      content: string,
      mode: "search" | "assistant",
      tool?: string,
      pdfContext?: string,
      highlightedText?: string,
      screenshot?: string,
      deepDiveContext?: {
        source: { title: string; url: string; authors?: string[]; source?: string; year?: string };
        virtualFolder: Array<{ path: string; description: string; type: string }>;
      }
    ) => {
      const userMessage = { role: "user" as const, content };
      const timestamp = Date.now();
      
      // Add user message to timeline
      setTimeline((prev) => [
        ...prev,
        {
          type: "user_message",
          timestamp,
          data: { content },
        },
      ]);
      
      setIsLoading(true);

      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;
        const allMessages = [
          ...timeline
            .filter((item) => item.type === "user_message" || item.type === "assistant_message")
            .map((item) =>
              item.type === "user_message"
                ? { role: "user" as const, content: item.data.content }
                : { role: "assistant" as const, content: item.data.content }
            ),
          userMessage,
        ];

        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            mode,
            tool,
            pdfContext,
            highlightedText,
            screenshot,
            deepDiveContext,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;
        let assistantContent = "";
        let thinkingItemId: number | null = null;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);

              // Handle thinking start
              if (parsed.type === "thinking_start") {
                const thinkingTimestamp = Date.now();
                thinkingItemId = thinkingTimestamp;
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "thinking",
                    timestamp: thinkingTimestamp,
                    data: { steps: [], currentStep: -1 },
                  },
                ]);
                continue;
              }

              // Handle execution plan
              if (parsed.type === "plan") {
                if (thinkingItemId !== null) {
                  setTimeline((prev) =>
                    prev.map((item) =>
                      item.timestamp === thinkingItemId && item.type === "thinking"
                        ? {
                            ...item,
                            data: {
                              steps: parsed.steps || [],
                              currentStep: -1,
                            },
                          }
                        : item
                    )
                  );
                }
                continue;
              }

              // Handle research data from search mode
              if (parsed.type === "research_data") {
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "research_result",
                    timestamp: Date.now(),
                    data: {
                      summary: parsed.summary || "",
                      internal: parsed.internal || [],
                      business: parsed.business || [],
                      external: parsed.external || [],
                    },
                  },
                ]);
                continue;
              }

              // Handle step start
              if (parsed.type === "step_start") {
                if (thinkingItemId !== null) {
                  setTimeline((prev) =>
                    prev.map((item) =>
                      item.timestamp === thinkingItemId && item.type === "thinking"
                        ? {
                            ...item,
                            data: {
                              ...item.data,
                              currentStep: parsed.step,
                            },
                          }
                        : item
                    )
                  );
                }
                continue;
              }

              // Handle step complete
              if (parsed.type === "step_complete") {
                setTimeline((prev) => {
                  const updated = [...prev];
                  // Find last thinking item
                  let lastThinkingIndex = -1;
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].type === "thinking") {
                      lastThinkingIndex = i;
                      break;
                    }
                  }
                  if (lastThinkingIndex !== -1) {
                    const thinkingItem = updated[lastThinkingIndex];
                    updated[lastThinkingIndex] = {
                      ...thinkingItem,
                      data: {
                        ...thinkingItem.data,
                        currentStep: parsed.step + 1,
                      },
                    };
                  }
                  return updated;
                });
                continue;
              }

              // Handle research data (duplicate handler removed - already handled above)

              // Handle theme evaluation
              if (parsed.type === "theme_evaluation") {
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "theme_evaluation",
                    timestamp: Date.now(),
                    data: {
                      comparison: parsed.comparison || [],
                      needs: parsed.needs || [],
                    },
                  },
                ]);
                continue;
              }

              // Handle knowwho results
              if (parsed.type === "knowwho_results") {
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "knowwho_result",
                    timestamp: Date.now(),
                    data: { experts: parsed.experts || [] },
                  },
                ]);
                continue;
              }

              // Handle positioning analysis
              if (parsed.type === "positioning_analysis") {
                console.log("[FRONTEND] Received positioning_analysis event:", parsed);
                console.log("[FRONTEND] Positioning data:", parsed.data);
                console.log("[FRONTEND] Data structure:", {
                  hasAxes: !!parsed.data?.axes,
                  hasItems: !!parsed.data?.items,
                  itemsLength: parsed.data?.items?.length,
                  hasInsights: !!parsed.data?.insights,
                  insightsLength: parsed.data?.insights?.length
                });
                setTimeline((prev) => {
                  const newTimeline: TimelineItem[] = [
                    ...prev,
                    {
                      type: "positioning_analysis" as const,
                      timestamp: Date.now(),
                      data: parsed.data || {},
                    },
                  ];
                  console.log("[FRONTEND] Updated timeline with positioning analysis");
                  return newTimeline;
                });
                continue;
              }

              // Handle seeds-needs matching
              if (parsed.type === "seeds_needs_matching") {
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "seeds_needs_matching",
                    timestamp: Date.now(),
                    data: {
                      seedTitle: parsed.seedTitle || "",
                      seedDescription: parsed.seedDescription || "",
                      candidates: parsed.candidates || [],
                    },
                  },
                ]);
                continue;
              }

              // Handle HTML generation start
              if (parsed.type === "html_start") {
                const htmlTimestamp = Date.now();
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "html_generation",
                    timestamp: htmlTimestamp,
                    data: { html: "", isComplete: false },
                  },
                ]);
                continue;
              }

              // Handle HTML chunks
              if (parsed.type === "html_chunk") {
                setTimeline((prev) => {
                  const newTimeline = [...prev];
                  let lastHtmlIndex = -1;
                  for (let i = newTimeline.length - 1; i >= 0; i--) {
                    if (newTimeline[i].type === "html_generation") {
                      lastHtmlIndex = i;
                      break;
                    }
                  }

                  if (lastHtmlIndex !== -1) {
                    const currentItem = newTimeline[lastHtmlIndex];
                    let newContent = stripLeadingCodeFence(parsed.content);
                    
                    newTimeline[lastHtmlIndex] = {
                      ...currentItem,
                      data: {
                        ...currentItem.data,
                        html: currentItem.data.html + newContent,
                      },
                    };
                  }
                  return newTimeline;
                });
                continue;
              }

              // Handle HTML complete
              if (parsed.type === "html_complete") {
                setTimeline((prev) => {
                  const newTimeline = [...prev];
                  let lastHtmlIndex = -1;
                  for (let i = newTimeline.length - 1; i >= 0; i--) {
                    if (newTimeline[i].type === "html_generation") {
                      lastHtmlIndex = i;
                      break;
                    }
                  }

                  if (lastHtmlIndex !== -1) {
                    const currentItem = newTimeline[lastHtmlIndex];
                    const trimmed = stripTrailingCodeFence(stripLeadingCodeFence(currentItem.data.html));
                    const finalHtml = trimmed.trim();

                    newTimeline[lastHtmlIndex] = {
                      ...currentItem,
                      data: {
                        ...currentItem.data,
                        html: finalHtml,
                        isComplete: true,
                      },
                    };
                  }
                  return newTimeline;
                });
                continue;
              }

              // Handle chat start
              if (parsed.type === "chat_start") {
                // chat_startが来たらthinkingを完了させるために削除または非表示にする必要はない
                // すでに全ステップが実行されているはず
                continue;
              }

              // Handle AI response
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setTimeline((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.type === "assistant_message") {
                    return prev.map((item, i) =>
                      i === prev.length - 1
                        ? { ...item, data: { content: assistantContent } }
                        : item
                    );
                  }
                  return [
                    ...prev,
                    {
                      type: "assistant_message",
                      timestamp: Date.now(),
                      data: { content: assistantContent },
                    },
                  ];
                });
              }
            } catch (e) {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (const raw of textBuffer.split("\n")) {
            if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setTimeline((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.type === "assistant_message") {
                    return prev.map((item, i) =>
                      i === prev.length - 1
                        ? { ...item, data: { content: assistantContent } }
                        : item
                    );
                  }
                  return [
                    ...prev,
                    {
                      type: "assistant_message",
                      timestamp: Date.now(),
                      data: { content: assistantContent },
                    },
                  ];
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setTimeline((prev) => [
          ...prev,
          {
            type: "assistant_message",
            timestamp: Date.now(),
            data: { content: "エラーが発生しました。もう一度お試しください。" },
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [timeline]
  );

  const clearMessages = useCallback(() => {
    setTimeline([]);
  }, []);

  const addAxis = useCallback(
    async (positioningData: any, axisName: string, axisType: "quantitative" | "qualitative") => {
      setIsLoading(true);
      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "add-axis" }],
            mode: "assistant",
            tool: "add-axis",
            toolQuery: JSON.stringify({ positioningData, axisName, axisType }),
          }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to add axis");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "positioning_analysis") {
                setTimeline((prev) =>
                  prev.map((item) =>
                    item.type === "positioning_analysis" ? { ...item, data: parsed.data } : item
                  )
                );
              }
            } catch (e) {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (error) {
        console.error("Add axis error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeAxis = useCallback(
    async (positioningData: any, axisName: string) => {
      setIsLoading(true);
      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "remove-axis" }],
            mode: "assistant",
            tool: "remove-axis",
            toolQuery: JSON.stringify({ positioningData, axisName }),
          }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to remove axis");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "positioning_analysis") {
                setTimeline((prev) =>
                  prev.map((item) =>
                    item.type === "positioning_analysis" ? { ...item, data: parsed.data } : item
                  )
                );
              }
            } catch (e) {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (error) {
        console.error("Remove axis error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const regenerateAxis = useCallback(
    async (positioningData: any, axisName: string) => {
      setIsLoading(true);
      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "regenerate-axis" }],
            mode: "assistant",
            tool: "regenerate-axis",
            toolQuery: JSON.stringify({ positioningData, axisName }),
          }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to regenerate axis");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "positioning_analysis") {
                setTimeline((prev) =>
                  prev.map((item) =>
                    item.type === "positioning_analysis" ? { ...item, data: parsed.data } : item
                  )
                );
              }
            } catch (e) {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (error) {
        console.error("Regenerate axis error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    timeline,
    isLoading,
    sendMessage,
    clearMessages,
    addAxis,
    removeAxis,
    regenerateAxis,
  };
}
