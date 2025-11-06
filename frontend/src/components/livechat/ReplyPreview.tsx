import { FiX } from "react-icons/fi";

interface ReplyPreviewProps {
  message: {
    id: string;
    content: string;
    type: string;
    sender_name?: string;
  };
  onCancel: () => void;
}

export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  const truncate = (text: string, max = 50) => {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
  };

  return (
    <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded flex items-start justify-between gap-2 mb-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
          Respondendo para {message.sender_name || "Usuário"}
        </div>
        <div className="text-sm text-(--color-text) truncate">
          {message.type !== "TEXT" && `[${message.type}] `}
          {truncate(message.content)}
        </div>
      </div>
      <button
        onClick={onCancel}
        className="text-(--color-text-muted) hover:text-(--color-text) transition-colors"
        aria-label="Cancelar resposta"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}
