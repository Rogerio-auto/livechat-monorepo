import { X } from "lucide-react";

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
        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {message.type !== "TEXT" && `[${message.type}] `}
          {truncate(message.content)}
        </div>
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
        aria-label="Cancelar resposta"
      >
        <X size={16} />
      </button>
    </div>
  );
}
