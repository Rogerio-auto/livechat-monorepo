import clsx from "clsx";
import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  glow?: boolean;
};

export const Card = ({ children, className, glow = false }: CardProps) => (
  <div
    className={clsx(
      "rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft backdrop-blur",
      glow && "border-primary/30 shadow-[0_20px_80px_rgba(47,180,99,0.25)]",
      className,
    )}
  >
    {children}
  </div>
);
