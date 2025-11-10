import { useEffect, useMemo } from "react";
import { FiCpu, FiUser } from "react-icons/fi";
import type { Chat as LivechatChat, Tag } from "../../componets/livechat/types";

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
  inbox_id?: string | null;
  assigned_agent_name?: string | null;
  ai_agent_id?: string | null;
  ai_agent_name?: string | null;
  ai_mode?: string | null;
  status?: string | null;
  tag_ids?: string[];
};

export type Chat = BaseChat;

export interface Inbox {
  id: string;
  name: string;
  phone_number?: string | null;
  provider?: string | null;
}

export interface ChatListProps {
  chats: Chat[];
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  isGroupList?: boolean;
  inboxes?: Inbox[];
  tags?: Tag[];
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
  inboxes = [],
  tags = [],
}: ChatListProps) {
  // Create a map of tags for quick lookup
  const tagsMap = useMemo(() => {
    return new Map(tags.map((tag) => [tag.id, tag]));
  }, [tags]);

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
      <div className="p-3 text-sm text-(--color-text-muted)">
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

        // Find inbox info
        const inbox = inboxes.find((i) => i.id === chat.inbox_id);
        const inboxLabel = inbox?.name || inbox?.phone_number || null;
        const inboxProvider = inbox?.provider || null;

        return (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-150 border ${
              active
                ? "bg-(--color-primary)/18 border-(--color-primary)/35 text-(--color-heading) shadow-[0_12px_28px_-20px_color-mix(in_srgb,var(--color-text)_18%,transparent)]"
                : "border-transparent bg-(--color-surface-muted)/70 hover:border-(--color-border) hover:bg-(--color-surface-muted)/90"
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
                    ? "bg-(--color-primary)/15 text-(--color-primary)"
                    : "bg-(--color-border)/60 text-(--color-text-muted)"
                }`}
              >
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium truncate text-(--color-heading)">
                  {chat.name}
                  {chat.isGroup && chat.groupSizeLabel ? (
                    <span className="ml-2 text-xs font-normal text-(--color-text-muted)">
                      ({chat.groupSizeLabel})
                    </span>
                  ) : null}
                </div>
                {inboxLabel && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                      inboxProvider === "META" || inboxProvider === "META_CLOUD"
                        ? "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        : inboxProvider === "WAHA"
                          ? "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                          : "bg-gray-500/15 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400"
                    }`}
                    title={`Inbox: ${inboxLabel}${inboxProvider ? ` (${inboxProvider})` : ""}`}
                  >
                    {inboxLabel.length > 15 ? `${inboxLabel.slice(0, 15)}...` : inboxLabel}
                  </span>
                )}
                
                {/* Tags indicators */}
                {chat.tag_ids && chat.tag_ids.length > 0 && (
                  <div className="flex items-center gap-1">
                    {chat.tag_ids.slice(0, 3).map((tagId) => {
                      const tag = tagsMap.get(tagId);
                      if (!tag) return null;
                      return (
                        <span
                          key={tagId}
                          className="h-5 w-1 rounded-full"
                          style={{ backgroundColor: tag.color || "#6B7280" }}
                          title={tag.name}
                        />
                      );
                    })}
                    {chat.tag_ids.length > 3 && (
                      <span className="text-[9px] text-(--color-text-muted)" title={`+${chat.tag_ids.length - 3} tags`}>
                        +{chat.tag_ids.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Agent Assignment Info */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Human Agent - Always show when assigned */}
                {chat.assigned_agent_name && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400" title={`Agente atribuído: ${chat.assigned_agent_name}`}>
                    <FiUser className="w-3 h-3" />
                    <span className="font-medium">{chat.assigned_agent_name}</span>
                  </div>
                )}
                
                {/* AI Agent - Show with active color if status=AI, opaque otherwise */}
                {chat.ai_agent_id && chat.ai_agent_name && (
                  <div 
                    className={`flex items-center gap-1 text-[10px] ${
                      chat.status === "AI" 
                        ? "text-purple-600 dark:text-purple-400" 
                        : "text-purple-600/40 dark:text-purple-400/40"
                    }`}
                    title={
                      chat.status === "AI" 
                        ? `Atendimento ativo por IA: ${chat.ai_agent_name}` 
                        : `IA disponível: ${chat.ai_agent_name} (inativo)`
                    }
                  >
                    <FiCpu className="w-3 h-3" />
                    <span className="font-medium">{chat.ai_agent_name}</span>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-(--color-text-muted) truncate">{subtitle}</div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-(--color-text-muted)">{lastAt}</div>
              {chat.unread_count && chat.unread_count > 0 ? (
                <div className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-(--color-primary) text-white text-xs font-semibold">
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
