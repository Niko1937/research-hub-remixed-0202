import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, MessageSquare, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpertNetworkGraph } from "@/components/charts/ExpertNetworkGraph";

interface Expert {
  name: string;
  affiliation: string;
  role: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  connectionPath?: string;
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
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  introduction: {
    label: "紹介があるとスムーズ",
    icon: Users,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
  via_manager: {
    label: "上司経由で依頼が必要",
    icon: ArrowRight,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
};

const contactMethodLabels = {
  slack: { label: "Slack", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  request_intro: { label: "紹介依頼", icon: Users },
  ask_manager: { label: "上司に相談", icon: ArrowRight },
};

export function KnowWhoResults({ experts }: KnowWhoResultsProps) {
  const groupedExperts = {
    direct: experts.filter((e) => e.approachability === "direct"),
    introduction: experts.filter((e) => e.approachability === "introduction"),
    via_manager: experts.filter((e) => e.approachability === "via_manager"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          アプローチガイド
        </h3>
        <span className="text-xs text-muted-foreground">
          {experts.length}名の有識者が見つかりました
        </span>
      </div>

      {/* Network Graph */}
      {experts.length > 0 && (
        <ExpertNetworkGraph experts={experts} />
      )}

      {(Object.keys(groupedExperts) as Array<keyof typeof groupedExperts>).map((category) => {
        const config = approachabilityConfig[category];
        const categoryExperts = groupedExperts[category];
        
        if (categoryExperts.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <config.icon className={`w-4 h-4 ${config.color}`} />
              <h4 className="text-sm font-medium text-foreground">{config.label}</h4>
              <span className="text-xs text-muted-foreground">({categoryExperts.length}名)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryExperts.map((expert, index) => (
                <Card
                  key={index}
                  className={`bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg ${config.borderColor}`}
                >
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div>
                      <h5 className="text-base font-semibold text-foreground mb-1">
                        {expert.name}
                      </h5>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Building2 className="w-3 h-3" />
                        <span>{expert.affiliation}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {expert.role}
                      </Badge>
                    </div>

                    {/* Connection Path */}
                    {expert.connectionPath && (
                      <div className={`${config.bgColor} p-3 rounded-md`}>
                        <p className="text-xs text-muted-foreground">{expert.connectionPath}</p>
                      </div>
                    )}

                    {/* Suggested Questions */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">聞けそうなこと</p>
                      <ul className="space-y-1">
                        {expert.suggestedQuestions.map((question, qIndex) => (
                          <li key={qIndex} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Contact Methods */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                      {expert.contactMethods.map((method) => {
                        const methodConfig = contactMethodLabels[method];
                        return (
                          <Button
                            key={method}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <methodConfig.icon className="w-3 h-3 mr-1" />
                            {methodConfig.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
