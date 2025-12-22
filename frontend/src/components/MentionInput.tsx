import { useState, useRef, useMemo, useCallback } from "react";
import { FiAtSign } from "react-icons/fi";

interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  users: User[];
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  users,
  className,
  autoFocus,
  disabled,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filtra usuários baseado na busca - memoizado para evitar recalcular
  const filteredUsers = useMemo(() => 
    users.filter((user) =>
      user.name.toLowerCase().includes(mentionSearch.toLowerCase())
    ),
    [users, mentionSearch]
  );

  // Debug logs removed for performance

  // Extrai as menções do texto - memoizado
  const extractMentions = useCallback((text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]); // match[2] é o user_id
    }
    return mentions;
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Verifica se está digitando uma menção
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      // Se não tem espaço ou quebra de linha depois do @, está digitando uma menção
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionSearch(textAfterAt);
        setMentionStartPos(lastAtSymbol);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }

    // Só extrai mentions se o texto contém o padrão @[
    const mentions = newValue.includes('@[') ? extractMentions(newValue) : [];
    onChange(newValue, mentions);
  };

  const insertMention = (user: User) => {
    const beforeMention = value.slice(0, mentionStartPos);
    const afterCursor = value.slice(textareaRef.current?.selectionStart || value.length);
    const mention = `@[${user.name}](${user.id})`;
    const newValue = beforeMention + mention + " " + afterCursor;
    
    // Inserting mention
    
    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
    setShowSuggestions(false);
    setMentionSearch("");

    // Foca o textarea novamente
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mention.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Renderiza o texto para exibição (substitui formato markdown por texto simples)
  const displayValue = value.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "@$1");

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        className={`w-full ${className || ''}`}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
        style={{
          resize: "none",
          fontFamily: "inherit",
          minHeight: "42px",
          maxHeight: "120px",
          overflowY: "auto"
        }}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-xs overflow-hidden rounded-lg border shadow-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="max-h-48 overflow-y-auto">
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                  index === selectedIndex ? "bg-opacity-10" : ""
                }`}
                style={{
                  backgroundColor:
                    index === selectedIndex
                      ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      : "transparent",
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--color-surface-muted)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="theme-heading text-sm font-medium truncate">{user.name}</div>
                  {user.email && (
                    <div className="theme-text-muted text-xs truncate">{user.email}</div>
                  )}
                </div>
                <FiAtSign className="h-4 w-4 theme-text-muted shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
