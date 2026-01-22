import { X, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface VirtualFile {
  path: string;
  description: string;
  type: "data" | "figure" | "reference" | "code";
}

export interface DeepDiveSource {
  id?: number;
  title: string;
  url: string;
  authors?: string[];
  source?: string;
  year?: string;
}

interface DeepDiveBannerProps {
  source: DeepDiveSource;
  onClose: () => void;
  hasPdfContext?: boolean;
  hasScreenshot?: boolean;
}

export function DeepDiveBanner({ source, onClose, hasPdfContext, hasScreenshot }: DeepDiveBannerProps) {
  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-primary/20 rounded-lg shrink-0">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                  DeepDive中
                </Badge>
                {source.source && (
                  <Badge variant="outline" className="text-xs">
                    {source.source}
                  </Badge>
                )}
                {hasPdfContext && (
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    📄 PDF読込済
                  </Badge>
                )}
                {hasScreenshot && (
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    📸 スクショ添付
                  </Badge>
                )}
              </div>
              
              <h4 className="text-sm font-medium text-foreground line-clamp-1" title={source.title}>
                {source.title}
              </h4>
              
              {source.authors && source.authors.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {source.authors.slice(0, 2).join(", ")}
                  {source.authors.length > 2 ? " et al." : ""}
                  {source.year ? ` (${source.year})` : ""}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-1 italic">
                💡 PDF内容 + 仮想データフォルダを参照して回答します
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
