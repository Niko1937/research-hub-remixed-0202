import { Clock, Lightbulb, Users, ArrowRight, CheckCircle2, Layers, Sparkles, FlaskConical, Target } from "lucide-react";

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
    { label: "調べる", icon: Clock, desc: "文献調査" },
    { label: "理解する", icon: Lightbulb, desc: "対話学習" },
    { label: "つながる", icon: Users, desc: "専門家発見" },
    { label: "創る", icon: Sparkles, desc: "アイデア創出" },
  ];

  const futureVision = [
    {
      icon: Sparkles,
      title: "アイデアの壁打ち",
      description: "新しい研究テーマや仮説をAIと対話しながらブラッシュアップ",
    },
    {
      icon: Target,
      title: "研究の高度化",
      description: "既存研究の発展可能性、未踏領域の発見を支援",
    },
    {
      icon: FlaskConical,
      title: "実験の指示・実行",
      description: "将来的には実験計画から実行までを対話的にコントロール",
      isFuture: true,
    },
  ];

  return (
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            For Researchers
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            研究者の「時間」と「発想」を解放する
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

        {/* Value Flow - Extended */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 lg:gap-10 mb-16 sm:mb-20 flex-wrap">
          {valueFlow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-center gap-3 sm:gap-6 lg:gap-10">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-primary" />
                  </div>
                  <span className="text-xs sm:text-sm lg:text-base font-semibold text-foreground">{step.label}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{step.desc}</span>
                </div>
                {index < valueFlow.length - 1 && (
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40" />
                )}
              </div>
            );
          })}
        </div>

        {/* Future Vision Cards */}
        <div className="mb-16 sm:mb-20">
          <h3 className="text-lg sm:text-xl font-bold text-foreground text-center mb-6 sm:mb-8">
            研究の可能性を広げる
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {futureVision.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={`relative bg-card/60 backdrop-blur border rounded-xl p-5 sm:p-6 ${
                    item.isFuture 
                      ? 'border-primary/30 bg-primary/5' 
                      : 'border-border/50'
                  }`}
                >
                  {item.isFuture && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-primary font-semibold px-2 py-0.5 rounded-full bg-primary/10">
                      Future
                    </span>
                  )}
                  <Icon className={`w-8 h-8 mb-3 ${item.isFuture ? 'text-primary' : 'text-primary/70'}`} />
                  <h4 className="font-semibold text-foreground mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Extensibility */}
        <div className="bg-muted/20 border border-border/50 rounded-2xl p-6 sm:p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider">
              Extensible Platform
            </span>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            対話UIの裏側で、Agentを追加するだけで機能拡張。
            社内ナレッジ検索、自動報告生成、そして将来的には実験制御まで。
            <span className="font-medium text-foreground">研究のすべてを、ここから。</span>
          </p>
        </div>
        
      </div>
    </section>
  );
}
