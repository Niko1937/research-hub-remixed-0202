import { useState } from "react";
import { ResearchSidebar } from "@/components/ResearchSidebar";
import { ResearchCard } from "@/components/ResearchCard";
import { ModeToggle } from "@/components/ModeToggle";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

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
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  const handleSubmit = (message: string) => {
    if (mode === "search") {
      console.log("Search query:", message);
    } else {
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      // Simulate assistant response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "申し訳ございません。これはデモ版のため、実際のAI応答機能はまだ実装されていません。",
          },
        ]);
      }, 1000);
    }
  };

  return (
    <div className="flex h-screen bg-background w-full">
      <ResearchSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {mode === "search" ? "研究資料検索" : "AIアシスタント"}
              </h2>
            </div>
            <ModeToggle mode={mode} onModeChange={setMode} />
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {mode === "search" ? (
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    おすすめの研究資料
                  </h3>
                </div>
                {mockResearchData.map((research, index) => (
                  <ResearchCard key={index} {...research} />
                ))}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6 pb-32">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      AIアシスタントへようこそ
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      研究に関する質問や、論文の解説、アイデアの整理など、何でもお手伝いします。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-card-foreground border border-border"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <ChatInput mode={mode} onSubmit={handleSubmit} />
      </main>
    </div>
  );
};

export default Index;
