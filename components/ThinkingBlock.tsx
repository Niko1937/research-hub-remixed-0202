import { Brain, CheckCircle2, Circle, Loader2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

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
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
          {isAllCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Brain className="w-4 h-4 text-primary animate-pulse" />
          )}
          <span>{isAllCompleted ? "実行完了" : "実行ステップ"}</span>
        </div>

        <div className="space-y-1">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep && !isAllCompleted;
            const isPending = index > currentStep;
            const [isOpen, setIsOpen] = useState(false);

            return (
              <Collapsible
                key={index}
                open={isOpen}
                onOpenChange={setIsOpen}
              >
                <div
                  className={`rounded-md transition-all ${
                    isCurrent
                      ? "bg-primary/10"
                      : isCompleted
                      ? "bg-muted/30"
                      : "bg-muted/10 opacity-60"
                  }`}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {step.tool}
                      </Badge>
                      <span className="text-sm text-foreground truncate flex-1 text-left">
                        {step.description}
                      </span>
                      {isCurrent && (
                        <span className="text-xs text-primary font-medium shrink-0">実行中</span>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-3 pb-2 pl-9 space-y-1">
                      <p className="text-sm text-foreground">{step.description}</p>
                      {step.query && (
                        <p className="text-xs text-muted-foreground">クエリ: {step.query}</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
