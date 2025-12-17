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
    iconColor: "text-blue-600 dark:text-blue-400",
    glow: "bg-blue-500/5",
  },
  green: {
    iconBg: "bg-green-500/10",
    iconColor: "text-green-600 dark:text-green-400",
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
      <div className="relative overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 animate-pulse">
        {/* ... shimmer blocks ... */}
        <div className="mb-4 h-4 w-24 rounded bg-[color:var(--color-surface-muted)]" />
        <div className="mb-2 h-8 w-32 rounded bg-[color:var(--color-surface-muted)]" />
        <div className="h-3 w-20 rounded bg-[color:var(--color-surface-muted)]" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-6 transition-all duration-200 hover:border-[color:var(--color-primary)]">
      {/* ...existing code... */}
      <div className="mb-4 flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {title}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] ${accent.iconColor}`}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-[color:var(--color-heading)]">
          {value}
        </div>
        {suffix && (
          <span className="text-sm text-[color:var(--color-text-muted)]">{suffix}</span>
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
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {change > 0 ? "+" : ""}{change}%
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">vs anterior</span>
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
