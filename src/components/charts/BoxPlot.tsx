import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface BoxPlotDataPoint {
  category: string;
  name: string;
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

export function BoxPlot({ data, axisLabel }: BoxPlotProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--foreground))"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          label={{ value: axisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--foreground))", fontSize: 14, fontWeight: 500 }}
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
            const data = payload[0].payload as BoxPlotDataPoint;
            return (
              <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
                <p className="font-semibold text-foreground text-sm mb-1">{data.name}</p>
                <p className="text-xs text-muted-foreground mb-2">{getTypeName(data.type)}</p>
                <div className="text-xs space-y-0.5">
                  <p>中央値: {data.median}</p>
                  <p>範囲: {data.min} - {data.max}</p>
                </div>
              </div>
            );
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: "14px" }}
          iconSize={12}
          payload={data.map((entry, index) => ({
            value: entry.name,
            type: "square",
            color: getColor(entry.type),
            id: `legend-${index}`
          }))}
        />
        <Bar dataKey="median" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.type)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
