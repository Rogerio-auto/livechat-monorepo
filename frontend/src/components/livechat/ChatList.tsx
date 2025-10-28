import type { Chat as LivechatChat } from "../../componets/livechat/types";
import { useMemo } from "react";

type BaseChat = Partial<LivechatChat> & {
  id: string;
  name: string;
  last_message?: string | null;
  last_message_at?: string | null;
  photo_url?: string | null;
  isGroup?: boolean;
};

export type Chat = BaseChat;

export interface ChatListProps {
  chats: Chat[];
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  isGroupList?: boolean;
}

const DEFAULT_AVATAR = "/default-avatar.png";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function ChatList({
  chats,
  activeChatId,
  onSelectChat,
  isGroupList = false,
}: ChatListProps) {
  const normalizedChats = useMemo(() => {
  return chats.map((chat) => ({
      ...chat,
      isGroup:
        (typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP") ||
        (typeof chat.remote_id === "string" && chat.remote_id.endsWith("@g.us")) ||
        !!chat.isGroup,
      name: (() => {
        const baseName =
          chat.name ||
          chat.customer_name ||
          chat.customer_phone ||
          chat.id;
        const groupName =
          (typeof chat.group_name === "string" && chat.group_name.trim()) ? chat.group_name : null;
        if (
          (typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP") ||
          (typeof chat.remote_id === "string" && chat.remote_id.endsWith("@g.us"))
        ) {
          return groupName || baseName;
        }
        return baseName;
      })(),
      last_message: chat.last_message ?? null,
      last_message_at: chat.last_message_at ?? null,
      photo_url:
        ((typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP") ||
        (typeof chat.remote_id === "string" && chat.remote_id.endsWith("@g.us")))
          ? chat.group_avatar_url || chat.photo_url || null
          : chat.photo_url ?? null,
    }));
  }, [chats]);

  if (!normalizedChats.length) {
    return (
      <div className="p-3 text-sm text-[var(--color-text-muted)]">
        {isGroupList ? "Nenhum grupo encontrado" : "Nenhum chat encontrado"}
      </div>
    );
  }

  return (
    <>
      {normalizedChats.map((chat) => {
        const active = activeChatId === chat.id;
        const lastAt = chat.last_message_at
          ? new Date(chat.last_message_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";
        const initials = getInitials(chat.name);
        const hasPhoto = Boolean(chat.photo_url);

        return (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-150 border ${
              active
                ? "bg-[color:var(--color-primary)]/18 border-[color:var(--color-primary)]/35 text-[var(--color-heading)] shadow-[0_16px_36px_-30px_rgba(8,12,20,0.9)]"
                : "border-transparent bg-[color:var(--color-surface-muted)]/70 hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)]/90"
            }`}
          >
            {hasPhoto ? (
              <img
                src={chat.photo_url || DEFAULT_AVATAR}
                alt={chat.name}
                className="w-10 h-10 rounded-full object-cover"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                }}
              />
            ) : (
              <div
                aria-hidden
                className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold ${
                  chat.isGroup
                    ? "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]"
                    : "bg-[color:var(--color-border)]/60 text-[var(--color-text-muted)]"
                }`}
              >
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-medium truncate text-[var(--color-heading)]">
                {chat.name}
              </div>
              <div className="text-sm text-[var(--color-text-muted)] truncate">
                {chat.last_message
                  ? chat.last_message
                  : isGroupList
                  ? "Nenhuma mensagem recente"
                  : "Sem mensagens"}
              </div>
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">{lastAt}</div>
          </div>
        );
      })}
    </>
  );
}
