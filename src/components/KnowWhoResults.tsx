import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Mail, MessageSquare, Users, ArrowRight, GitBranch, CircleDot, UserSquare2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ExpertNetworkGraph from "@/components/charts/ExpertNetworkGraph";
import ExpertTSNEMap from "@/components/charts/ExpertTSNEMap";
import ExpertSkillCards from "@/components/charts/ExpertSkillCards";

interface PathNode {
  employee_id: string;
  name: string;
  role: string;
  department: string;
}

interface Expert {
  employee_id?: string;
  name: string;
  affiliation: string;
  role: string;
  mail?: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  connectionPath?: string;
  pathDetails?: PathNode[];
  distance?: number;
  suggestedQuestions: string[];
  contactMethods: ('slack' | 'email' | 'request_intro' | 'ask_manager')[];
}

interface KnowWhoResultsProps {
  experts: Expert[];
  hideFollowUpText?: boolean;
}

const approachabilityConfig = {
  direct: {
    label: "すぐ話せる",
    icon: MessageSquare,
    badgeVariant: "default" as const,
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  introduction: {
    label: "紹介経由",
    icon: Users,
    badgeVariant: "default" as const,
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  via_manager: {
    label: "上司経由",
    icon: ArrowRight,
    badgeVariant: "default" as const,
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

const contactMethodLabels = {
  slack: { label: "Slack", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  request_intro: { label: "紹介依頼", icon: Users },
  ask_manager: { label: "上司に相談", icon: ArrowRight },
};

export function KnowWhoResults({ experts }: KnowWhoResultsProps) {
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          有識者リスト
        </h3>
        <span className="text-xs text-muted-foreground">
          {experts.length}名
        </span>
      </div>

      {/* Expert Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[140px] text-xs font-medium">氏名</TableHead>
              <TableHead className="w-[120px] text-xs font-medium">部署</TableHead>
              <TableHead className="w-[140px] text-xs font-medium">役職</TableHead>
              <TableHead className="w-[180px] text-xs font-medium">メールアドレス</TableHead>
              <TableHead className="w-[100px] text-xs font-medium">アプローチ</TableHead>
              <TableHead className="text-xs font-medium">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experts.map((expert, index) => {
              const config = approachabilityConfig[expert.approachability];
              return (
                <TableRow key={expert.employee_id || index} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{expert.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{expert.affiliation}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{expert.role}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                    {expert.mail || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${config.className}`}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {expert.contactMethods.slice(0, 2).map((method) => {
                        const methodConfig = contactMethodLabels[method];
                        return (
                          <Button
                            key={method}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                          >
                            <methodConfig.icon className="w-3 h-3" />
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Collapsible Visualization Views */}
      {experts.length > 0 && (
        <Collapsible open={isGraphOpen} onOpenChange={setIsGraphOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                可視化ビュー
              </span>
              {isGraphOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="border border-border rounded-lg p-4 bg-card">
              <Tabs defaultValue="org-tree" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="org-tree" className="text-xs">
                    <GitBranch className="w-3.5 h-3.5 mr-1" />
                    組織経路図
                  </TabsTrigger>
                  <TabsTrigger value="tsne-map" className="text-xs">
                    <CircleDot className="w-3.5 h-3.5 mr-1" />
                    専門性マップ
                  </TabsTrigger>
                  <TabsTrigger value="skill-cards" className="text-xs">
                    <UserSquare2 className="w-3.5 h-3.5 mr-1" />
                    スキルカード
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="org-tree">
                  {experts.some(e => e.pathDetails && e.pathDetails.length > 0) ? (
                    <ExpertNetworkGraph experts={experts} />
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      経路データがありません
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="tsne-map">
                  <ExpertTSNEMap experts={experts} />
                </TabsContent>
                
                <TabsContent value="skill-cards">
                  <ExpertSkillCards experts={experts} />
                </TabsContent>
              </Tabs>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
