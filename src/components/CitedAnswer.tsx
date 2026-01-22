import { useRef, useCallback, useState } from "react";
import { Globe, ExternalLink, TrendingUp, ChevronDown, ChevronRight, Microscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Paper {
  id?: number;
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  citations?: number;
}

interface CitedAnswerProps {
  summary: string;
  papers: Paper[];
  onPaperClick?: (paper: { url: string; title: string; authors?: string[]; source?: string }) => void;
  onDeepDive?: (paper: Paper) => void;
}

export function CitedAnswer({ summary, papers, onPaperClick, onDeepDive }: CitedAnswerProps) {
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const sourceRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const scrollToSource = useCallback((id: number) => {
    setIsSourcesOpen(true);
    
    setTimeout(() => {
      const element = sourceRefs.current.get(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }, 100);
  }, []);

  const getPaperById = useCallback((id: number) => {
    return papers.find(p => p.id === id);
  }, [papers]);

  // Convert citation references [1] to clickable links in markdown
  const processedSummary = summary.replace(/\[(\d+)\]/g, (match, num) => {
    const paper = getPaperById(parseInt(num, 10));
    if (paper) {
      return `<cite data-id="${num}">[${num}]</cite>`;
    }
    return match;
  });

  return (
    <div className="space-y-4">
      {/* Sources Section - Collapsible (shown first) */}
      {papers.length > 0 && (
        <Collapsible open={isSourcesOpen} onOpenChange={setIsSourcesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
            {isSourcesOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Globe className="w-4 h-4" />
            出典 ({papers.length})
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3">
            <div className="space-y-2">
              {papers.map((paper, index) => (
                <div
                  key={index}
                  ref={(el) => {
                    if (el && paper.id) {
                      sourceRefs.current.set(paper.id, el);
                    }
                  }}
                >
                  <Card
                    className="p-3 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Citation Number */}
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {paper.id || index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 
                          className="text-sm font-medium text-foreground group-hover:text-highlight transition-colors line-clamp-2 cursor-pointer"
                          onClick={() =>
                            onPaperClick?.({
                              url: paper.url,
                              title: paper.title,
                              authors: paper.authors,
                              source: paper.source,
                            })
                          }
                        >
                          {paper.title}
                        </h5>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="truncate">
                            {paper.authors.slice(0, 2).join(", ")}
                            {paper.authors.length > 2 ? " et al." : ""}
                          </span>
                          <span>•</span>
                          <span>{paper.year}</span>
                          {paper.citations !== undefined && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>{paper.citations}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {paper.source}
                          </Badge>
                          
                          <div className="flex items-center gap-2">
                            {/* DeepDive Button */}
                            {paper.url && onDeepDive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeepDive(paper);
                                }}
                              >
                                <Microscope className="w-3 h-3" />
                                <span>DeepDive</span>
                              </Button>
                            )}
                            
                            {/* Open Button */}
                            <button
                              className="flex items-center gap-1 text-xs text-primary hover:text-highlight transition-colors"
                              onClick={() =>
                                onPaperClick?.({
                                  url: paper.url,
                                  title: paper.title,
                                  authors: paper.authors,
                                  source: paper.source,
                                })
                              }
                            >
                              <span>開く</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Answer Section - Markdown rendered below sources */}
      {summary && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Style headers
              h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
              // Style paragraphs
              p: ({ children }) => <p className="text-sm text-foreground leading-relaxed mb-3">{children}</p>,
              // Style lists
              ul: ({ children }) => <ul className="list-disc list-inside text-sm text-foreground mb-3 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-foreground mb-3 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm text-foreground">{children}</li>,
              // Style links
              a: ({ href, children }) => (
                <a href={href} className="text-primary hover:text-highlight underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              // Style code
              code: ({ children, className }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                ) : (
                  <code className="block bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">{children}</code>
                );
              },
              // Style blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground my-3">
                  {children}
                </blockquote>
              ),
              // Style tables
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="min-w-full border border-border text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-border bg-muted px-3 py-2 text-left font-medium">{children}</th>,
              td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
              // Style strong/bold
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              // Style emphasis/italic
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
