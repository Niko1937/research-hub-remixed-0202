import { motion } from "framer-motion";
import { useState } from "react";

const dataLevels = [
  { id: "llm-web", label: "LLM / Web", short: "Web" },
  { id: "documents", label: "社内外文書", short: "文書" },
  { id: "undigitized", label: "未デジタル化", short: "非DX" },
  { id: "systems", label: "システム連携", short: "連携" },
];

const aiSteps = [
  { id: "single-search", label: "単一検索" },
  { id: "advanced-search", label: "高度検索" },
  { id: "qualitative", label: "定性推論" },
  { id: "quantitative", label: "定量分析" },
  { id: "emergent", label: "創発実験" },
];

// Define which cells are "active" (current or near-future capabilities)
const activeCells: Record<string, string[]> = {
  "llm-web": ["single-search", "advanced-search", "qualitative"],
  "documents": ["single-search", "advanced-search"],
  "undigitized": ["single-search"],
  "systems": [],
};

// Define "coming soon" cells
const comingSoonCells: Record<string, string[]> = {
  "llm-web": ["quantitative"],
  "documents": ["qualitative", "quantitative"],
  "undigitized": ["advanced-search", "qualitative"],
  "systems": ["single-search", "advanced-search"],
};

export function ExpansionMatrix() {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const getCellStatus = (dataId: string, aiId: string) => {
    if (activeCells[dataId]?.includes(aiId)) return "active";
    if (comingSoonCells[dataId]?.includes(aiId)) return "coming";
    return "future";
  };

  return (
    <section className="py-16 sm:py-24 bg-muted/10">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Platform Vision
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            AIとデータの拡張で、できることが広がる
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            対応データソースとAI能力の両軸で拡張。
            組み合わせが増えるほど、研究支援の可能性は指数関数的に成長します。
          </p>
        </div>

        {/* Matrix */}
        <div className="relative overflow-x-auto pb-4">
          <div className="min-w-[600px]">
            {/* Grid Container */}
            <div className="grid gap-1" style={{ 
              gridTemplateColumns: `140px repeat(${dataLevels.length}, 1fr)`,
              gridTemplateRows: `auto repeat(${aiSteps.length}, 48px)`
            }}>
              
              {/* Top-left corner - Axis labels */}
              <div className="flex items-end justify-end p-2 text-[10px] text-muted-foreground">
                <span className="transform -rotate-0">AI能力 →</span>
              </div>
              
              {/* Data axis headers */}
              {dataLevels.map((data, idx) => (
                <div 
                  key={data.id}
                  className="flex flex-col items-center justify-end p-2 text-center"
                >
                  <span className="text-xs sm:text-sm font-medium text-foreground">
                    {data.label}
                  </span>
                  <div className="w-full h-0.5 mt-2 bg-gradient-to-r from-transparent via-primary/30 to-transparent" 
                    style={{ opacity: 0.3 + (idx * 0.2) }} 
                  />
                </div>
              ))}

              {/* AI steps rows */}
              {aiSteps.map((ai, rowIdx) => (
                <>
                  {/* Row header */}
                  <div 
                    key={`header-${ai.id}`}
                    className="flex items-center justify-end pr-3 text-xs sm:text-sm font-medium text-foreground"
                  >
                    {ai.label}
                  </div>
                  
                  {/* Cells */}
                  {dataLevels.map((data, colIdx) => {
                    const cellId = `${data.id}-${ai.id}`;
                    const status = getCellStatus(data.id, ai.id);
                    const isHovered = hoveredCell === cellId;
                    
                    return (
                      <motion.div
                        key={cellId}
                        className={`
                          relative rounded-lg border cursor-pointer
                          transition-all duration-300 ease-out
                          ${status === "active" 
                            ? "bg-primary/20 border-primary/40 shadow-sm" 
                            : status === "coming"
                            ? "bg-primary/10 border-primary/20 border-dashed"
                            : "bg-card/30 border-border/30"
                          }
                          ${isHovered ? "scale-105 z-10 shadow-lg" : ""}
                        `}
                        onMouseEnter={() => setHoveredCell(cellId)}
                        onMouseLeave={() => setHoveredCell(null)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ 
                          delay: (rowIdx * 0.05) + (colIdx * 0.08),
                          duration: 0.3 
                        }}
                      >
                        {/* Cell content indicator */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {status === "active" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
                          )}
                          {status === "coming" && (
                            <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                          )}
                          {status === "future" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>

                        {/* Hover tooltip */}
                        {isHovered && (
                          <motion.div 
                            className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-20
                              bg-popover border border-border rounded-lg px-3 py-1.5 shadow-lg
                              whitespace-nowrap text-xs"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <span className="font-medium text-foreground">{data.label}</span>
                            <span className="text-muted-foreground"> × </span>
                            <span className="font-medium text-foreground">{ai.label}</span>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {status === "active" && "✓ 対応済み"}
                              {status === "coming" && "○ 開発中"}
                              {status === "future" && "· 将来対応"}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              ))}
            </div>

            {/* Expansion arrow overlay */}
            <div className="absolute bottom-0 right-0 transform translate-x-2 translate-y-6 pointer-events-none">
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <span className="text-[10px] uppercase tracking-wider">データ拡張</span>
                <svg width="40" height="12" viewBox="0 0 40 12" fill="none" className="text-primary/40">
                  <path d="M0 6H36M36 6L30 1M36 6L30 11" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span>対応済み</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/50" />
            <span>開発中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            <span>将来対応</span>
          </div>
        </div>

      </div>
    </section>
  );
}
