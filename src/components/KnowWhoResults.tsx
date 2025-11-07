import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Expert {
  name: string;
  affiliation: string;
  expertise: string[];
  publications: number;
  h_index: number;
  email?: string;
}

interface KnowWhoResultsProps {
  experts: Expert[];
}

export function KnowWhoResults({ experts }: KnowWhoResultsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">
          専門家・研究者
        </h3>
        <span className="text-xs text-muted-foreground">
          {experts.length}名の専門家が見つかりました
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {experts.map((expert, index) => (
          <Card
            key={index}
            className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg"
          >
            <div className="p-5 space-y-4">
              {/* Header */}
              <div>
                <h4 className="text-base font-semibold text-foreground mb-1">
                  {expert.name}
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>{expert.affiliation}</span>
                </div>
              </div>

              {/* Expertise Tags */}
              <div className="flex flex-wrap gap-2">
                {expert.expertise.map((tag, tagIndex) => (
                  <Badge
                    key={tagIndex}
                    variant="secondary"
                    className="text-xs bg-primary/10 text-primary border-primary/20"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">論文数</div>
                    <div className="text-sm font-semibold text-foreground">
                      {expert.publications}
                    </div>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <div className="text-xs text-muted-foreground">h-index</div>
                  <div className="text-sm font-semibold text-foreground">
                    {expert.h_index}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {expert.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => window.open(`mailto:${expert.email}`)}
                >
                  <Mail className="w-3 h-3 mr-2" />
                  連絡する
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
