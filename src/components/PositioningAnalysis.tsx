import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, RefreshCw } from "lucide-react";
import { ScatterChart } from "@/components/charts/ScatterChart";
import { BoxPlot } from "@/components/charts/BoxPlot";
import { RadarChart } from "@/components/charts/RadarChart";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Axis {
  name: string;
  type: "quantitative" | "qualitative";
}

interface PositioningData {
  axes: Axis[];
  suggestedChartType: "scatter" | "box" | "radar";
  items: {
    name: string;
    fullTitle?: string;
    authors?: string;
    source?: string;
    values: Record<string, number>; // axis name -> value
    type: "internal" | "external" | "target";
  }[];
  insights: string[];
}

interface PositioningAnalysisProps {
  data: PositioningData;
  onRegenerateAxis?: (axisName: string) => Promise<void>;
  onAddAxis?: (axisName: string, axisType: "quantitative" | "qualitative") => Promise<void>;
  onRemoveAxis?: (axisName: string) => Promise<void>;
}

export function PositioningAnalysis({ 
  data, 
  onRegenerateAxis, 
  onAddAxis, 
  onRemoveAxis 
}: PositioningAnalysisProps) {
  const { toast } = useToast();
  const [selectedChartType, setSelectedChartType] = useState<"scatter" | "box" | "radar">(data.suggestedChartType);
  const [newAxisName, setNewAxisName] = useState("");
  const [newAxisType, setNewAxisType] = useState<"quantitative" | "qualitative">("quantitative");

  const handleAddAxis = async () => {
    if (!newAxisName.trim() || !onAddAxis) return;
    
    try {
      await onAddAxis(newAxisName.trim(), newAxisType);
      toast({
        title: "軸を追加しました",
        description: `「${newAxisName}」を追加しました。`,
      });
      setNewAxisName("");
    } catch (error) {
      toast({
        title: "エラー",
        description: "軸の追加に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAxis = async (axisName: string) => {
    if (!onRemoveAxis) return;
    try {
      await onRemoveAxis(axisName);
      toast({
        title: "軸を削除しました",
        description: `「${axisName}」を削除しました。`,
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "軸の削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateAxis = async (axisName: string) => {
    if (!onRegenerateAxis) return;
    try {
      await onRegenerateAxis(axisName);
      toast({
        title: "軸を再生成しました",
        description: `「${axisName}」を再生成しました。`,
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "軸の再生成に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const renderChart = () => {
    if (selectedChartType === "scatter" && data.axes.length >= 2) {
      const xAxis = data.axes[0];
      const yAxis = data.axes[1];
      const scatterData = data.items.map(item => ({
        name: item.name,
        x: item.values[xAxis.name] || 0,
        y: item.values[yAxis.name] || 0,
        type: item.type
      }));
      return <ScatterChart data={scatterData} xAxisLabel={xAxis.name} yAxisLabel={yAxis.name} />;
    }

    if (selectedChartType === "box" && data.axes.length >= 1) {
      const axis = data.axes[0];
      const boxData = data.items.map(item => ({
        category: item.name,
        min: (item.values[axis.name] || 0) * 0.8,
        q1: (item.values[axis.name] || 0) * 0.9,
        median: item.values[axis.name] || 0,
        q3: (item.values[axis.name] || 0) * 1.1,
        max: (item.values[axis.name] || 0) * 1.2,
        type: item.type
      }));
      return <BoxPlot data={boxData} axisLabel={axis.name} />;
    }

    if (selectedChartType === "radar" && data.axes.length >= 3) {
      const radarData = data.axes.map(axis => {
        const dataPoint: any = { axis: axis.name };
        data.items.forEach(item => {
          dataPoint[item.type] = item.values[axis.name] || 0;
        });
        return dataPoint;
      });
      return <RadarChart data={radarData} />;
    }

    return <div className="text-muted-foreground text-sm">選択された図タイプに必要な軸が不足しています</div>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Positioning Chart - Left */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary">📊</span>
            ポジショニング分析
          </h3>
          <Select value={selectedChartType} onValueChange={(value: any) => setSelectedChartType(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scatter">散布図</SelectItem>
              <SelectItem value="box">箱ひげ図</SelectItem>
              <SelectItem value="radar">レーダーチャート</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Axes Management */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="text-xs font-semibold text-foreground mb-2">比較軸</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {data.axes.map((axis) => (
              <Badge key={axis.name} variant="secondary" className="flex items-center gap-1 pl-3 pr-1.5 py-1">
                <span className="text-xs">{axis.name}</span>
                <span className="text-[10px] text-muted-foreground">({axis.type === "quantitative" ? "定量" : "定性"})</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => handleRemoveAxis(axis.name)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 ml-0.5 hover:bg-primary/20"
                  onClick={() => handleRegenerateAxis(axis.name)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
          
          {/* Add New Axis */}
          <div className="flex gap-2">
            <Input
              placeholder="新しい比較軸を入力"
              value={newAxisName}
              onChange={(e) => setNewAxisName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAxis()}
              className="flex-1 h-8 text-xs"
            />
            <Select value={newAxisType} onValueChange={(value: any) => setNewAxisType(value)}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantitative">定量</SelectItem>
                <SelectItem value="qualitative">定性</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddAxis} className="h-8 px-2">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {renderChart()}
        </div>
      </Card>

      {/* Insights - Right */}
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
