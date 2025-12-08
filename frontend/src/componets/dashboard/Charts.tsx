import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { ChartDataPoint } from "../../types/dashboard";

interface ChartContainerProps {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ChartContainer({ title, loading = false, children, action }: ChartContainerProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-lg">
        <div className="absolute inset-0 bg-white/0 backdrop-blur-sm" />
        <div className="relative mb-4 h-4 w-48 animate-pulse rounded bg-[rgba(47,180,99,0.18)] dark:bg-[rgba(27,58,41,0.6)]" />
        <div className="relative h-64 animate-pulse rounded bg-[rgba(47,180,99,0.18)] dark:bg-[rgba(27,58,41,0.6)]" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-32 bg-linear-to-b from-[rgba(47,180,99,0.16)] via-transparent to-transparent" />
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface LineChartComponentProps {
  data: ChartDataPoint[];
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
}

export function LineChartComponent({
  data,
  dataKey,
  xAxisKey = "name",
  color = "#2fb463",
  height = 220,
}: LineChartComponentProps) {
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
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color} 
          strokeWidth={2}
          dot={{ fill: color, r: 4 }}
        />
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
  colors = ["#2fb463", "#74e69e"],
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
