import clsx from "clsx";
import { type ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "primary" | "neutral" | "success";
  className?: string;
};

export const Badge = ({ children, variant = "primary", className }: BadgeProps) => {
  const styles = {
    primary: "bg-primary/10 text-primary border border-primary/20",
    neutral: "bg-white/10 text-white border border-white/30",
    success: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  };

  return (
    <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", styles[variant], className)}>
      {children}
    </span>
  );
};
