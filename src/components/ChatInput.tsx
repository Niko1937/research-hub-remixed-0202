import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  mode: "search" | "assistant";
  onSubmit: (message: string) => void;
}

export function ChatInput({ mode, onSubmit }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholder =
    mode === "search"
      ? "研究論文やドキュメントを検索..."
      : "質問を入力してください...";

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-3 bg-card rounded-xl border border-border p-2 shadow-card">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent px-3 py-2.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            {mode === "assistant" && (
              <Sparkles className="absolute right-3 top-3 w-4 h-4 text-primary" />
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!message.trim()}
            size="icon"
            className="shrink-0 h-10 w-10 bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>
            {mode === "search" ? "検索モード" : "アシスタントモード"} で実行
          </span>
        </div>
      </div>
    </div>
  );
}
