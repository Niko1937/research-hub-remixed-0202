import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from "recharts";

interface RadarDataPoint {
  axis: string;
  [key: string]: string | number;
}

interface RadarItem {
  name: string;
  type: "internal" | "external" | "target";
}

interface RadarChartProps {
  data: RadarDataPoint[];
  items: RadarItem[];
}

const getColor = (type: string) => {
  switch (type) {
    case "internal":
      return "hsl(var(--chart-1))";
    case "external":
      return "hsl(var(--chart-2))";
    case "target":
      return "hsl(var(--chart-3))";
    default:
      return "hsl(var(--muted))";
  }
};

export function RadarChart({ data, items }: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsRadar data={data}>
        <PolarGrid stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
        <PolarAngleAxis 
          dataKey="axis" 
          stroke="hsl(var(--foreground))" 
          tick={{ fill: "hsl(var(--foreground))", fontSize: 14, fontWeight: 500 }}
        />
        <PolarRadiusAxis 
          stroke="hsl(var(--muted-foreground))" 
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        {items.map((item, index) => (
          <Radar
            key={index}
            name={item.name}
            dataKey={item.type}
            stroke={getColor(item.type)}
            fill={getColor(item.type)}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        ))}
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            color: "hsl(var(--popover-foreground))"
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: "14px" }}
          iconSize={12}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
