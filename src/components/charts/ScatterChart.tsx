import { ScatterChart as RechartsScatter, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card } from "@/components/ui/card";

interface DataPoint {
  name: string;
  x: number;
  y: number;
  type: "internal" | "external" | "target";
}

interface ScatterChartProps {
  data: DataPoint[];
  xAxisLabel: string;
  yAxisLabel: string;
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

export function ScatterChart({ data, xAxisLabel, yAxisLabel }: ScatterChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsScatter>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          dataKey="x"
          name={xAxisLabel}
          label={{ value: xAxisLabel, position: "insideBottom", offset: -5, fill: "hsl(var(--foreground))" }}
          stroke="hsl(var(--foreground))"
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yAxisLabel}
          label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--foreground))" }}
          stroke="hsl(var(--foreground))"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            color: "hsl(var(--popover-foreground))"
          }}
          cursor={{ strokeDasharray: "3 3" }}
        />
        <Legend />
        <Scatter name="データポイント" data={data} fill="hsl(var(--primary))">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.type)} />
          ))}
        </Scatter>
      </RechartsScatter>
    </ResponsiveContainer>
  );
}
