type Props = {
  text?: string;
  fullscreen?: boolean;
  subtext?: string;
};

export function LoadingOverlay({
  text = "Carregando...",
  fullscreen = true,
  subtext = "Isso deve levar apenas alguns instantes.",
}: Props) {
  const containerClass = fullscreen
    ? "fixed inset-0 z-50 flex items-center justify-center px-6"
    : "absolute inset-0 z-40 flex items-center justify-center px-4 rounded-xl overflow-hidden";

  const containerStyle = fullscreen
    ? {
        backgroundColor: "color-mix(in srgb, var(--color-overlay) 88%, transparent)",
        backdropFilter: "blur(18px)",
      }
    : {
        backgroundColor: "color-mix(in srgb, var(--color-overlay) 72%, transparent)",
        backdropFilter: "blur(16px)",
      };

  return (
    <div className={containerClass} style={containerStyle}>
      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border px-8 py-6 text-center shadow-[0_28px_80px_-32px_rgba(15,23,42,0.45)]"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--color-surface) 82%, transparent) 0%, color-mix(in srgb, var(--color-surface) 70%, transparent) 60%, color-mix(in srgb, var(--color-surface) 62%, transparent) 100%)",
          borderColor: "color-mix(in srgb, var(--color-border) 65%, transparent)",
          color: "var(--color-text)",
        }}
      >
        <div className="relative h-14 w-14">
          <div
            className="absolute inset-0 rounded-full opacity-25"
            style={{
              background: "radial-gradient(circle at 50% 50%, var(--color-primary) 0%, transparent 68%)",
              filter: "blur(8px)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full border-[3px] opacity-25"
            style={{ borderColor: "color-mix(in srgb, var(--color-primary) 45%, transparent)" }}
          />
          <div
            className="absolute inset-0 rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)" }}
          />
          <div
            className="absolute inset-[32%] rounded-full"
            style={{
              background: "color-mix(in srgb, var(--color-primary) 65%, transparent)",
              filter: "blur(4px)",
              opacity: 0.55,
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold" style={{ color: "var(--color-heading)" }}>
            {text}
          </span>
          {subtext && (
            <span className="text-xs opacity-75" style={{ color: "var(--color-text-muted)" }}>
              {subtext}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.35em] opacity-60" style={{ color: "var(--color-text-muted)" }}>
          <span className="animate-pulse" style={{ animationDuration: "1.6s" }}>
            Preparando contexto
          </span>
        </div>
      </div>
    </div>
  );
}

