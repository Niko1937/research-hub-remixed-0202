import { Brain, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Step {
  tool: string;
  query: string;
  description: string;
}

interface ThinkingBlockProps {
  steps: Step[];
  currentStep: number;
}

export function ThinkingBlock({ steps, currentStep }: ThinkingBlockProps) {
  const isAllCompleted = currentStep >= steps.length;

  return (
    <Card className="bg-card border-border">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {isAllCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Brain className="w-4 h-4 text-primary animate-pulse" />
          )}
          <span>{isAllCompleted ? "実行完了" : "実行ステップ"}</span>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep && !isAllCompleted;
            const isPending = index > currentStep;

            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  isCurrent
                    ? "bg-primary/10 border-l-2 border-primary"
                    : isCompleted
                    ? "bg-muted/50"
                    : "bg-muted/20 opacity-50"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {step.tool}
                    </Badge>
                    {isCurrent && (
                      <span className="text-xs text-primary font-medium">実行中...</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{step.description}</p>
                  {step.query && (
                    <p className="text-xs text-muted-foreground mt-1">クエリ: {step.query}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
