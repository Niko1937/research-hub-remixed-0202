import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface BoxPlotDataPoint {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  type: "internal" | "external" | "target";
}

interface BoxPlotProps {
  data: BoxPlotDataPoint[];
  axisLabel: string;
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

export function BoxPlot({ data, axisLabel }: BoxPlotProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="category"
          stroke="hsl(var(--foreground))"
        />
        <YAxis
          label={{ value: axisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--foreground))" }}
          stroke="hsl(var(--foreground))"
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
        <Bar dataKey="median" name="中央値" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.type)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
