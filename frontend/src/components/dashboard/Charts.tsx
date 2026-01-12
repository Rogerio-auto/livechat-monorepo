import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { ChartDataPoint } from "@livechat/shared";

interface ChartContainerProps {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ChartContainer({ title, loading = false, children, action }: ChartContainerProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden p-6">
        <div className="relative mb-4 h-4 w-48 animate-pulse rounded bg-(--color-surface-muted)" />
        <div className="relative h-64 animate-pulse rounded bg-(--color-surface-muted)" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-(--color-heading)">
          {title}
        </h3>
        {action}
      </div>
      <div className="h-[300px] w-full">
        {children}
      </div>
    </div>
  );
}

interface LineChartComponentProps {
  data: ChartDataPoint[];
  dataKey?: string;
  dataKeys?: string[];
  xAxisKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
}

export function LineChartComponent({
  data,
  dataKey,
  dataKeys,
  xAxisKey = "name",
  color = "var(--color-primary)",
  colors,
  height = 220,
}: LineChartComponentProps) {
  const keys = dataKeys || (dataKey ? [dataKey] : []);
  const lineColors = colors || [color];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis 
          dataKey={xAxisKey} 
          stroke="var(--color-text-muted)" 
          fontSize={12}
        />
        <YAxis 
          stroke="var(--color-text-muted)" 
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            borderRadius: "8px",
          }}
        />
        {keys.map((key, index) => (
          <Line 
            key={key}
            type="monotone" 
            dataKey={key} 
            stroke={lineColors[index % lineColors.length]} 
            strokeWidth={2}
            dot={{ fill: lineColors[index % lineColors.length], r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

interface BarChartComponentProps {
  data: ChartDataPoint[];
  dataKeys: string[];
  xAxisKey?: string;
  colors?: string[];
  height?: number;
  horizontal?: boolean;
}

export function BarChartComponent({
  data,
  dataKeys,
  xAxisKey = "name",
  colors = ["var(--color-primary)", "var(--color-primary-muted, #74e69e)"],
  height = 220,
  horizontal = false,
}: BarChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        {horizontal ? (
          <>
            <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} />
            <YAxis dataKey={xAxisKey} type="category" stroke="var(--color-text-muted)" fontSize={12} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} stroke="var(--color-text-muted)" fontSize={12} />
            <YAxis stroke="var(--color-text-muted)" fontSize={12} />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            borderRadius: "8px",
          }}
        />
        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartComponentProps {
  data: ChartDataPoint[];
  dataKey: string;
  nameKey?: string;
  colors?: string[];
  height?: number;
}

export function PieChartComponent({
  data,
  dataKey,
  nameKey = "name",
  colors = ["#2fb463", "#74e69e", "#6bd897", "#1f8b49", "#0f2418"],
  height = 220,
}: PieChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(props: PieLabelRenderProps) => {
            const name = String(props.name ?? "");
            const percent = typeof props.percent === "number" ? props.percent : Number(props.percent ?? 0);
            return `${name}: ${(percent * 100).toFixed(0)}%`;
          }}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            borderRadius: "8px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
