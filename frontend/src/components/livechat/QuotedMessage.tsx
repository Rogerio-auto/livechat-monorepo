import { FiCornerDownRight } from "react-icons/fi";

interface QuotedMessageProps {
  message: {
    id: string;
    content: string;
    type: string;
    sender_name?: string;
  };
  onClickQuote?: () => void;
}

export function QuotedMessage({ message, onClickQuote }: QuotedMessageProps) {
  const truncate = (text: string, max = 60) => {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
  };

  return (
    <div 
      className="border-l-4 border-(--color-border) bg-(--color-surface-muted) px-2 py-1.5 rounded mb-1 cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-surface-muted))] transition-colors"
      onClick={onClickQuote}
    >
      <div className="flex items-start gap-1.5">
        <FiCornerDownRight size={14} className="text-(--color-text-muted) mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-(--color-text)">
            {message.sender_name || "Usuário"}
          </div>
          <div className="text-xs text-(--color-text-muted) truncate">
            {message.type !== "TEXT" && `[${message.type}] `}
            {truncate(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
}
