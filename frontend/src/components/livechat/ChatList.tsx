import { useEffect } from "react";
import type { Chat as LivechatChat } from "../../componets/livechat/types";

type BaseChat = Partial<LivechatChat> & {
  id: string;
  name: string;
  display_name?: string | null;
  display_phone?: string | null;
  display_remote_id?: string | null;
  group_size?: number | null;
  kind?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  photo_url?: string | null;
  isGroup?: boolean;
  group_avatar_url?: string | null;
  customer_avatar_url?: string | null;
  remote_id?: string | null;
  unread_count?: number | null;
};

export type Chat = BaseChat;

export interface ChatListProps {
  chats: Chat[];
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  isGroupList?: boolean;
}

const DEFAULT_AVATAR = "/default-avatar.png";
const PLACEHOLDER_NAME_RE = /^contato\s*\d*$/i;
const DIGIT_ONLY_RE = /^\+?\d+$/;

function isMeaningful(value?: string | null): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === "-") return false;
  if (PLACEHOLDER_NAME_RE.test(trimmed)) return false;
  if (DIGIT_ONLY_RE.test(trimmed)) return false;
  return true;
}

function sanitizeRemote(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/@.*/, "").replace(/[^\w+.-]/g, "");
}

function formatPhone(raw?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw.trim() || digits;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function ChatList({
  chats,
  activeChatId,
  onSelectChat,
  isGroupList = false,
}: ChatListProps) {
  const normalizedChats = chats.map((chat) => {
    const explicitGroupFlag =
      typeof chat.is_group === "boolean"
        ? chat.is_group
        : typeof chat.isGroup === "boolean"
          ? chat.isGroup
          : null;

    const explicitGroup = explicitGroupFlag ?? false;
    const kindLooksGroup = typeof chat.kind === "string" && chat.kind.toUpperCase() === "GROUP";
    const remoteLooksGroup =
      typeof chat.remote_id === "string" && chat.remote_id.toLowerCase().endsWith("@g.us");
    const isGroup = explicitGroup || kindLooksGroup || remoteLooksGroup;

    const remoteCandidate =
      chat.display_remote_id ?? chat.remote_id ?? chat.external_id ?? chat.id ?? null;
    const sanitizedRemote = sanitizeRemote(remoteCandidate);
    const formattedPhone =
      formatPhone(chat.display_phone ?? chat.customer_phone ?? (chat as any)?.phone ?? null) ?? null;

    const groupNameCandidates = [
      chat.group_name,
      chat.display_name,
      chat.customer_name,
      sanitizedRemote,
      chat.name,
    ].filter(isMeaningful);

    const personNameCandidates = [
      chat.customer_name,
      chat.display_name,
      formattedPhone,
      sanitizedRemote,
      chat.name,
    ].filter(isMeaningful);

    const primaryName =
      (isGroup ? groupNameCandidates : personNameCandidates)[0] ?? sanitizedRemote ?? chat.id;

    const groupSizeLabel =
      isGroup && typeof chat.group_size === "number" && Number.isFinite(chat.group_size)
        ? `${chat.group_size} ${chat.group_size === 1 ? "membro" : "membros"}`
        : null;

    const lastMessage = chat.last_message ?? null;
    const effectiveTimestamp = chat.last_message_at ?? chat.created_at ?? null;
    const defaultPreview = isGroup ? "Nenhuma mensagem recente" : "Sem mensagens";
    const secondaryParts = [
      groupSizeLabel ?? undefined,
      lastMessage ?? undefined,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);
    const secondaryLine = secondaryParts.length > 0 ? secondaryParts.join(" - ") : defaultPreview;

    const avatarSource = isGroup
      ? chat.group_avatar_url ?? chat.customer_avatar_url ?? chat.photo_url ?? null
      : chat.customer_avatar_url ?? chat.photo_url ?? null;

    return {
      ...chat,
      isGroup,
      name: primaryName,
      groupSizeLabel,
      last_message: lastMessage ?? defaultPreview,
      last_message_at: effectiveTimestamp,
      photo_url: avatarSource,
      secondaryLine,
    };
  });

  // Debug leve: quantos chats vieram com foto_url para validar avatars
  useEffect(() => {
    const withPhoto = normalizedChats.filter((c) => !!c.photo_url).length;
    console.debug("[UI][ChatList] avatars:", { total: normalizedChats.length, withPhoto });
  }, [normalizedChats]);

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
        const displayTimestamp = chat.last_message_at ?? chat.created_at ?? null;
        const lastAt = displayTimestamp
          ? new Date(displayTimestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";
        const initials = getInitials(chat.name);
        const hasPhoto = Boolean(chat.photo_url);
        const subtitle = chat.secondaryLine ?? chat.last_message;

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
                src={chat.photo_url ?? DEFAULT_AVATAR}
                alt={chat.name}
                className="w-10 h-10 rounded-full object-cover"
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (chat.photo_url) console.debug("[UI][ChatList] avatar loaded", { chatId: chat.id, url: chat.photo_url });
                }}
                onError={(event) => {
                  const img = event.currentTarget as HTMLImageElement;
                  console.warn("[UI][ChatList] avatar failed, fallback", { chatId: chat.id, url: chat.photo_url });
                  img.src = DEFAULT_AVATAR;
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
                {chat.isGroup && chat.groupSizeLabel ? (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                    ({chat.groupSizeLabel})
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-[var(--color-text-muted)] truncate">{subtitle}</div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-[var(--color-text-muted)]">{lastAt}</div>
              {chat.unread_count && chat.unread_count > 0 ? (
                <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[color:var(--color-primary)] text-white text-xs font-semibold">
                  {chat.unread_count > 99 ? "99+" : chat.unread_count}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
