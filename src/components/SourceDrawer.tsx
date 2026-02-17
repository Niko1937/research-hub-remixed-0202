import { FileText, Building2, Globe, X, TrendingUp, ExternalLink, Microscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResearchData } from "@/hooks/useResearchChat";

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

interface SourceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ResearchData;
  onPdfClick?: (paper: { url: string; title: string; authors?: string[]; source?: string }) => void;
  onDeepDive?: (paper: Paper) => void;
  onResearchIdClick?: (researchId: string) => void;
  selectedResearchIds?: string[];
}

export function SourceDrawer({
  open,
  onOpenChange,
  data,
  onPdfClick,
  onDeepDive,
  onResearchIdClick,
  selectedResearchIds = [],
}: SourceDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col [&>button]:hidden">
        {/* Custom header with close button */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            ソース
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">閉じる</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="internal" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 bg-secondary mx-0 rounded-none shrink-0">
            <TabsTrigger value="internal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              <FileText className="w-3.5 h-3.5 mr-1" />
              社内研究 ({data.internal.length})
            </TabsTrigger>
            <TabsTrigger value="external" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              外部論文 ({data.external.length})
            </TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              <Building2 className="w-3.5 h-3.5 mr-1" />
              事業部課題 ({data.business.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <TabsContent value="internal" className="space-y-3 mt-0">
                {data.internal.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    関連する社内研究が見つかりませんでした
                  </Card>
                ) : (
                  data.internal.map((research, index) => (
                    <Card
                      key={index}
                      className="p-4 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-highlight transition-colors">
                            {research.title}
                          </h4>
                          {research.research_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onResearchIdClick?.(research.research_id!);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                selectedResearchIds.includes(research.research_id)
                                  ? "bg-orange-500 text-white"
                                  : "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                              }`}
                            >
                              研究ID: {research.research_id}
                            </button>
                          )}
                          {research.abstract && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{research.abstract}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              類似度: {(research.similarity * 100).toFixed(0)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">{research.year}年</span>
                          </div>
                          {research.file_path && (
                            <p className="text-xs text-muted-foreground mb-2 break-all">
                              📁 {research.file_path}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {research.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="external" className="space-y-3 mt-0">
                {data.external.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    関連する外部論文が見つかりませんでした
                  </Card>
                ) : (
                  data.external.map((paper, index) => (
                    <Card
                      key={index}
                      className="p-3 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all group cursor-pointer"
                      onClick={() => onPdfClick?.({ url: paper.url, title: paper.title, authors: paper.authors, source: paper.source })}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {paper.id || index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-medium text-foreground group-hover:text-highlight transition-colors line-clamp-2">
                            {paper.title}
                          </h5>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span className="truncate">{paper.authors.slice(0, 2).join(", ")}{paper.authors.length > 2 ? " et al." : ""}</span>
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
                            <Badge variant="secondary" className="text-xs">{paper.source}</Badge>
                            <div className="flex items-center gap-2">
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
                              <button
                                className="flex items-center gap-1 text-xs text-primary hover:text-highlight transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPdfClick?.({ url: paper.url, title: paper.title, authors: paper.authors, source: paper.source });
                                }}
                              >
                                <span>開く</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="business" className="space-y-3 mt-0">
                {data.business.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    該当する事業部課題が見つかりませんでした
                  </Card>
                ) : (
                  data.business.map((challenge, index) => (
                    <Card
                      key={index}
                      className="p-4 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground mb-2 group-hover:text-highlight transition-colors">
                            {challenge.challenge}
                          </h4>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">{challenge.business_unit}</Badge>
                            <Badge variant={challenge.priority === "高" ? "destructive" : "outline"} className="text-xs">
                              優先度: {challenge.priority}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {challenge.keywords.map((keyword, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
