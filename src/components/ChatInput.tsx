import { useState } from "react";
import { Send, Sparkles, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChatInputProps {
  mode: "search" | "assistant";
  onSubmit: (message: string) => void;
  onModeChange: (mode: "search" | "assistant") => void;
}

export function ChatInput({ mode, onSubmit, onModeChange }: ChatInputProps) {
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
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Text Input Area */}
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

        {/* Bottom Menu - Mode Selection */}
        <div className="flex items-center gap-3">
          <Select value={mode} onValueChange={(value) => onModeChange(value as "search" | "assistant")}>
            <SelectTrigger className="w-[180px] h-9 bg-secondary border-border">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {mode === "search" ? (
                    <>
                      <Search className="w-4 h-4" />
                      <span className="text-sm">検索</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm">アシスタント</span>
                    </>
                  )}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="search">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span>検索</span>
                </div>
              </SelectItem>
              <SelectItem value="assistant">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>アシスタント</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            で実行
          </span>
        </div>
      </div>
    </div>
  );
}
