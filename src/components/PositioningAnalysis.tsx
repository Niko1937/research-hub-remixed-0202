import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PositioningData {
  axes: {
    x: string;
    y: string;
  };
  items: {
    name: string;
    x: number; // 0-100
    y: number; // 0-100
    type: "internal" | "external" | "target";
  }[];
  insights: string[];
}

interface PositioningAnalysisProps {
  data: PositioningData;
}

export function PositioningAnalysis({ data }: PositioningAnalysisProps) {
  const getItemColor = (type: string) => {
    switch (type) {
      case "internal":
        return "bg-blue-500";
      case "external":
        return "bg-amber-500";
      case "target":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getItemLabel = (type: string) => {
    switch (type) {
      case "internal":
        return "社内研究";
      case "external":
        return "外部研究";
      case "target":
        return "目標位置";
      default:
        return "その他";
    }
  };

  return (
    <div className="space-y-6">
      {/* Positioning Chart */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary">📊</span>
            ポジショニング分析
          </h3>
        </div>
        <div className="p-8">
          {/* Chart Container */}
          <div className="relative w-full aspect-square max-w-3xl mx-auto bg-muted/20 rounded-lg p-8">
            {/* Grid Background */}
            <div className="absolute inset-8 grid grid-cols-5 grid-rows-5 gap-0">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="border border-border/20" />
              ))}
            </div>

            {/* Quadrant Labels */}
            <div className="absolute top-4 left-4 text-xs text-muted-foreground/60 font-medium">
              高 {data.axes.y}
            </div>
            <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/60 font-medium">
              低 {data.axes.y}
            </div>
            <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60 font-medium">
              高 {data.axes.x}
            </div>
            <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/60 font-medium">
              低 {data.axes.x}
            </div>

            {/* Axes Labels (Main) */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground">
              {data.axes.x} →
            </div>
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-semibold text-foreground whitespace-nowrap">
              {data.axes.y} →
            </div>

            {/* Axis Lines */}
            <div className="absolute bottom-8 left-8 right-8 h-0.5 bg-border" />
            <div className="absolute top-8 bottom-8 left-8 w-0.5 bg-border" />

            {/* Data Points */}
            {data.items && data.items.length > 0 ? (
              data.items.map((item, index) => (
                <div
                  key={index}
                  className="absolute group z-10"
                  style={{
                    left: `calc(8% + ${item.x}% * 0.84)`,
                    bottom: `calc(8% + ${item.y}% * 0.84)`,
                    transform: "translate(-50%, 50%)",
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${getItemColor(
                      item.type
                    )} shadow-lg cursor-pointer transition-all duration-300 hover:scale-[2.5] hover:shadow-xl border-2 border-background`}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 border border-border">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {getItemLabel(item.type)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                データポイントがありません
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-8 mt-8">
            {["internal", "external", "target"].map((type) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full ${getItemColor(type)} border-2 border-background shadow-md`}
                />
                <span className="text-sm font-medium text-foreground">
                  {getItemLabel(type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Insights */}
      <Card className="bg-card border-border">
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">分析結果</h3>
        </div>
        <div className="p-4 space-y-3">
          {data.insights.map((insight, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <Badge variant="outline" className="shrink-0 mt-0.5">
                {index + 1}
              </Badge>
              <p className="text-sm text-foreground leading-relaxed">
                {insight}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
