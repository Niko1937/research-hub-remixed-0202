import { useState } from "react";
import { Send, Wrench, X, Search, MessageSquare, FileText, Camera, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type Tool = "wide-knowledge" | "knowwho" | "positioning-analysis" | "seeds-needs-matching" | "html-generation" | "deep-file-search";
type Mode = "search" | "assistant";

interface ChatInputProps {
  onSubmit: (message: string, tool?: Tool, pdfContext?: string, highlightedText?: string, screenshot?: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  highlightedText?: string;
  pdfContext?: string;
  onClearHighlight?: () => void;
  isDeepDiveActive?: boolean;
  screenshot?: string | null;
  onCaptureScreenshot?: () => void;
  onClearScreenshot?: () => void;
}

export function ChatInput({ 
  onSubmit, 
  mode, 
  onModeChange,
  highlightedText,
  pdfContext,
  onClearHighlight,
  isDeepDiveActive,
  screenshot,
  onCaptureScreenshot,
  onClearScreenshot,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolPopoverOpen, setToolPopoverOpen] = useState(false);

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message, selectedTool || undefined, pdfContext, highlightedText, screenshot || undefined);
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
    "knowwho": "KnowWho検索",
    "positioning-analysis": "ポジショニング分析",
    "seeds-needs-matching": "シーズ・ニーズマッチング",
    "html-generation": "HTML資料生成",
    "deep-file-search": "🔍 DeepFileSearch",
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setToolPopoverOpen(false);
  };

  const handleToolRemove = () => {
    setSelectedTool(null);
  };

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Unified Chat Input Component */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* PDF Context Indicators */}
          {(highlightedText || pdfContext || screenshot || isDeepDiveActive) && (
            <div className="px-4 pt-3 pb-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isDeepDiveActive && (
                  <Badge className="gap-1.5 bg-primary/20 text-primary border-primary/30">
                    <span className="text-xs font-medium">🔬 DeepDive中</span>
                  </Badge>
                )}
                {pdfContext && (
                  <Badge variant="secondary" className="gap-1.5">
                    <FileText className="w-3 h-3" />
                    <span className="text-xs">PDF参照中</span>
                  </Badge>
                )}
              </div>
              {highlightedText && (
                <Badge 
                  className="gap-2 pr-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800 max-w-full"
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="text-xs truncate">
                    選択中: {highlightedText.slice(0, 50)}
                    {highlightedText.length > 50 ? "..." : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent shrink-0"
                    onClick={onClearHighlight}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
              {screenshot && (
                <Badge 
                  className="gap-2 pr-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
                >
                  <ImageIcon className="w-3 h-3 shrink-0" />
                  <span className="text-xs">スクリーンショット添付中</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent shrink-0"
                    onClick={onClearScreenshot}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}

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
              className={`shrink-0 h-10 w-10 rounded-lg ${
                highlightedText 
                  ? "bg-yellow-500 hover:bg-yellow-600" 
                  : "bg-primary hover:bg-primary/90"
              }`}
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
                        {/* DeepDive専用ツール */}
                        {isDeepDiveActive && (
                          <button
                            onClick={() => handleToolSelect("deep-file-search")}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                          >
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">🔍 DeepFileSearch</div>
                            <div className="text-xs text-blue-600 dark:text-blue-400">論文の仮想データフォルダから関連資料を検索</div>
                          </button>
                        )}
                        <button
                          onClick={() => handleToolSelect("wide-knowledge")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">ワイドナレッジ検索</div>
                          <div className="text-xs text-muted-foreground">幅広い知識ベースから検索</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("knowwho")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">KnowWho検索</div>
                          <div className="text-xs text-muted-foreground">専門家・研究者を検索</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("positioning-analysis")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">ポジショニング分析</div>
                          <div className="text-xs text-muted-foreground">比較検討軸でビジュアル分析</div>
                        </button>
                        <button
                          onClick={() => handleToolSelect("seeds-needs-matching")}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">シーズ・ニーズマッチング</div>
                          <div className="text-xs text-muted-foreground">研究シーズとニーズ候補を評価</div>
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

              {/* Screenshot Button - Only show in DeepDive mode */}
              {isDeepDiveActive && onCaptureScreenshot && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 gap-2 text-xs ${screenshot ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : ""}`}
                  onClick={onCaptureScreenshot}
                  disabled={!!screenshot}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{screenshot ? "キャプチャ済" : "📸 スクショ"}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
