import { Database, Brain, ArrowRight, ArrowUp } from "lucide-react";

const dataLevels = [
  "LLM / Web",
  "社内外文書", 
  "未デジタル化データ",
  "システム連携",
];

const aiLevels = [
  "単一検索",
  "高度検索",
  "定性推論",
  "定量分析",
  "創発実験",
];

export function ExpansionMatrix() {
  return (
    <section className="py-16 sm:py-24 bg-muted/10">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Platform Vision
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            2つの軸で、可能性が広がる
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            対応データとAI能力、両軸の拡張で研究支援の幅が指数的に成長します。
          </p>
        </div>

        {/* Concept Diagram */}
        <div className="relative max-w-4xl mx-auto">
          
          {/* Main visual area */}
          <div className="relative ml-8 sm:ml-12 mb-8">
            
            {/* Gradient fill showing expansion */}
            <div className="aspect-[4/3] relative rounded-2xl overflow-hidden border border-border/30">
              {/* Background grid */}
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="border-r border-b border-border/10 last:border-r-0" />
                ))}
              </div>
              
              {/* Gradient fill */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent" />
              
              {/* Diagonal arrow showing growth direction */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
                <path 
                  d="M 10 90 Q 50 50 90 10" 
                  stroke="url(#arrowGrad)" 
                  strokeWidth="0.8" 
                  fill="none"
                  strokeDasharray="2 2"
                />
                <polygon 
                  points="88,8 92,12 86,14" 
                  fill="hsl(var(--primary))" 
                  opacity="0.6"
                />
              </svg>

              {/* Corner label */}
              <div className="absolute top-4 right-4 text-right">
                <p className="text-xs font-semibold text-primary">できることが</p>
                <p className="text-lg font-bold text-foreground">無限に広がる</p>
              </div>
            </div>

            {/* X-axis: Data */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Data</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <div className="flex justify-between">
                {dataLevels.map((label, i) => (
                  <div 
                    key={label} 
                    className="flex-1 text-center"
                  >
                    <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight block">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Y-axis: AI (positioned on left) */}
          <div className="absolute left-0 top-0 bottom-16 flex flex-col items-center w-8 sm:w-12">
            <div className="flex items-center gap-1 mb-2 transform -rotate-90 origin-center whitespace-nowrap translate-y-8">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">AI</span>
              <ArrowUp className="w-4 h-4 text-muted-foreground/50 transform rotate-90" />
            </div>
            <div className="flex-1 flex flex-col justify-between py-4">
              {[...aiLevels].reverse().map((label) => (
                <span 
                  key={label} 
                  className="text-[10px] sm:text-xs text-muted-foreground transform -rotate-45 origin-right whitespace-nowrap"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom description */}
        <p className="text-center text-sm text-muted-foreground mt-8 max-w-lg mx-auto">
          データ連携の深化と AI能力の高度化。<br className="sm:hidden" />
          この2軸の掛け合わせで、研究のあり方が変わります。
        </p>

      </div>
    </section>
  );
}
