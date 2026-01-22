import { X, Microscope, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  virtualFolder: VirtualFile[];
  onClose: () => void;
}

export function DeepDiveBanner({ source, virtualFolder, onClose }: DeepDiveBannerProps) {
  const [isFolderOpen, setIsFolderOpen] = useState(false);

  const getFileIcon = (type: VirtualFile["type"]) => {
    switch (type) {
      case "data":
        return "📊";
      case "figure":
        return "📈";
      case "reference":
        return "📚";
      case "code":
        return "💻";
      default:
        return "📄";
    }
  };

  const groupedFiles = virtualFolder.reduce((acc, file) => {
    const folder = file.path.split("/")[1] || "other";
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, VirtualFile[]>);

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-primary/20 rounded-lg shrink-0">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                  DeepDive中
                </Badge>
                {source.source && (
                  <Badge variant="outline" className="text-xs">
                    {source.source}
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

        {/* Virtual Folder */}
        {virtualFolder.length > 0 && (
          <Collapsible open={isFolderOpen} onOpenChange={setIsFolderOpen} className="mt-3">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {isFolderOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <FolderOpen className="w-3 h-3" />
              <span>仮想データフォルダ ({virtualFolder.length} files)</span>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2">
              <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                <div className="space-y-2">
                  {Object.entries(groupedFiles).map(([folder, files]) => (
                    <div key={folder}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        /{folder}/
                      </p>
                      <div className="space-y-1 pl-3">
                        {files.map((file, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <span>{getFileIcon(file.type)}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-foreground font-mono">
                                {file.path.split("/").pop()}
                              </span>
                              <p className="text-muted-foreground line-clamp-1">
                                {file.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
