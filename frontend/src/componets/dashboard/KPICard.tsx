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
    iconBg: "bg-[rgba(47,180,99,0.18)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(47,180,99,0.16)]",
  },
  green: {
    iconBg: "bg-[rgba(66,205,115,0.22)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(66,205,115,0.2)]",
  },
  purple: {
    iconBg: "bg-[rgba(116,230,158,0.22)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(116,230,158,0.18)]",
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
    iconBg: "bg-[rgba(114,220,170,0.22)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(114,220,170,0.18)]",
  },
  indigo: {
    iconBg: "bg-[rgba(36,120,74,0.28)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(36,120,74,0.22)]",
  },
  red: {
    iconBg: "bg-red-500/15",
    iconColor: "text-red-600 dark:text-red-400",
    glow: "bg-red-500/10",
  },
  slate: {
    iconBg: "bg-[rgba(21,63,41,0.22)]",
    iconColor: "text-[#1f8b49] dark:text-[#74e69e]",
    glow: "bg-[rgba(21,63,41,0.18)]",
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
      <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-lg animate-pulse">
        <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-[rgba(47,180,99,0.12)] blur-3xl dark:bg-[rgba(116,230,158,0.18)]" />
        <div className="mb-4 h-4 w-24 rounded bg-[rgba(47,180,99,0.18)] dark:bg-[rgba(27,58,41,0.6)]" />
        <div className="mb-2 h-8 w-32 rounded bg-[rgba(47,180,99,0.18)] dark:bg-[rgba(27,58,41,0.6)]" />
        <div className="h-3 w-20 rounded bg-[rgba(47,180,99,0.18)] dark:bg-[rgba(27,58,41,0.6)]" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
      <div className={`pointer-events-none absolute -top-8 right-0 h-28 w-28 rounded-full blur-3xl ${accent.glow}`} />
      <div className={`pointer-events-none absolute -bottom-10 left-6 h-32 w-32 rounded-full blur-3xl opacity-70 ${accent.glow}`} />
      <div className="mb-4 flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur-sm ${accent.iconBg} ${accent.iconColor}`}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-[var(--color-text)]">
          {value}
        </div>
        {suffix && (
          <span className="text-sm text-[var(--color-text-muted)]">{suffix}</span>
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
