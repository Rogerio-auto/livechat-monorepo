import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";

type AccentTone =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "teal"
  | "indigo"
  | "red"
  | "slate";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  suffix?: string;
  loading?: boolean;
  accentColor?: AccentTone;
}

const ACCENT_STYLES: Record<AccentTone, { iconBg: string; iconColor: string; glow: string }> = {
  blue: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-[#1f6feb] dark:text-[#388bfd]",
    glow: "bg-blue-500/5",
  },
  green: {
    iconBg: "bg-green-500/10",
    iconColor: "text-[#2fb463] dark:text-[#2ea043]",
    glow: "bg-green-500/5",
  },
  purple: {
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    glow: "bg-purple-500/5",
  },
  orange: {
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-600 dark:text-orange-400",
    glow: "bg-orange-500/5",
  },
  pink: {
    iconBg: "bg-pink-500/10",
    iconColor: "text-pink-600 dark:text-pink-400",
    glow: "bg-pink-500/5",
  },
  teal: {
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-600 dark:text-teal-400",
    glow: "bg-teal-500/5",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    glow: "bg-indigo-500/5",
  },
  red: {
    iconBg: "bg-red-500/10",
    iconColor: "text-red-600 dark:text-red-400",
    glow: "bg-red-500/5",
  },
  slate: {
    iconBg: "bg-slate-500/10",
    iconColor: "text-slate-600 dark:text-slate-400",
    glow: "bg-slate-500/5",
  },
};

export function KPICard({
  title,
  value,
  change,
  icon,
  suffix = "",
  loading = false,
  accentColor = "blue",
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const showTrend = change !== undefined && change !== 0;
  const accent = ACCENT_STYLES[accentColor] ?? ACCENT_STYLES.blue;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-(--color-surface-muted)" />
          <div className="h-11 w-11 rounded-xl bg-(--color-surface-muted)" />
        </div>
        <div className="h-10 w-32 rounded bg-(--color-surface-muted)" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 transition-all border border-slate-100 dark:border-slate-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
          {title}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconColor}`}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-(--color-heading)">
          {value}
        </div>
        {suffix && (
          <span className="text-sm text-(--color-text-muted)">{suffix}</span>
        )}
      </div>

      {showTrend && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive && <FiTrendingUp className="text-[#2fb463]" size={16} />}
          {isNegative && <FiTrendingDown className="text-red-500" size={16} />}
          <span
            className={`text-sm font-medium ${
              isPositive
                ? "text-[#2fb463]"
                : isNegative
                ? "text-red-500"
                : "text-(--color-text-muted)"
            }`}
          >
            {change > 0 ? "+" : ""}{change}%
          </span>
          <span className="text-xs text-(--color-text-muted)">vs anterior</span>
        </div>
      )}
    </div>
  );
}

// Helper para formatar tempo em string legível
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

