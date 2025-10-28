type Props = {
  text?: string;
  fullscreen?: boolean;
};

export function LoadingOverlay({ text = "Carregando...", fullscreen = true }: Props) {
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          : "absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-xl"
      }
    >
      <div className="flex flex-col items-center gap-3 px-6 py-5 bg-white/80 text-[#1d2b22] rounded-2xl shadow-lg ring-1 ring-black/5">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-600 animate-spin" />
        <div className="text-sm font-medium opacity-80">{text}</div>
      </div>
    </div>
  );
}

