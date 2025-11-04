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
      className="border-l-4 border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded mb-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      onClick={onClickQuote}
    >
      <div className="flex items-start gap-1.5">
        <FiCornerDownRight size={14} className="text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {message.sender_name || "Usuário"}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {message.type !== "TEXT" && `[${message.type}] `}
            {truncate(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
}
