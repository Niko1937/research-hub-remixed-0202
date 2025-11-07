import { FileText, Building2, Globe, ExternalLink, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResearchData } from "@/hooks/useResearchChat";

interface ResearchResultsProps {
  data: ResearchData;
}

export function ResearchResults({ data }: ResearchResultsProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="external" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="external" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Globe className="w-4 h-4 mr-2" />
            外部論文 ({data.external.length})
          </TabsTrigger>
          <TabsTrigger value="internal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" />
            社内研究 ({data.internal.length})
          </TabsTrigger>
          <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4 mr-2" />
            事業部課題 ({data.business.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="external" className="space-y-3 mt-4">
          {data.external.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              関連する外部論文が見つかりませんでした
            </Card>
          ) : (
            data.external.map((paper, index) => (
              <Card
                key={index}
                className="p-4 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                    <Globe className="w-4 h-4 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-highlight transition-colors line-clamp-2">
                      {paper.title}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="truncate">{paper.authors.join(", ")}</span>
                      <span>•</span>
                      <span>{paper.year}</span>
                      {paper.citations !== undefined && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{paper.citations} 引用</span>
                          </div>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {paper.abstract}
                    </p>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {paper.source}
                      </Badge>
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:text-highlight transition-colors"
                      >
                        <span>詳細を見る</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

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
