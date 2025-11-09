import { ScatterChart as RechartsScatter, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";

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

const getTypeName = (type: string) => {
  switch (type) {
    case "internal":
      return "社内";
    case "external":
      return "外部";
    case "target":
      return "目標";
    default:
      return type;
  }
};

export function ScatterChart({ data, xAxisLabel, yAxisLabel }: ScatterChartProps) {
  // Group data by type for legend
  const groupedData: Record<string, DataPoint[]> = {};
  data.forEach(point => {
    if (!groupedData[point.type]) {
      groupedData[point.type] = [];
    }
    groupedData[point.type].push(point);
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsScatter>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
        <XAxis
          type="number"
          dataKey="x"
          name={xAxisLabel}
          label={{ value: xAxisLabel, position: "insideBottom", offset: -5, fill: "hsl(var(--foreground))", fontSize: 14, fontWeight: 500 }}
          stroke="hsl(var(--foreground))"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 13 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yAxisLabel}
          label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--foreground))", fontSize: 14, fontWeight: 500 }}
          stroke="hsl(var(--foreground))"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 13 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            color: "hsl(var(--popover-foreground))",
            fontSize: "14px"
          }}
          content={({ payload }) => {
            if (!payload || !payload[0]) return null;
            const data = payload[0].payload as DataPoint;
            return (
              <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
                <p className="font-semibold text-foreground text-sm mb-1">{data.name}</p>
                <p className="text-xs text-muted-foreground">{getTypeName(data.type)}</p>
                <div className="mt-2 text-xs space-y-0.5">
                  <p>{xAxisLabel}: {data.x}</p>
                  <p>{yAxisLabel}: {data.y}</p>
                </div>
              </div>
            );
          }}
          cursor={{ strokeDasharray: "3 3" }}
        />
        <Legend 
          wrapperStyle={{ fontSize: "14px", color: "hsl(var(--foreground))" }}
          iconSize={12}
        />
        {Object.entries(groupedData).map(([type, points]) => (
          <Scatter
            key={type}
            name={points.map(p => p.name).join(", ")}
            data={points}
            fill={getColor(type)}
            shape="circle"
          />
        ))}
      </RechartsScatter>
    </ResponsiveContainer>
  );
}
