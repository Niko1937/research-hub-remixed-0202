import { Search, Users, FileText, Zap, ArrowRight } from "lucide-react";

export function ValueProposition() {
  const values = [
    {
      icon: Search,
      title: "調べる",
      description: "膨大な論文・資料から必要な情報を素早く発見",
      color: "text-blue-500",
    },
    {
      icon: Zap,
      title: "理解する",
      description: "対話的なAIが専門知識を噛み砕いて解説",
      color: "text-primary",
    },
    {
      icon: Users,
      title: "つながる",
      description: "関連する専門家・研究者を自動で推薦",
      color: "text-green-500",
    },
  ];

  return (
    <section className="py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Value Flow */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-10">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <div key={index} className="flex items-center gap-4 md:gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className={`p-3 rounded-full bg-muted/50 mb-2 ${value.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{value.title}</h3>
                  <p className="text-xs text-muted-foreground max-w-[140px]">
                    {value.description}
                  </p>
                </div>
                {index < values.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground hidden md:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Simple Extension Diagram */}
        <div className="bg-card/50 border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 text-center">
            対話UIの裏側で、Agentを追加するだけで機能が拡張
          </h3>
          <div className="flex flex-col items-center gap-3">
            {/* Current Core */}
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary/20 text-primary border border-primary/30">
                論文検索
              </span>
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary/20 text-primary border border-primary/30">
                専門家推薦
              </span>
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary/20 text-primary border border-primary/30">
                ポジショニング分析
              </span>
            </div>
            
            {/* Arrow */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-px h-4 bg-border"></div>
              <span className="text-xs">+ Agent追加</span>
              <div className="w-px h-4 bg-border"></div>
            </div>
            
            {/* Future Extensions */}
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">
                社内ナレッジ検索
              </span>
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">
                定例報告自動生成
              </span>
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">
                実験計画支援
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
