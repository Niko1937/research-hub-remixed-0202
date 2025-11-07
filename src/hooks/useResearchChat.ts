import { useState, useCallback } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [thinkingStatus, setThinkingStatus] = useState<"planning" | "executing" | "completed" | null>(null);
  const [executionPlan, setExecutionPlan] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [themeEvaluation, setThemeEvaluation] = useState<ThemeEvaluation | null>(null);
  const [experts, setExperts] = useState<Expert[]>([]);

  const sendMessage = useCallback(
    async (content: string, mode: "search" | "assistant", tool?: string) => {
      const userMessage: Message = { role: "user", content };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setResearchData(null);
      setThinkingStatus(null);
      setExecutionPlan([]);
      setCurrentStep(-1);
      setThemeEvaluation(null);
      setExperts([]);

      try {
        const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`;

        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            mode,
            tool,
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
                setThinkingStatus("planning");
                continue;
              }

              // Handle execution plan
              if (parsed.type === "plan") {
                setExecutionPlan(parsed.steps || []);
                setThinkingStatus("executing");
                continue;
              }

              // Handle step start
              if (parsed.type === "step_start") {
                setCurrentStep(parsed.step);
                continue;
              }

              // Handle step complete
              if (parsed.type === "step_complete") {
                continue;
              }

              // Handle research data
              if (parsed.type === "research_data") {
                setResearchData((prev) => ({
                  internal: parsed.internal || prev?.internal || [],
                  business: parsed.business || prev?.business || [],
                  external: [...(prev?.external || []), ...(parsed.external || [])],
                }));
                continue;
              }

              // Handle theme evaluation
              if (parsed.type === "theme_evaluation") {
                setThemeEvaluation({
                  comparison: parsed.comparison || [],
                  needs: parsed.needs || [],
                });
                continue;
              }

              // Handle knowwho results
              if (parsed.type === "knowwho_results") {
                setExperts(parsed.experts || []);
                continue;
              }

              // Handle chat start
              if (parsed.type === "chat_start") {
                setThinkingStatus("completed");
                continue;
              }

              // Handle AI response
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: assistantContent } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
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
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: assistantContent } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "エラーが発生しました。もう一度お試しください。",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setResearchData(null);
    setThinkingStatus(null);
    setExecutionPlan([]);
    setCurrentStep(-1);
    setThemeEvaluation(null);
    setExperts([]);
  }, []);

  return {
    messages,
    isLoading,
    researchData,
    thinkingStatus,
    executionPlan,
    currentStep,
    themeEvaluation,
    experts,
    sendMessage,
    clearMessages,
  };
}
