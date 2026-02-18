import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface NeedCandidate {
  title: string;
  description: string;
  department: string;
  evaluation: "high" | "medium" | "low";
  reason: string;
  score: number;
}

interface SeedsNeedsMatchingProps {
  seedTitle: string;
  seedDescription: string;
  candidates: NeedCandidate[];
}

export function SeedsNeedsMatching({
  seedTitle,
  seedDescription,
  candidates,
}: SeedsNeedsMatchingProps) {
  const getEvaluationIcon = (evaluation: string) => {
    switch (evaluation) {
      case "high":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "low":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
    }
  };

  const getEvaluationColor = (evaluation: string) => {
    switch (evaluation) {
      case "high":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "low":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      default:
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
  };

  const getEvaluationLabel = (evaluation: string) => {
    switch (evaluation) {
      case "high":
        return "高適合";
      case "low":
        return "低適合";
      default:
        return "中適合";
    }
  };

  return (
    <div className="space-y-6">
      {/* Seeds Information */}
      <Card className="bg-card border-border">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            研究シーズ
          </h3>
        </div>
        <div className="p-4">
          <h4 className="text-base font-semibold text-foreground mb-2">
            {seedTitle}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {seedDescription}
          </p>
        </div>
      </Card>

      {/* Needs Candidates Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            ニーズ候補との適合性評価
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  ニーズ候補
                </th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  部門
                </th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground border-b border-border w-24">
                  適合度
                </th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground border-b border-border w-24">
                  評価
                </th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground border-b border-border">
                  評価理由
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate, index) => (
                <tr
                  key={index}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="p-3 border-b border-border/50">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">
                        {candidate.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {candidate.description}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 border-b border-border/50">
                    <Badge variant="outline" className="text-xs">
                      {candidate.department}
                    </Badge>
                  </td>
                  <td className="p-3 border-b border-border/50 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-full max-w-[60px] h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${candidate.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-primary">
                        {candidate.score}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 border-b border-border/50">
                    <div className="flex flex-col items-center gap-1">
                      {getEvaluationIcon(candidate.evaluation)}
                      <Badge
                        variant="outline"
                        className={`text-xs ${getEvaluationColor(
                          candidate.evaluation
                        )}`}
                      >
                        {getEvaluationLabel(candidate.evaluation)}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground border-b border-border/50">
                    {candidate.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
