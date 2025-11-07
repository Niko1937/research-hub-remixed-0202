import { useState } from "react";
import { Send, Sparkles, Search, MessageSquare, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Mode = "search" | "assistant" | "agent";
type Tool = "wide-knowledge" | "theme-evaluation" | "knowwho";

interface ChatInputProps {
  mode: Mode;
  onSubmit: (message: string, tool?: Tool) => void;
  onModeChange: (mode: Mode) => void;
}

export function ChatInput({ mode, onSubmit, onModeChange }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool>("wide-knowledge");

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message, mode === "agent" ? selectedTool : undefined);
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
      : mode === "agent"
      ? "エージェントに依頼する内容を入力..."
      : "質問を入力してください...";

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-4">
      <div className="max-w-4xl mx-auto">
        {/* Unified Chat Input Component */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Text Input Area */}
          <div className="relative flex items-end gap-2 p-3">
            <div className="flex-1 relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent px-3 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={1}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!message.trim()}
              size="icon"
              className="shrink-0 h-10 w-10 bg-primary hover:bg-primary/90 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Bottom Menu Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-background border-t border-border">
            <div className="flex items-center gap-3">
              <Select value={mode} onValueChange={(value) => onModeChange(value as Mode)}>
                <SelectTrigger className="w-[140px] h-8 bg-secondary/50 border-border hover:bg-secondary transition-colors">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {mode === "search" ? (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">検索</span>
                        </>
                      ) : mode === "agent" ? (
                        <>
                          <Infinity className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Agent</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">アシスタント</span>
                        </>
                      )}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="search" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      <span>検索</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Infinity className="w-4 h-4" />
                      <span>Agent</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="assistant" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>アシスタント</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {mode === "agent" && (
                <>
                  <span className="text-xs text-muted-foreground">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tools:</span>
                    <Select value={selectedTool} onValueChange={(value) => setSelectedTool(value as Tool)}>
                      <SelectTrigger className="w-[180px] h-8 bg-secondary/50 border-border hover:bg-secondary transition-colors">
                        <SelectValue>
                          <span className="text-xs font-medium">
                            {selectedTool === "wide-knowledge" && "ワイドナレッジ検索"}
                            {selectedTool === "theme-evaluation" && "テーマ評価"}
                            {selectedTool === "knowwho" && "KnowWho検索"}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="wide-knowledge" className="cursor-pointer">
                          <span>ワイドナレッジ検索</span>
                        </SelectItem>
                        <SelectItem value="theme-evaluation" className="cursor-pointer">
                          <div className="flex flex-col">
                            <span>テーマ評価</span>
                            <span className="text-xs text-muted-foreground">社内外研究・Seeds-Needsマッチング</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="knowwho" className="cursor-pointer">
                          <span>KnowWho検索</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
