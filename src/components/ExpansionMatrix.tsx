import { useState } from "react";
import { Database, Brain, Zap } from "lucide-react";

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
  const [dataLevel, setDataLevel] = useState(1);
  const [aiLevel, setAiLevel] = useState(2);

  // Calculate the "capability area" percentage
  const capabilityArea = ((dataLevel + 1) / dataLevels.length) * ((aiLevel + 1) / aiLevels.length) * 100;

  return (
    <section className="py-16 sm:py-24 bg-muted/10">
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Platform Vision
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            2つの軸で、可能性が広がる
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            対応データと AI能力、両軸を拡張するほど研究支援の幅が広がります。
          </p>
        </div>

        {/* Interactive Area */}
        <div className="bg-card/60 backdrop-blur border border-border/50 rounded-2xl p-6 sm:p-10">
          
          {/* Visual representation */}
          <div className="relative aspect-square max-w-md mx-auto mb-10">
            {/* Grid background */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-5 gap-px opacity-20">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="bg-border rounded-sm" />
              ))}
            </div>

            {/* Capability area fill */}
            <div 
              className="absolute bottom-0 left-0 bg-gradient-to-tr from-primary/30 via-primary/20 to-primary/10 
                rounded-lg transition-all duration-500 ease-out"
              style={{
                width: `${((dataLevel + 1) / dataLevels.length) * 100}%`,
                height: `${((aiLevel + 1) / aiLevels.length) * 100}%`,
              }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-lg blur-xl" />
            </div>

            {/* Current position dot */}
            <div 
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out z-10"
              style={{
                left: `${((dataLevel + 1) / dataLevels.length) * 100}%`,
                bottom: `${((aiLevel + 1) / aiLevels.length) * 100}%`,
              }}
            >
              <div className="w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/50" />
              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
            </div>

            {/* Axis labels on the visual */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-between text-[10px] text-muted-foreground">
              <span>狭い</span>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                データ範囲
              </span>
              <span>広い</span>
            </div>
            <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between text-[10px] text-muted-foreground">
              <span className="transform -rotate-90 origin-left translate-y-4">高度</span>
              <span className="transform -rotate-90 origin-left translate-y-8 flex items-center gap-1 whitespace-nowrap">
                <Brain className="w-3 h-3" />
                AI能力
              </span>
              <span className="transform -rotate-90 origin-left translate-y-4">基本</span>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-8 max-w-md mx-auto">
            
            {/* Data Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">データ範囲</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {dataLevels[dataLevel]}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={dataLevels.length - 1}
                  value={dataLevel}
                  onChange={(e) => setDataLevel(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-primary
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-primary/30
                    [&::-webkit-slider-thumb]:cursor-grab
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-primary
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:cursor-grab"
                />
                {/* Track fill */}
                <div 
                  className="absolute top-0 left-0 h-2 bg-gradient-to-r from-primary/60 to-primary rounded-full pointer-events-none"
                  style={{ width: `${(dataLevel / (dataLevels.length - 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                {dataLevels.map((label, i) => (
                  <span 
                    key={label} 
                    className={`transition-colors ${i <= dataLevel ? 'text-foreground' : ''}`}
                  >
                    {label.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">AI能力</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {aiLevels[aiLevel]}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={aiLevels.length - 1}
                  value={aiLevel}
                  onChange={(e) => setAiLevel(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-primary
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-primary/30
                    [&::-webkit-slider-thumb]:cursor-grab
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-primary
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:cursor-grab"
                />
                {/* Track fill */}
                <div 
                  className="absolute top-0 left-0 h-2 bg-gradient-to-r from-primary/60 to-primary rounded-full pointer-events-none"
                  style={{ width: `${(aiLevel / (aiLevels.length - 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                {aiLevels.map((label, i) => (
                  <span 
                    key={label} 
                    className={`transition-colors ${i <= aiLevel ? 'text-foreground' : ''}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Capability indicator */}
          <div className="mt-10 pt-6 border-t border-border/50 text-center">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-primary/10 border border-primary/20">
              <Zap className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  研究支援カバレッジ
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {Math.round(capabilityArea)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
