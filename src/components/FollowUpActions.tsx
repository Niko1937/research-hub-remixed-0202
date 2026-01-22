import { Button } from "@/components/ui/button";
import { Search, Users, FileText, ArrowRight, Sparkles, TrendingUp } from "lucide-react";

export interface FollowUpAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  tool?: string;
}

interface FollowUpActionsProps {
  actions: FollowUpAction[];
  onActionClick: (action: FollowUpAction) => void;
}

// Helper to generate follow-up actions based on context
export function generateFollowUpActions(
  lastQuery: string,
  resultType: "wide_knowledge" | "deep_file_search" | "research_result" | "positioning" | "knowwho"
): FollowUpAction[] {
  const baseActions: FollowUpAction[] = [];

  switch (resultType) {
    case "wide_knowledge":
    case "research_result":
      baseActions.push(
        {
          icon: <Users className="w-4 h-4" />,
          label: "社内の詳しい人を探す",
          prompt: `「${lastQuery}」に詳しい社内の専門家を教えてください`,
          tool: "knowwho",
        },
        {
          icon: <TrendingUp className="w-4 h-4" />,
          label: "ポジショニング分析",
          prompt: `「${lastQuery}」に関連する研究のポジショニング分析をしてください`,
          tool: "positioning-analysis",
        },
        {
          icon: <Search className="w-4 h-4" />,
          label: "関連トピックを深掘り",
          prompt: `「${lastQuery}」に関連する他のアプローチや手法についても調べてください`,
        }
      );
      break;

    case "deep_file_search":
      baseActions.push(
        {
          icon: <FileText className="w-4 h-4" />,
          label: "この論文の要約を作成",
          prompt: "この論文の要点を整理してサマリーを作成してください",
        },
        {
          icon: <Sparkles className="w-4 h-4" />,
          label: "関連研究との比較",
          prompt: "この研究と類似研究の違いや新規性について教えてください",
        },
        {
          icon: <Search className="w-4 h-4" />,
          label: "引用元を調査",
          prompt: "この論文が参照している重要な先行研究について調べてください",
        }
      );
      break;

    case "positioning":
      baseActions.push(
        {
          icon: <Users className="w-4 h-4" />,
          label: "各研究の専門家を探す",
          prompt: `このポジショニングマップの各研究に詳しい社内の人を教えてください`,
          tool: "knowwho",
        },
        {
          icon: <Sparkles className="w-4 h-4" />,
          label: "ギャップを分析",
          prompt: "このポジショニングマップで空白になっている領域はどこですか？研究機会を教えてください",
        },
        {
          icon: <FileText className="w-4 h-4" />,
          label: "HTML資料を生成",
          prompt: "このポジショニング分析をインフォグラフィックス化してください",
          tool: "html-generation",
        }
      );
      break;

    case "knowwho":
      baseActions.push(
        {
          icon: <Search className="w-4 h-4" />,
          label: "関連する研究を調査",
          prompt: `これらの専門家が取り組んでいる研究分野について詳しく調べてください`,
        },
        {
          icon: <TrendingUp className="w-4 h-4" />,
          label: "専門領域の比較",
          prompt: "これらの専門家の研究領域をポジショニング分析してください",
          tool: "positioning-analysis",
        },
        {
          icon: <FileText className="w-4 h-4" />,
          label: "HTML資料を生成",
          prompt: "この専門家情報をインフォグラフィックス化してください",
          tool: "html-generation",
        }
      );
      break;
  }

  return baseActions.slice(0, 3);
}

export function FollowUpActions({ actions, onActionClick }: FollowUpActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          className="gap-2 text-xs h-auto py-2 px-3 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all group"
          onClick={() => onActionClick(action)}
        >
          {action.icon}
          <span>{action.label}</span>
          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      ))}
    </div>
  );
}
