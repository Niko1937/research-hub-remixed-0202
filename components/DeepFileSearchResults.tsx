import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, Image, Code, BookOpen } from "lucide-react";
import { DeepFileSearchResult } from "@/hooks/useResearchChat";

interface DeepFileSearchResultsProps {
  results: DeepFileSearchResult[];
}

const getFileIcon = (type: string) => {
  switch (type) {
    case "data":
      return <FileText className="w-4 h-4 text-blue-500" />;
    case "figure":
      return <Image className="w-4 h-4 text-green-500" />;
    case "code":
      return <Code className="w-4 h-4 text-orange-500" />;
    case "reference":
      return <BookOpen className="w-4 h-4 text-purple-500" />;
    default:
      return <Folder className="w-4 h-4 text-muted-foreground" />;
  }
};

const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case "data":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "figure":
      return "bg-green-500/10 text-green-600 border-green-500/30";
    case "code":
      return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    case "reference":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function DeepFileSearchResults({ results }: DeepFileSearchResultsProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-3">
        <Folder className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          📂 仮想フォルダから {results.length} 件のファイルがヒット
        </span>
      </div>
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
          >
            <div className="mt-0.5">
              {getFileIcon(result.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono text-foreground bg-background px-1.5 py-0.5 rounded">
                  {result.path}
                </code>
                <Badge variant="outline" className={`text-xs ${getTypeBadgeColor(result.type)}`}>
                  {result.type}
                </Badge>
              </div>
              {result.relevantContent && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  {result.relevantContent}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
