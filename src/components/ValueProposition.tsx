import { Clock, Brain, Users, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export function ValueProposition() {
  const painPoints = [
    {
      problem: "論文を探すのに時間がかかりすぎる",
      solution: "自然言語で質問するだけで、関連論文を瞬時にサーベイ",
    },
    {
      problem: "読んでも専門外だと理解が追いつかない",
      solution: "AIが対話形式で噛み砕いて解説、図表も深掘り",
    },
    {
      problem: "誰に相談すればいいかわからない",
      solution: "研究領域から最適な専門家・共同研究候補を推薦",
    },
  ];

  const valueFlow = [
    { label: "調べる", sublabel: "Search", icon: Clock },
    { label: "理解する", sublabel: "Understand", icon: Brain },
    { label: "つながる", sublabel: "Connect", icon: Users },
  ];

  return (
    <section className="py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Researcher Pain Points */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            For Researchers
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
            研究者の「時間」を取り戻す
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            論文調査、理解、専門家探し——研究の本質ではない作業に、どれだけの時間を費やしていますか？
          </p>
        </div>

        {/* Pain → Solution Cards */}
        <div className="space-y-4 mb-12">
          {painPoints.map((item, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            >
              <div className="flex-1">
                <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">
                  {item.problem}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary hidden sm:block flex-shrink-0" />
              <div className="flex-1 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {item.solution}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Value Flow Visual */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10">
          {valueFlow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-center gap-2 sm:gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-1">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">{step.label}</span>
                  <span className="text-[10px] text-muted-foreground">{step.sublabel}</span>
                </div>
                {index < valueFlow.length - 1 && (
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Extensibility Note */}
        <div className="bg-muted/30 border border-border rounded-lg p-4 sm:p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Extensible Architecture
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            対話UIの裏側で、Agentを追加するだけで機能が拡張可能。
            社内ナレッジ検索、定例報告自動生成、実験計画支援など、ニーズに応じて成長します。
          </p>
        </div>
      </div>
    </section>
  );
}
