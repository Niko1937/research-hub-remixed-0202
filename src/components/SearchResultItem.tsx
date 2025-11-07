import { FileText, ExternalLink } from "lucide-react";

interface SearchResultItemProps {
  title: string;
  authors: string[];
  year: string;
  source: string;
  citations?: number;
  url: string;
  abstract?: string;
  onClick: () => void;
}

export function SearchResultItem({
  title,
  authors,
  year,
  source,
  citations,
  url,
  abstract,
  onClick,
}: SearchResultItemProps) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-4 hover:bg-card-hover transition-colors cursor-pointer border-b border-border last:border-b-0"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
          {abstract && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {abstract}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="truncate max-w-[300px]">{authors.slice(0, 3).join(", ")}</span>
            <span>•</span>
            <span>{year}</span>
            {citations !== undefined && (
              <>
                <span>•</span>
                <span>{citations}引用</span>
              </>
            )}
            <span>•</span>
            <span className="font-medium">{source}</span>
          </div>
        </div>

        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </div>
  );
}
