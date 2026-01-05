import { Industry } from "../../types/cadastro";
import { getIndustryConfig } from "../../config/industry-config";

interface IndustryBadgeProps {
  industry: Industry | null | undefined;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function IndustryBadge({ industry, size = "md", showIcon = true }: IndustryBadgeProps) {
  const config = getIndustryConfig(industry);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2",
  };

  const iconSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.color.bg} ${config.color.text} ${config.color.border} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </span>
  );
}
