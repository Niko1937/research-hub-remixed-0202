import { FileText, ExternalLink, Calendar, Users, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResearchCardProps {
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  citations?: number;
  onClick?: () => void;
}

export function ResearchCard({
  title,
  abstract,
  authors,
  year,
  source,
  url,
  citations,
  onClick,
}: ResearchCardProps) {
  return (
    <Card 
      className="bg-card hover:bg-card-hover transition-colors border-border shadow-sm cursor-pointer" 
      onClick={onClick}
    >
      <div className="p-5 space-y-3">
        <h3 className="text-base font-semibold text-foreground line-clamp-2">
          {title}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-3">{abstract}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{authors.slice(0, 2).join(", ")}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{year}</span>
          </div>
          {citations !== undefined && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Award className="w-3 h-3" />
                <span>{citations}引用</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Badge variant="secondary" className="text-xs">
            {source}
          </Badge>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
