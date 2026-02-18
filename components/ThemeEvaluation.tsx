import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

interface ComparisonItem {
  aspect: string;
  internal: string;
  external: string;
  evaluation: "advantage" | "neutral" | "gap";
}

interface Need {
  title: string;
  department: string;
  priority: "high" | "medium" | "low";
  match_score: number;
}

interface ThemeEvaluationProps {
  comparison: ComparisonItem[];
  needs: Need[];
}

export function ThemeEvaluation({ comparison, needs }: ThemeEvaluationProps) {
  const getEvaluationIcon = (evaluation: string) => {
    switch (evaluation) {
      case "advantage":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "gap":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            社内外研究の比較評価
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  評価観点
                </th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  社内研究
                </th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  外部研究
                </th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground border-b border-border w-20">
                  評価
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="p-3 text-sm font-medium text-foreground border-b border-border/50">
                    {item.aspect}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground border-b border-border/50">
                    {item.internal}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground border-b border-border/50">
                    {item.external}
                  </td>
                  <td className="p-3 border-b border-border/50 text-center">
                    {getEvaluationIcon(item.evaluation)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Needs Matching */}
      <Card className="bg-card border-border">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            事業部Needsとのマッチング候補
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {needs.map((need, index) => (
            <div
              key={index}
              className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    {need.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {need.department}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getPriorityColor(need.priority)}`}
                    >
                      優先度: {need.priority === "high" ? "高" : need.priority === "medium" ? "中" : "低"}
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-xs text-muted-foreground mb-1">
                    マッチ度
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${need.match_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {need.match_score}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
