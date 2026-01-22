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
    // Open sources section first if closed
    setIsSourcesOpen(true);
    
    // Wait for collapsible to open, then scroll
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

  // Parse summary and replace [1], [2] with clickable citations
  const renderSummaryWithCitations = useCallback(() => {
    const citationRegex = /\[(\d+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(summary)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {summary.slice(lastIndex, match.index)}
          </span>
        );
      }

      const citationId = parseInt(match[1], 10);
      const paper = getPaperById(citationId);

      if (paper) {
        parts.push(
          <TooltipProvider key={`citation-${match.index}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium transition-colors"
                  onClick={() => scrollToSource(citationId)}
                >
                  <sup className="text-xs font-bold hover:underline">[{citationId}]</sup>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium text-sm">{paper.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {paper.authors.slice(0, 2).join(", ")}{paper.authors.length > 2 ? " et al." : ""}, {paper.year}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      } else {
        parts.push(
          <sup key={`citation-${match.index}`} className="text-xs text-muted-foreground">
            [{citationId}]
          </sup>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < summary.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {summary.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [summary, getPaperById, scrollToSource]);

  return (
    <div className="space-y-6">
      {/* Answer Section */}
      {summary && (
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <p className="text-sm leading-relaxed text-foreground">
            {renderSummaryWithCitations()}
          </p>
        </div>
      )}

      {/* Sources Section - Collapsible */}
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
    </div>
  );
}
