import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResearchSidebar } from "@/components/ResearchSidebar";
import { ResearchCard } from "@/components/ResearchCard";
import { ChatInput } from "@/components/ChatInput";
import { ResearchResults } from "@/components/ResearchResults";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { useResearchChat } from "@/hooks/useResearchChat";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type Mode = "search" | "assistant";

const mockResearchData = [
  {
    title: "量子機械学習における新しいアルゴリズムの提案と評価",
    abstract:
      "本研究では、量子コンピューティングと機械学習を融合させた新しいアルゴリズムを提案します。従来の古典的手法と比較して、計算効率が大幅に向上することを実証しました。",
    authors: ["山田太郎", "佐藤花子", "鈴木一郎"],
    date: "2024-03-15",
    tags: ["量子コンピューティング", "機械学習", "アルゴリズム"],
    source: "arXiv",
  },
  {
    title: "深層学習を用いたタンパク質構造予測の精度向上",
    abstract:
      "AlphaFoldを超える精度を目指し、新しいアーキテクチャを提案。実験結果から、特に複雑な構造において顕著な改善が見られました。",
    authors: ["田中美咲", "高橋健太"],
    date: "2024-03-10",
    tags: ["深層学習", "バイオインフォマティクス", "構造予測"],
    source: "Nature",
  },
  {
    title: "大規模言語モデルにおける推論能力の理論的分析",
    abstract:
      "GPTやBERTなどの大規模言語モデルの推論メカニズムを理論的に解析。新しい評価指標を提案し、モデルの解釈可能性を向上させました。",
    authors: ["中村直人", "小林由美"],
    date: "2024-03-05",
    tags: ["自然言語処理", "大規模言語モデル", "推論"],
    source: "ACL",
  },
  {
    title: "強化学習による自律ロボットの協調制御システム",
    abstract:
      "複数の自律ロボットが協調して作業を行うための新しい強化学習フレームワークを開発。実機実験により有効性を検証しました。",
    authors: ["渡辺拓也", "伊藤明"],
    date: "2024-02-28",
    tags: ["強化学習", "ロボティクス", "協調制御"],
    source: "IEEE",
  },
];

const Index = () => {
  const [mode, setMode] = useState<Mode>("search");
  const { messages, isLoading, researchData, sendMessage } = useResearchChat();

  const handleSubmit = (message: string, tool?: string) => {
    sendMessage(message, mode, tool);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background w-full">
        <ResearchSidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-32">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {mode === "search" ? "研究資料を検索" : "AIアシスタント"}
                  </h3>
                  <p className="text-muted-foreground max-w-md">
                    {mode === "search" 
                      ? "キーワードや研究テーマを入力して、外部論文・社内研究・事業部課題を検索します"
                      : "研究に関する質問や、論文の解説、アイデアの整理など、何でもお手伝いします"}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {mode === "search" && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        検索結果
                      </h3>
                      {researchData ? (
                        <ResearchResults data={researchData} />
                      ) : isLoading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          <span>検索中...</span>
                        </div>
                      ) : (
                        <div className="text-center p-8 text-muted-foreground">
                          <p>検索結果が見つかりませんでした</p>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "assistant" && messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-4 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-card-foreground border border-border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">
                        {mode === "search" ? "検索中..." : "AI が回答を生成中..."}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <ChatInput mode={mode} onSubmit={handleSubmit} onModeChange={setMode} />
      </main>
    </div>
    </SidebarProvider>
  );
};

export default Index;
