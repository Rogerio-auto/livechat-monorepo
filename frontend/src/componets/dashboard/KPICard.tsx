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
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600 dark:text-blue-400",
    glow: "bg-blue-500/10",
  },
  green: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    glow: "bg-emerald-500/10",
  },
  purple: {
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-600 dark:text-purple-400",
    glow: "bg-purple-500/10",
  },
  orange: {
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-600 dark:text-orange-400",
    glow: "bg-orange-500/10",
  },
  pink: {
    iconBg: "bg-pink-500/15",
    iconColor: "text-pink-600 dark:text-pink-400",
    glow: "bg-pink-500/10",
  },
  teal: {
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-600 dark:text-teal-400",
    glow: "bg-teal-500/10",
  },
  indigo: {
    iconBg: "bg-indigo-500/15",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    glow: "bg-indigo-500/10",
  },
  red: {
    iconBg: "bg-red-500/15",
    iconColor: "text-red-600 dark:text-red-400",
    glow: "bg-red-500/10",
  },
  slate: {
    iconBg: "bg-slate-500/15",
    iconColor: "text-slate-600 dark:text-slate-300",
    glow: "bg-slate-500/10",
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
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 shadow-lg animate-pulse">
        <div className="absolute top-0 right-0 h-20 w-20 rounded-full blur-3xl bg-slate-400/10" />
        <div className="h-4 w-24 bg-slate-200/60 dark:bg-slate-700/60 rounded mb-4" />
        <div className="h-8 w-32 bg-slate-200/60 dark:bg-slate-700/60 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-200/60 dark:bg-slate-700/60 rounded" />
      </div>
    );
  }

  return (
  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
      <div className={`pointer-events-none absolute -top-8 right-0 h-28 w-28 rounded-full blur-3xl ${accent.glow}`} />
      <div className={`pointer-events-none absolute -bottom-10 left-6 h-32 w-32 rounded-full blur-3xl opacity-70 ${accent.glow}`} />
      <div className="flex items-start justify-between mb-4">
        <div className="text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">
          {title}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/60 dark:ring-white/5 backdrop-blur-sm ${accent.iconBg} ${accent.iconColor}`}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </div>
        {suffix && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{suffix}</span>
        )}
      </div>

      {showTrend && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive && <FiTrendingUp className="text-green-500" size={16} />}
          {isNegative && <FiTrendingDown className="text-red-500" size={16} />}
          <span
            className={`text-sm font-medium ${
              isPositive
                ? "text-emerald-500"
                : isNegative
                ? "text-red-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {change > 0 ? "+" : ""}{change}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">vs anterior</span>
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
