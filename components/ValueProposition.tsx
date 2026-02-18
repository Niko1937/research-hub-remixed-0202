import { Clock, Lightbulb, Users, ArrowRight, CheckCircle2, Layers, Sparkles, FlaskConical, Target, Search, FileText, Brain } from "lucide-react";

export function ValueProposition() {
  const features = [
    {
      icon: Search,
      title: "文献を瞬時にサーベイ",
      description: "自然言語で質問するだけ。関連論文を見つけ出し、要点を整理。時間のかかる文献調査をAIが代行します。",
      visual: (
        <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Search className="w-4 h-4 text-primary" />
            <span>「量子コンピューティングの最新動向は？」</span>
          </div>
          <div className="space-y-2 pl-7">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Nature 2024 - Quantum Error Correction</p>
                <p className="text-xs text-muted-foreground">エラー訂正率99.9%を達成した新手法...</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Science 2024 - Scalable Qubits</p>
                <p className="text-xs text-muted-foreground">1000量子ビット規模の実装に成功...</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">arXiv 2024 - Hybrid Algorithms</p>
                <p className="text-xs text-muted-foreground">古典-量子ハイブリッド手法の比較...</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Lightbulb,
      title: "対話で深く理解",
      description: "専門外の論文も、AIが対話形式で噛み砕いて解説。図表の意味も、数式の導出も、質問するだけで理解が進みます。",
      visual: (
        <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs">🧑‍🔬</span>
            </div>
            <div className="bg-muted/50 rounded-lg rounded-tl-none px-4 py-2">
              <p className="text-sm text-foreground">この論文のFig.3が理解できません</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-primary/10 rounded-lg rounded-tl-none px-4 py-2 flex-1">
              <p className="text-sm text-foreground">
                Fig.3は<span className="text-primary font-medium">エントロピー変化</span>を時間軸で示しています。
                縦軸のS(t)は系全体のエントロピーで、
                <span className="text-primary font-medium">赤い破線</span>が理論予測、
                <span className="text-primary font-medium">青いプロット</span>が実測値です...
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Users,
      title: "最適な専門家を発見",
      description: "研究領域から、社内外の専門家や共同研究候補を推薦。「誰に相談すればいいか」の悩みを解消します。",
      visual: (
        <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            <span>量子エラー訂正の専門家</span>
          </div>
          <div className="space-y-3">
            {[
              { name: "田中 博士", org: "量子情報研究所", match: 95 },
              { name: "Dr. Smith", org: "MIT CSAIL", match: 88 },
              { name: "佐藤 教授", org: "東京大学", match: 82 },
            ].map((expert, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{expert.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{expert.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{expert.org}</p>
                </div>
                <div className="text-xs font-medium text-primary">{expert.match}%</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="py-20 sm:py-28 lg:py-36">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-24">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            For Researchers
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            研究者の「時間」と「発想」を解放する
          </h2>
        </div>

        {/* Feature Sections - Text Left, Visual Right */}
        <div className="space-y-24 sm:space-y-32">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            
            return (
              <div 
                key={index}
                className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
              >
                {/* Text - Always Left */}
                <div>
                  <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Feature {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                    {feature.description}
                  </p>
                </div>
                
                {/* Visual - Always Right */}
                <div>
                  {feature.visual}
                </div>
              </div>
            );
          })}
        </div>
        
      </div>
    </section>
  );
}
