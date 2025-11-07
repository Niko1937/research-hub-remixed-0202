import { FileText, ExternalLink, Calendar, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResearchCardProps {
  title: string;
  abstract: string;
  authors: string[];
  date: string;
  tags: string[];
  source: string;
}

export function ResearchCard({ title, abstract, authors, date, tags, source }: ResearchCardProps) {
  return (
    <Card className="p-5 bg-card border-border hover:bg-card-hover hover:shadow-hover transition-all cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
          <FileText className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground mb-2 group-hover:text-highlight transition-colors line-clamp-2">
            {title}
          </h3>

          <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{abstract}</p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <span className="truncate">{authors.join(", ")}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{date}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>

            <button className="flex items-center gap-1 text-xs text-primary hover:text-highlight transition-colors">
              <span>{source}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
