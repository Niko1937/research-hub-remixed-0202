import { FileText, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResearchData } from "@/hooks/useResearchChat";
import { CitedAnswer } from "@/components/CitedAnswer";

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

interface ResearchResultsProps {
  data: ResearchData;
  onPdfClick?: (paper: { url: string; title: string; authors?: string[]; source?: string }) => void;
  onDeepDive?: (paper: Paper) => void;
}

export function ResearchResults({ data, onPdfClick, onDeepDive }: ResearchResultsProps) {
  // If we have a summary (cited answer format), show the new layout
  // Answer text first, then all citation tabs below
  if (data.summary && data.external.length > 0) {
    return (
      <div className="space-y-4">
        {/* Answer section only (no sources collapsible) */}
        <CitedAnswer
          summary={data.summary}
          papers={data.external}
          onPaperClick={onPdfClick}
          onDeepDive={onDeepDive}
        />
        
        {/* Citation tabs: 社内研究 → 外部論文 → 事業部課題 */}
        <Tabs defaultValue="internal" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger value="internal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="w-4 h-4 mr-2" />
              社内研究 ({data.internal.length})
            </TabsTrigger>
            <TabsTrigger value="external" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              外部論文 ({data.external.length})
            </TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="w-4 h-4 mr-2" />
              事業部課題 ({data.business.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="space-y-3 mt-4">
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
                      <h4 className="text-sm font-semibold text-foreground mb-2 group-hover:text-highlight transition-colors">
                        {research.title}
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          類似度: {(research.similarity * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">{research.year}年</span>
                      </div>
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

          <TabsContent value="external" className="space-y-3 mt-4">
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
                            <span>引用: {paper.citations}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">{paper.source}</Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="business" className="space-y-3 mt-4">
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
        </Tabs>
      </div>
    );
  }

  // Fallback to original tab layout if no summary
  return (
    <div className="space-y-4">
      <Tabs defaultValue="internal" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="internal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" />
            社内研究 ({data.internal.length})
          </TabsTrigger>
          <TabsTrigger value="external" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            外部論文 ({data.external.length})
          </TabsTrigger>
          <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4 mr-2" />
            事業部課題 ({data.business.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal" className="space-y-3 mt-4">
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
                    <h4 className="text-sm font-semibold text-foreground mb-2 group-hover:text-highlight transition-colors">
                      {research.title}
                    </h4>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        類似度: {(research.similarity * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">{research.year}年</span>
                    </div>

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

        <TabsContent value="external" className="space-y-3 mt-4">
          {data.external.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              関連する外部論文が見つかりませんでした
            </Card>
          ) : (
            <CitedAnswer
              summary=""
              papers={data.external}
              onPaperClick={onPdfClick}
              onDeepDive={onDeepDive}
            />
          )}
        </TabsContent>

        <TabsContent value="business" className="space-y-3 mt-4">
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
                      <Badge variant="secondary" className="text-xs">
                        {challenge.business_unit}
                      </Badge>
                      <Badge
                        variant={challenge.priority === "高" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        優先度: {challenge.priority}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {challenge.keywords.map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
