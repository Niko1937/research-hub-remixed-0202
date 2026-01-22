import { Button } from "@/components/ui/button";
import { Search, Lightbulb, Users, FileText, TrendingUp } from "lucide-react";

interface PromptSample {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

interface PromptSamplesProps {
  onPromptClick: (prompt: string) => void;
}

const initialSamples: PromptSample[] = [
  {
    icon: <Search className="w-4 h-4" />,
    label: "最新のトレンドを調査",
    prompt: "AI・機械学習分野における最新の研究トレンドについて調べてください",
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    label: "研究アイデアの評価",
    prompt: "私の研究アイデアについて、新規性と実現可能性の観点から評価してほしい",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "技術の比較分析",
    prompt: "TransformerとMambaアーキテクチャの違いと各々の強みについて教えて",
  },
  {
    icon: <FileText className="w-4 h-4" />,
    label: "論文のサーベイ",
    prompt: "自然言語処理における最新のファインチューニング手法についてサーベイしてください",
  },
];

export function PromptSamples({ onPromptClick }: PromptSamplesProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-2xl mx-auto">
      {initialSamples.map((sample, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="gap-2 text-xs sm:text-sm h-auto py-2 px-3 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          onClick={() => onPromptClick(sample.prompt)}
        >
          {sample.icon}
          <span>{sample.label}</span>
        </Button>
      ))}
    </div>
  );
}
