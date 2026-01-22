import { Clock, Lightbulb, Users, ArrowRight, CheckCircle2, Layers } from "lucide-react";

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
    { label: "調べる", icon: Clock },
    { label: "理解する", icon: Lightbulb },
    { label: "つながる", icon: Users },
  ];

  return (
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            For Researchers
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            研究者の「時間」を取り戻す
          </h2>
        </div>

        {/* Pain → Solution */}
        <div className="space-y-3 sm:space-y-4 mb-16 sm:mb-20">
          {painPoints.map((item, index) => (
            <div
              key={index}
              className="group bg-card/60 backdrop-blur border border-border/50 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 hover:bg-card/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-muted-foreground/70 line-through decoration-muted-foreground/30">
                  {item.problem}
                </p>
              </div>
              
              <ArrowRight className="w-4 h-4 text-primary/60 hidden sm:block flex-shrink-0 group-hover:text-primary transition-colors" />
              
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
                  {item.solution}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Value Flow */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 lg:gap-12 mb-16 sm:mb-20">
          {valueFlow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-center gap-4 sm:gap-8 lg:gap-12">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 sm:mb-3">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary" />
                  </div>
                  <span className="text-sm sm:text-base lg:text-lg font-semibold text-foreground">{step.label}</span>
                </div>
                {index < valueFlow.length - 1 && (
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/40" />
                )}
              </div>
            );
          })}
        </div>

        {/* Extensibility */}
        <div className="bg-muted/20 border border-border/50 rounded-2xl p-6 sm:p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider">
              Extensible
            </span>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            対話UIの裏側で、Agentを追加するだけで機能拡張。
            社内ナレッジ検索、定例報告自動生成など、ニーズに応じて成長します。
          </p>
        </div>
        
      </div>
    </section>
  );
}
