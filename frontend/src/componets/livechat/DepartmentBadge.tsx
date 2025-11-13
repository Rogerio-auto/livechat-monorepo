type DepartmentBadgeProps = {
  name: string;
  color?: string;
  icon?: string;
  size?: "sm" | "md";
};

export function DepartmentBadge({ name, color, size = "sm" }: DepartmentBadgeProps) {
  const bgColor = color || "#6366F1";
  const textColor = getContrastColor(bgColor);
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${bgColor}20`, // 20% opacity
        color: bgColor,
        border: `1px solid ${bgColor}40`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: bgColor }}
      />
      <span className="truncate max-w-[100px]">{name}</span>
    </span>
  );
}

// Helper para calcular cor de texto com bom contraste
function getContrastColor(hexColor: string): string {
  // Remove # se presente
  const hex = hexColor.replace("#", "");
  
  // Converte para RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calcula luminância
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Retorna preto ou branco baseado na luminância
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
