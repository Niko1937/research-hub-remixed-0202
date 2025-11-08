import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from "recharts";

interface RadarDataPoint {
  axis: string;
  internal?: number;
  external?: number;
  target?: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
}

export function RadarChart({ data }: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsRadar data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="axis" stroke="hsl(var(--foreground))" />
        <PolarRadiusAxis stroke="hsl(var(--foreground))" />
        <Radar
          name="社内研究"
          dataKey="internal"
          stroke="hsl(var(--chart-1))"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.6}
        />
        <Radar
          name="外部研究"
          dataKey="external"
          stroke="hsl(var(--chart-2))"
          fill="hsl(var(--chart-2))"
          fillOpacity={0.6}
        />
        <Radar
          name="目標位置"
          dataKey="target"
          stroke="hsl(var(--chart-3))"
          fill="hsl(var(--chart-3))"
          fillOpacity={0.6}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            color: "hsl(var(--popover-foreground))"
          }}
        />
        <Legend />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
