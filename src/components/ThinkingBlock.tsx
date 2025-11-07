import { useState } from "react";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Step {
  tool: string;
  query: string;
  description: string;
}

interface ThinkingBlockProps {
  steps: Step[];
  status: "planning" | "executing" | "completed";
  currentStep?: number;
}

export function ThinkingBlock({ steps, status, currentStep = -1 }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusText = () => {
    if (status === "planning") return "Thinking...";
    if (status === "executing") return "Researching";
    return "Complete";
  };

  return (
    <Card className="bg-muted/50 border-border overflow-hidden">
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">{getStatusText()}</h3>
              {status === "executing" && currentStep >= 0 && (
                <p className="text-xs text-muted-foreground">
                  {steps[currentStep]?.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              元に戻す ({isExpanded ? "縮小" : "拡大"})
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {isExpanded && steps.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">実行計画:</p>
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  index === currentStep
                    ? "bg-primary/10 border border-primary/20"
                    : index < currentStep
                    ? "bg-card/50 opacity-60"
                    : "bg-card/30"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                    index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : index < currentStep
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{step.tool}</div>
                  <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                  {step.query && (
                    <div className="text-xs text-muted-foreground/80 mt-1 italic">
                      クエリ: {step.query}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
