import { useState } from "react";
import { Send, Wrench, X, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type Tool = "wide-knowledge" | "theme-evaluation" | "knowwho" | "html-generation";
type Mode = "search" | "assistant";

interface ChatInputProps {
  onSubmit: (message: string, tool?: Tool) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ChatInput({ onSubmit, mode, onModeChange }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolPopoverOpen, setToolPopoverOpen] = useState(false);

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message, selectedTool || undefined);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toolLabels: Record<Tool, string> = {
    "wide-knowledge": "ワイドナレッジ検索",
    "theme-evaluation": "テーマ評価",
    "knowwho": "KnowWho検索",
    "html-generation": "HTML資料生成",
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setToolPopoverOpen(false);
  };

  const handleToolRemove = () => {
    setSelectedTool(null);
  };

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
                placeholder="質問を入力してください..."
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
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant={mode === "search" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => onModeChange("search")}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>検索</span>
                </Button>
                <Button
                  variant={mode === "assistant" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => onModeChange("assistant")}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>アシスタント</span>
                </Button>
              </div>

              {/* Tools - Only show in Assistant mode */}
              {mode === "assistant" && (
                <>
                  <Popover open={toolPopoverOpen} onOpenChange={setToolPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Tools</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => handleToolSelect("wide-knowledge")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">ワイドナレッジ検索</div>
                          <div className="text-xs text-muted-foreground">幅広い知識ベースから検索</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("theme-evaluation")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">テーマ評価</div>
                          <div className="text-xs text-muted-foreground">社内外研究・Seeds-Needsマッチング</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("knowwho")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">KnowWho検索</div>
                          <div className="text-xs text-muted-foreground">専門家・研究者を検索</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("html-generation")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">HTML資料生成</div>
                          <div className="text-xs text-muted-foreground">会話内容をインフォグラフィックス化</div>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Selected Tool Badge */}
                  {selectedTool && (
                    <Badge variant="secondary" className="gap-2 pr-1">
                      <span className="text-xs">{toolLabels[selectedTool]}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={handleToolRemove}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
