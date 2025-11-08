import { useState, useCallback } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface TimelineItem {
  type: "user_message" | "thinking" | "research_result" | "theme_evaluation" | "knowwho_result" | "html_generation" | "assistant_message";
  timestamp: number;
  data: any;
}

export interface ResearchData {
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

export function useResearchChat() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (
      content: string,
      mode: "search" | "assistant",
      tool?: string,
      pdfContext?: string,
      highlightedText?: string
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

              // Handle research data
              if (parsed.type === "research_data") {
                setTimeline((prev) => [
                  ...prev,
                  {
                    type: "research_result",
                    timestamp: Date.now(),
                    data: {
                      internal: parsed.internal || [],
                      business: parsed.business || [],
                      external: parsed.external || [],
                    },
                  },
                ]);
                continue;
              }

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
                  const updated = [...prev];
                  // Find last HTML generation item
                  let lastHtmlIndex = -1;
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].type === "html_generation") {
                      lastHtmlIndex = i;
                      break;
                    }
                  }
                  if (lastHtmlIndex !== -1) {
                    updated[lastHtmlIndex] = {
                      ...updated[lastHtmlIndex],
                      data: {
                        html: updated[lastHtmlIndex].data.html + parsed.content,
                        isComplete: false,
                      },
                    };
                  }
                  return updated;
                });
                continue;
              }

              // Handle HTML complete
              if (parsed.type === "html_complete") {
                setTimeline((prev) => {
                  const updated = [...prev];
                  // Find last HTML generation item
                  let lastHtmlIndex = -1;
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].type === "html_generation") {
                      lastHtmlIndex = i;
                      break;
                    }
                  }
                  if (lastHtmlIndex !== -1) {
                    updated[lastHtmlIndex] = {
                      ...updated[lastHtmlIndex],
                      data: {
                        ...updated[lastHtmlIndex].data,
                        isComplete: true,
                      },
                    };
                  }
                  return updated;
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
          for (let raw of textBuffer.split("\n")) {
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

  return {
    timeline,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
