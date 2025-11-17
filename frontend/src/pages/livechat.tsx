import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction, type UIEvent } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../utils/api";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../componets/Sidbars/sidebar";
import ChatList, { type Chat as ChatListItem } from "../components/livechat/ChatList";
import LivechatMenu, {
  type LivechatSection,
} from "../componets/livechat/LivechatMenu";
import { ChatHeader } from "../componets/livechat/ChatHeader";
import { MessageBubble } from "../componets/livechat/MessageBubble";
import { LabelsManager } from "../componets/livechat/LabelsManager";
import { ReplyPreview } from "../components/livechat/ReplyPreview";
import type { Chat, Message, Inbox, Tag, Contact } from "../componets/livechat/types";
import { FiPaperclip, FiMic, FiSmile, FiX, FiFilter, FiSearch } from "react-icons/fi";
import { ContactsCRM } from "../componets/livechat/ContactsCRM";
import CampaignsPanel from "../componets/livechat/CampaignsPanel";
import { FirstInboxWizard } from "../componets/livechat/FirstInboxWizard";
import { Button, Card } from "../components/ui";
const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5000";

const MEDIA_PREVIEW_LABELS: Record<string, string> = {
  IMAGE: "??? Imagem",
  VIDEO: "?? V?deo",
  AUDIO: "?? ?udio",
  DOCUMENT: "?? Documento",
  FILE: "?? Documento",
};

const WHATSAPP_GROUP_SUFFIX = "@g.us";
const REMOTE_SANITIZE_REGEX = /[^\w+.-]/g;

function sanitizeRemoteIdentifier(value?: string | null) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.replace(/@.*/, "").replace(REMOTE_SANITIZE_REGEX, "");
}

function isWhatsappGroupRemote(remote?: string | null) {
  if (!remote) return false;
  return String(remote).toLowerCase().endsWith(WHATSAPP_GROUP_SUFFIX);
}

function formatPhoneDisplay(raw?: string | null) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith('55') && digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (raw.trim().startsWith('+')) {
    return raw.trim();
  }
  return digits || raw.trim();
}

export default function LiveChatPage() {
  const navigate = useNavigate();
  const [chatsState, setChatsState] = useState<Chat[]>([]);
  const chatsRef = useRef<Chat[]>([]);
  const setChats = useCallback((value: SetStateAction<Chat[]>) => {
    setChatsState((prev) => {
      const next = typeof value === "function" ? (value as (prevState: Chat[]) => Chat[])(prev) : value;
      chatsRef.current = next;
      return next;
    });
  }, []);
  const chats = chatsState;
  useEffect(() => {
    console.debug("[livechat] chats state updated", { count: chatsState.length, first: chatsState[0]?.id });
  }, [chatsState]);
  const [chatsTotal, setChatsTotal] = useState(0);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(false);
  const chatsOffsetRef = useRef(0);
  const isChatsLoadingRef = useRef(false);
  const PAGE_SIZE = 20;
  const MESSAGES_PAGE_SIZE = 20;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("OPEN");
  const [chatScope, setChatScope] = useState<"conversations" | "groups">("conversations");
  const [section, setSection] = useState<LivechatSection>("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; color?: string | null; icon?: string | null }>>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsRefreshKey, setDepartmentsRefreshKey] = useState(0);
  const [isDepartmentChanging, setIsDepartmentChanging] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [inboxId, setInboxId] = useState<string>("");
  const [showFirstInboxWizard, setShowFirstInboxWizard] = useState(false);
  const [inboxesLoading, setInboxesLoading] = useState(true);
  const [isCheckingWizard, setIsCheckingWizard] = useState(true);
  const [hasInboxAccess, setHasInboxAccess] = useState<boolean | null>(null);
  const [accessCheckError, setAccessCheckError] = useState<string | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  const chatsListRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesMetaRef = useRef<Record<string, { nextBefore: string | null; hasMore: boolean }>>({});
  const isPrependingMessagesRef = useRef(false);
  const [isFetchingOlderMessages, setIsFetchingOlderMessages] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPrivateOpen, setIsPrivateOpen] = useState(false);
  const [privateText, setPrivateText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const tagOperationsRef = useRef<Set<string>>(new Set()); // Track ongoing tag operations
  const currentChatIdRef = useRef<string | null>(null);
  const chatsTotalRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const messagesCache = useMemo(() => new Map<string, Message[]>(), []);
  const messageLatencyRef = useRef<Map<string, number>>(new Map());
  const draftsRef = useRef<Map<string, { chatId: string; content: string; type: string; createdAt: string }>>(
    new Map(),
  );
  const messagesRequestRef = useRef<symbol | null>(null);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, string | null>>({});
  const chatsAbortRef = useRef<AbortController | null>(null);
  const chatsCacheMetaRef = useRef<Record<string, { etag: string | null; lastModified: string | null }>>({});
  const chatsStoreRef = useRef<Record<string, { items: Chat[]; total: number; offset: number; hasMore: boolean }>>({});
  const currentChatsKeyRef = useRef<string | null>(null);
  const chatsReqIdRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersContainerRef = useRef<HTMLDivElement | null>(null);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (inboxId) count += 1;
    if (selectedDepartmentId) count += 1;
    if (status && status !== "OPEN") count += 1;
    return count;
  }, [inboxId, selectedDepartmentId, status]);

  useEffect(() => {
    if (!filtersOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const node = filtersContainerRef.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      setFiltersOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen]);

  const resetFilters = useCallback(() => {
    setInboxId("");
    setSelectedDepartmentId(null);
    setStatus("OPEN");
  }, []);

  // Status options: used for filtering and per-chat status change
  const FILTER_STATUS_OPTIONS = useMemo(
    () => [
      { value: "ALL", label: "Todos" },
      { value: "OPEN", label: "Abertos" },
      { value: "ASSIGNED", label: "Atribu�do" },
      { value: "PENDING", label: "Pendentes" },
      { value: "AI", label: "Agente de IA" },
      { value: "RESOLVED", label: "Resolvidos" },
      { value: "CLOSED", label: "Fechados" },
    ],
    [],
  );
  const CHAT_STATUS_OPTIONS = useMemo(
    () => FILTER_STATUS_OPTIONS.filter((o) => o.value !== "ALL"),
    [FILTER_STATUS_OPTIONS],
  );

  

  const activeInbox = useMemo(() => {
    if (!inboxId) {
      return inboxes.length > 0 ? inboxes[0] : null;
    }
    return inboxes.find((ib) => ib.id === inboxId) ?? null;
  }, [inboxes, inboxId]);

  const isGroupChat = useCallback((chat: Chat): boolean => {
    if (!chat) return false;
    const chatType = (chat as any)?.chat_type
      ? String((chat as any).chat_type).toUpperCase()
      : null;
    if (chatType === "GROUP" || chatType === "GRUPO") return true;
    if (typeof chat.is_group === "boolean") return chat.is_group;
    const kind = (chat.kind || "").toString().toUpperCase();
    if (kind === "GROUP") return true;
    const remoteCandidate = chat.display_remote_id || chat.remote_id || chat.external_id || null;
    return isWhatsappGroupRemote(remoteCandidate);
  }, []);

  const mediaItems = useMemo(() => {
    return messages
      .filter((message) => {
        const t = (message.type || "").toUpperCase();
        return (
          Boolean(message.media_url) &&
          ["IMAGE", "VIDEO", "DOCUMENT"].includes(t)
        );
      })
      .map((message) => ({
        id: message.id,
        type: ((message.type || "DOCUMENT").toUpperCase() as
          | "IMAGE"
          | "VIDEO"
          | "DOCUMENT"),
        url: message.media_url as string,
        caption: message.body ?? null,
      }));
  }, [messages]);

  const mediaIndexById = useMemo(() => {
    const indexMap = new Map<string, number>();
    mediaItems.forEach((item, idx) => {
      indexMap.set(item.id, idx);
    });
    return indexMap;
  }, [mediaItems]);

  const normalizeChat = useCallback((raw: any): Chat => {
    if (!raw) return raw as Chat;
    const base: any = { ...raw };

    base.last_message = base.last_message ?? null;
    base.last_message_at = base.last_message_at ?? base.created_at ?? null;
    base.last_message_from = base.last_message_from ?? null;
    base.last_message_type = base.last_message_type ?? null;
    base.last_message_media_url = base.last_message_media_url ?? null;

    const remoteCandidate = base.remote_id ?? base.external_id ?? null;
    base.remote_id = typeof remoteCandidate === "string" ? remoteCandidate : base.remote_id ?? null;

    const chatType = typeof base.chat_type === "string" ? base.chat_type.toUpperCase() : null;
    base.chat_type = chatType;

    base.group_name = base.group_name ?? null;
    base.group_avatar_url = base.group_avatar_url ?? null;
    base.customer_avatar_url = base.customer_avatar_url ?? null;
    base.customer_name = base.customer_name ?? (base as any)?.name ?? null;
    base.customer_phone = base.customer_phone ?? (base as any)?.phone ?? (base as any)?.cellphone ?? (base as any)?.celular ?? null;

    const cleanedRemote = sanitizeRemoteIdentifier(base.display_remote_id ?? base.remote_id ?? base.external_id ?? null);
    base.display_remote_id = cleanedRemote;

    const explicitGroup =
      typeof base.is_group === "boolean"
        ? base.is_group
        : false;
    const chatTypeSuggestsGroup = chatType === "GROUP" || chatType === "GRUPO";
    const kindSuggestsGroup = typeof base.kind === "string" && base.kind.toUpperCase() === "GROUP";
    const remoteSuggestsGroup = isWhatsappGroupRemote(base.remote_id ?? base.external_id ?? null);
    const inferredGroup = Boolean(explicitGroup || kindSuggestsGroup || remoteSuggestsGroup);
    const finalIsGroup = inferredGroup || chatTypeSuggestsGroup;
    base.is_group = finalIsGroup;
    base.kind = finalIsGroup
      ? "GROUP"
      : (typeof base.kind === "string" && base.kind.trim()) ? base.kind : "DIRECT";
    if (finalIsGroup && !chatTypeSuggestsGroup) {
      base.chat_type = "GROUP";
    }
    if (!finalIsGroup && chatTypeSuggestsGroup) {
      base.kind = "GROUP";
    }

    const formattedPhone = finalIsGroup ? null : formatPhoneDisplay(base.display_phone ?? base.customer_phone ?? cleanedRemote);
    base.display_phone = formattedPhone;
    if (!base.customer_phone && formattedPhone) {
      base.customer_phone = formattedPhone;
    }

    const nameCandidates = [
      base.display_name?.trim(),
      finalIsGroup ? base.group_name : null,
      base.customer_name,
      formattedPhone,
      cleanedRemote,
      base.customer_id,
      base.id,
    ].filter((value) => typeof value === "string" && value.trim() !== "") as string[];

    const resolvedName = nameCandidates.length > 0 ? nameCandidates[0] : null;
    base.display_name = resolvedName;
    if (!resolvedName && base.customer_name) {
      base.display_name = base.customer_name;
    }
    if (finalIsGroup && !base.group_name && base.display_name) {
      base.group_name = base.display_name;
    }

    const maybeGroupSize = base.group_size ?? (raw as any)?.group_size ?? (raw as any)?.participants_count ?? null;
    base.group_size = typeof maybeGroupSize === "number" && Number.isFinite(maybeGroupSize) ? maybeGroupSize : null;

    base.department_id = typeof base.department_id === "string" && base.department_id.trim()
      ? base.department_id
      : null;
    base.department_name = typeof base.department_name === "string" && base.department_name.trim()
      ? base.department_name
      : null;
    base.department_color = typeof base.department_color === "string" && base.department_color.trim()
      ? base.department_color
      : null;
    base.department_icon = typeof base.department_icon === "string" && base.department_icon.trim()
      ? base.department_icon
      : null;

    return base as Chat;
  }, []);

  const normalizeChats = useCallback((list: any[]): Chat[] => list.map((item) => normalizeChat(item)), [normalizeChat]);

  // [KANBAN-BACKEND] util para atualizar card localmente
  const patchChatLocal = useCallback((chatId: string, partial: Partial<Chat>) => {
    setSelectedChat((prev) => (prev && prev.id === chatId ? { ...prev, ...partial } : prev));
    setChatsByStage((prev) => {
      const draft = structuredClone(prev);
      // Find the chat in any stage to get current values
      let currentChat: Chat | null = null;
      let currentStageKey: string | null = null;
      for (const [stageKey, chats] of Object.entries(draft)) {
        const found = chats.find((c: Chat) => c.id === chatId);
        if (found) {
          currentChat = found;
          currentStageKey = stageKey;
          break;
        }
      }
      
      // se mudou stage_id, remover da coluna antiga e p?r na nova
      if (partial.stage_id) {
        if (currentStageKey) {
          draft[currentStageKey] = draft[currentStageKey].filter((c: Chat) => c.id !== chatId);
        }
        const updatedChat = currentChat ? { ...currentChat, ...partial } : ({ id: chatId, ...partial } as Chat);
        draft[partial.stage_id] = [...(draft[partial.stage_id] || []), updatedChat];
      } else if (currentStageKey && draft[currentStageKey]) {
        // s? atualiza os campos dentro da coluna atual
        draft[currentStageKey] = draft[currentStageKey].map((c: Chat) => 
          c.id === chatId ? { ...c, ...partial } : c
        );
      }
      return draft;
    });
  }, []);

  const updateChatSnapshots = useCallback((updatedChat: Chat) => {
    const entries = Object.entries(chatsStoreRef.current);
    if (entries.length === 0) return;
    entries.forEach(([key, snapshot]) => {
      const idx = snapshot.items.findIndex((item) => item.id === updatedChat.id);
      if (idx === -1) return;
      const nextItems = [...snapshot.items];
      nextItems[idx] = updatedChat;
      nextItems.sort(
        (a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime(),
      );
      chatsStoreRef.current[key] = {
        ...snapshot,
        items: nextItems,
      };
    });
  }, []);

  // Toggle chat status between 'AI' and 'OPEN'
  const updateChatStatus = useCallback(async (chatId: string, nextStatus: string) => {
    // optimistic update
    const prev = chatsRef.current.find((c) => c.id === chatId) || currentChat || selectedChat || null;
    const prevStatus = (prev as any)?.status ?? null;
    patchChatLocal(chatId, { status: nextStatus } as any);
    try {
      const res = await fetch(`${API}/livechat/chats/${chatId}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || res.statusText || "Falha ao alterar status");
      }
      const data = (await res.json()) as Chat;
      // ensure normalized update across snapshots
      const normalized = normalizeChat(data);
      setCurrentChat((prev) => (prev && prev.id === chatId ? ({ ...prev, status: normalized.status } as Chat) : prev));
      setSelectedChat((prev) => (prev && prev.id === chatId ? ({ ...prev, status: normalized.status } as Chat) : prev));
      setChats((prev) => prev.map((c) => (c.id === chatId ? ({ ...c, status: normalized.status } as Chat) : c)));
      updateChatSnapshots(normalized);
    } catch (error) {
      // rollback
      if (prevStatus) patchChatLocal(chatId, { status: prevStatus } as any);
      console.error("[livechat] updateChatStatus error", error);
    }
  }, [patchChatLocal, normalizeChat, updateChatSnapshots]);


  // Mark chat as read (send read receipts)
  const markChatAsRead = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API}/livechat/chats/${chatId}/mark-read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.warn("[READ_RECEIPTS] mark-read falhou", {
          chatId,
          error: json?.error || res.statusText,
        });
        return;
      }
      await res.json().catch(() => ({}));
      patchChatLocal(chatId, { unread_count: 0 } as any);
    } catch (error) {
      console.error("[READ_RECEIPTS] erro inesperado ao marcar como lida", {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [patchChatLocal]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => (chatScope === "groups" ? isGroupChat(chat) : !isGroupChat(chat)));
  }, [chats, chatScope, isGroupChat]);

  const chatListItems = useMemo<ChatListItem[]>(() => {
    return filteredChats.map((chat) => {
      const normalizedType = (chat.last_message_type || "").toUpperCase();
      const mediaLabel = chat.last_message_media_url
        ? MEDIA_PREVIEW_LABELS[normalizedType] ?? MEDIA_PREVIEW_LABELS.DOCUMENT
        : null;
      const isGroup = isGroupChat(chat);
      const lastMessageText = mediaLabel
        ? mediaLabel
        : chat.last_message
          ? `${chat.last_message_from === "AGENT" ? "Voc?: " : ""}${chat.last_message}`
          : null;
      const displayName = (chat.display_name && chat.display_name.trim())
        ? chat.display_name.trim()
        : isGroup
          ? chat.group_name || sanitizeRemoteIdentifier(chat.display_remote_id || chat.remote_id || chat.external_id) || chat.id
          : chat.customer_name || chat.display_phone || sanitizeRemoteIdentifier(chat.display_remote_id || chat.remote_id || chat.external_id) || chat.id;
      const photoUrl = isGroup
        ? chat.group_avatar_url || (chat as any)?.photo_url || null
        : (chat as any)?.photo_url ?? (chat as any)?.customer_photo_url ?? null;

      return {
        ...(chat as ChatListItem),
        id: chat.id,
        name: displayName,
        last_message: lastMessageText,
        last_message_at: chat.last_message_at ?? chat.created_at ?? null,
        photo_url: photoUrl,
        isGroup,
        group_size: chat.group_size ?? null,
        unread_count: chat.unread_count ?? 0,
      };
    });
  }, [filteredChats, isGroupChat]);

  useEffect(() => {
    chatsTotalRef.current = chatsTotal;
  }, [chatsTotal]);

  useEffect(() => {
    hasMoreChatsRef.current = hasMoreChats;
  }, [hasMoreChats]);

  // Fetch current user data on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = getAccessToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);
        const response = await fetch(`${API}/settings/users/me`, {
          headers,
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser({
            id: data.id,
            name: data.name || data.email || "Usu�rio",
            avatar: data.avatar || null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };
    fetchCurrentUser();
  }, [API]);


  // Contacts state






  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  useEffect(() => {
    if (!currentChat) {
      const first = filteredChats[0] ?? null;
      if (first) {
        setCurrentChat(first);
        setSelectedChat(first);
      }
      return;
    }
    const currentMatches = chatScope === "groups" ? isGroupChat(currentChat) : !isGroupChat(currentChat);
    if (!currentMatches) {
      const fallback = filteredChats[0] ?? null;
      setCurrentChat(fallback);
      setSelectedChat(fallback);
    }
  }, [chatScope, filteredChats, currentChat, isGroupChat]);


  // lista de etapas (colunas do Kanban)

  const [stagesList, setStagesList] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [chatsByStage, setChatsByStage] = useState<Record<string, Chat[]>>({});
  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const token = getAccessToken();
    const headers = new Headers(init?.headers || {});
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (res.status === 401) {
        navigate("/login");
        throw new Error("Unauthorized");
      }
      throw new Error((payload as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    const loadDepartments = async () => {
      setDepartmentsLoading(true);
      try {
        const rows = await fetchJson<Array<{ id: string; name: string; color?: string | null; icon?: string | null }>>(
          `${API}/api/departments`,
        );
        if (cancelled) return;
        const formatted = Array.isArray(rows)
          ? rows.map((row) => ({
              id: row.id,
              name: row.name ?? "Sem nome",
              color: row.color ?? null,
              icon: row.icon ?? null,
            }))
          : [];
        setDepartments(formatted);
      } catch (error) {
        if (!cancelled) setDepartments([]);
      } finally {
        if (!cancelled) setDepartmentsLoading(false);
      }
    };
    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [API, departmentsRefreshKey, fetchJson]);




  const uniqueIds = (ids: string[] | undefined | null): string[] => {
    if (!ids) return [];
    return Array.from(new Set(ids.filter(Boolean)));
  };


  useEffect(() => {
    let cancelled = false;
    const loadStages = async () => {
      try {
        const board = await fetchJson<{ id: string }>(`${API}/kanban/my-board`);
        const boardId = (board as any)?.id;
        if (!boardId) {
          if (!cancelled) setStagesList([]);
          return;
        }
        const columns = await fetchJson<Array<{ id: string; name: string; color?: string | null }>>(
          `${API}/kanban/boards/${boardId}/columns`,
        );
        if (!cancelled) {
          const items = Array.isArray(columns)
            ? columns.map((col) => ({ id: col.id, name: col.name, color: (col as any)?.color ?? null }))
            : [];
          setStagesList(items);
        }
      } catch {
        if (!cancelled) setStagesList([]);
      }
    };
    loadStages();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch { }
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { }
    };
  }, []);



  // debounce simples
  function useDebounced<T>(value: T, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const t = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
  }
  const debouncedQ = useDebounced(q, 300);

  // [KANBAN-BACKEND] mudar etapa (coluna)

  // Descobre e cacheia o board padro desta empresa
  const boardIdRef = useRef<string | null>(null);

  async function getMyBoardId() {
    if (boardIdRef.current) return boardIdRef.current;
    const res = await fetch(`${API}/kanban/my-board`, { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Falha ao carregar board");
    boardIdRef.current = json.id as string;
    return boardIdRef.current!;
  }


  const handleChangeStage = async (stageId: string) => {
    if (!selectedChat?.id) return;

    const chatId = selectedChat.id;
    const prevStageId = (selectedChat as any)?.stage_id ?? null;
    const prevStageName = (selectedChat as any)?.stage_name ?? null;
    const nextStageName = stagesList.find((st) => st.id === stageId)?.name ?? null;

    // ===== Optimistic UI =====
    patchChatLocal(chatId, { stage_id: stageId, stage_name: nextStageName } as any);
    setCurrentChat((prev) =>
      prev && prev.id === chatId ? { ...prev, stage_id: stageId, stage_name: nextStageName } : prev,
    );
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, stage_id: stageId, stage_name: nextStageName } : c)),
    );

    try {
      // 1) board padro
      const boardId = await getMyBoardId();

      // 2) dados do cliente/lead para localizar (ou criar) o card
      const leadId =
        (selectedChat as any)?.lead_id ??
        (selectedChat as any)?.leadId ??
        selectedChat.customer_id ?? // FALLBACK: usa customer_id se n�o tiver lead_id
        null;

      console.log('[livechat] handleChangeStage', {
        chatId,
        stageId,
        leadId,
        customer_id: selectedChat.customer_id,
        lead_id_from_chat: (selectedChat as any)?.lead_id,
      });

      const email =
        (selectedChat as any)?.customer_email ??
        (selectedChat as any)?.email ??
        null;

      const phone =
        (selectedChat as any)?.customer_phone ??
        (selectedChat as any)?.phone ??
        (selectedChat as any)?.cellphone ??
        (selectedChat as any)?.celular ??
        null;

      const title =
        (selectedChat as any)?.customer_name ??
        (selectedChat as any)?.title ??
        phone ??
        `Chat ${String(chatId).slice(0, 8)}`;

      // 3) garante card e move etapa no Kanban
      const payload = {
        boardId,
        columnId: stageId,
        title,
        leadId,
        email,
        phone,
        // Opcional: manda observao do modal se voc tiver ela aqui
        // note: noteDraft,
      };

      console.log('[livechat] Payload enviado para /kanban/cards/ensure:', payload);

      const res = await fetch(`${API}/kanban/cards/ensure`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Falha ao garantir/mover card no Kanban");
      }

      // opcional: json = { cardId, created, updated }
      // voc pode guardar o cardId no chat se for til

    } catch (error) {
      // ===== Rollback do optimistic UI =====
      patchChatLocal(chatId, { stage_id: prevStageId, stage_name: prevStageName } as any);
      setCurrentChat((prev) =>
        prev && prev.id === chatId ? { ...prev, stage_id: prevStageId, stage_name: prevStageName } : prev,
      );
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, stage_id: prevStageId, stage_name: prevStageName } : c)),
      );
      throw error;
    }
  };

  // [KANBAN-BACKEND] atualizar observa??o
  const handleUpdateNote = async (note: string) => {
    if (!selectedChat?.id) return;
    const chatId = selectedChat.id;
    const prevNote = selectedChat.note ?? "";
    patchChatLocal(chatId, { note } as any);
    setCurrentChat((prev) =>
      prev && prev.id === chatId ? { ...prev, note } : prev,
    );
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, note } : c)),
    );
    try {
      const res = await fetch(`${API}/livechat/chats/${chatId}/note`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        patchChatLocal(chatId, { note: prevNote } as any);
        setCurrentChat((prev) =>
          prev && prev.id === chatId ? { ...prev, note: prevNote } : prev,
        );
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, note: prevNote } : c)),
        );
        throw new Error((await res.text()) || "Falha ao atualizar observacao");
      }
    } catch (error) {
      patchChatLocal(chatId, { note: prevNote } as any);
      setCurrentChat((prev) =>
        prev && prev.id === chatId ? { ...prev, note: prevNote } : prev,
      );
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, note: prevNote } : c)),
      );
      throw error;
    }
  };
  useEffect(() => {
    if (!currentChat) {
      const prevChatId = currentChatIdRef.current;
      if (prevChatId) {
        socketRef.current?.emit("leave", { chatId: prevChatId });
      }
      setSelectedChat(null);
      currentChatIdRef.current = null;
      return;
    }
    
    // Check if chat changed before updating ref
    const isNewChat = currentChat?.id && currentChatIdRef.current !== currentChat.id;
    
    if (isNewChat) {
      socketRef.current?.emit("join", { chatId: currentChat.id });
      
      // Mark chat as read when opening it
      markChatAsRead(currentChat.id);
      
      // Update ref AFTER calling markChatAsRead
      currentChatIdRef.current = currentChat.id;
    }
    
    setSelectedChat((prev) => {
      if (prev && prev.id === currentChat.id) {
        return {
          ...prev,
          ...currentChat,
          stage_id: prev.stage_id ?? currentChat.stage_id ?? null,
          stage_name: (prev as any)?.stage_name ?? (currentChat as any)?.stage_name ?? null,
          note: prev.note ?? currentChat.note ?? null,
        };
      }
      return {
        ...currentChat,
        stage_id: currentChat.stage_id ?? null,
        stage_name: (currentChat as any)?.stage_name ?? null,
        note: currentChat.note ?? null,
      };
    });
  }, [currentChat, markChatAsRead]);
  useEffect(() => {
    if (!currentChat?.id) {
      return;
    }
    let cancelled = false;
    const loadKanban = async () => {
      try {
        const payload = await fetchJson<{
          stage_id: string | null;
          stage_name?: string | null;
          note: string | null;
          columns?: Array<{ id: string; name: string; color?: string | null; position?: number | null }>;
        }>(`${API}/livechat/chats/${currentChat.id}/kanban`);
        if (cancelled) return;
        const columnItems = Array.isArray(payload?.columns)
          ? payload.columns.map((col) => ({
            id: col.id,
            name: col.name,
            color: col.color ?? null,
          }))
          : [];
        setStagesList(columnItems);
        const stageFromPayload = payload?.stage_id ?? null;
        const stageNameFromPayload = payload?.stage_name ?? null;
        const noteFromPayload = payload?.note ?? null;
        setSelectedChat((prev) =>
          prev && prev.id === currentChat.id
            ? {
              ...prev,
              stage_id: stageFromPayload,
              stage_name: stageNameFromPayload ?? (prev as any)?.stage_name ?? null,
              note: noteFromPayload ?? null,
            }
            : prev,
        );
        setCurrentChat((prev) =>
          prev && prev.id === currentChat.id
            ? {
              ...prev,
              stage_id: stageFromPayload ?? prev.stage_id ?? null,
              stage_name: stageNameFromPayload ?? (prev as any)?.stage_name ?? null,
              note: noteFromPayload ?? prev.note ?? null,
            }
            : prev,
        );
        setChats((prev) =>
          prev.map((c) =>
            c.id === currentChat.id
              ? {
                ...c,
                stage_id: stageFromPayload ?? c.stage_id ?? null,
                stage_name: stageNameFromPayload ?? (c as any)?.stage_name ?? null,
                note: noteFromPayload ?? c.note ?? null,
              }
              : c,
          ),
        );
      } catch {
        if (!cancelled) setStagesList([]);
      }
    };
    loadKanban();
    return () => {
      cancelled = true;
    };
  }, [currentChat?.id]);

  // helper: empurra o chat pro topo com base no update
const bumpChatToTop = useCallback((update: {
  chatId: string;
  inboxId?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_from?: "CUSTOMER" | "AGENT";
  last_message_type?: string | null;
  last_message_media_url?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  remote_id?: string | null;
  kind?: string | null;
  status?: string;
  unread_count?: number | null;
  department_id?: string | null;
  department_name?: string | null;
  department_color?: string | null;
  department_icon?: string | null;
}) => {
  setChats((prev) => {
    const arr = [...prev];
    const idx = arr.findIndex((c) => c.id === update.chatId);
    
    // Se chat não existe, criar novo chat
    if (idx === -1) {
      console.log('[livechat] 🆕 New chat received via socket:', { chatId: update.chatId, customer_name: update.customer_name });
      const newChat: Chat = normalizeChat({
        id: update.chatId,
        inbox_id: update.inboxId ?? null,
        customer_id: null,
        external_id: null,
        kind: update.kind ?? null,
        group_name: update.group_name ?? null,
        group_avatar_url: update.group_avatar_url ?? null,
        remote_id: update.remote_id ?? null,
        status: update.status ?? "ACTIVE",
        last_message: update.last_message ?? null,
        last_message_at: update.last_message_at ?? new Date().toISOString(),
        last_message_from: update.last_message_from ?? null,
        last_message_type: update.last_message_type ?? null,
        last_message_media_url: update.last_message_media_url ?? null,
        unread_count: update.unread_count ?? 1,
        created_at: new Date().toISOString(),
        customer_name: update.customer_name ?? null,
        customer_phone: update.customer_phone ?? null,
        ai_agent_id: (update as any).ai_agent_id ?? null,
        ai_agent_name: (update as any).ai_agent_name ?? null,
        department_id: update.department_id ?? null,
        department_name: update.department_name ?? null,
        department_color: update.department_color ?? null,
        department_icon: update.department_icon ?? null,
      } as any);
      
      // Adiciona no início da lista
      return [newChat, ...arr];
    }

    const current = arr[idx];
    const mergedRaw = {
      ...current,
      last_message: update.last_message ?? current.last_message ?? null,
      last_message_at: update.last_message_at ?? current.last_message_at ?? current.created_at ?? null,
      last_message_from: update.last_message_from ?? current.last_message_from ?? null,
      last_message_type: Object.prototype.hasOwnProperty.call(update, "last_message_type")
        ? update.last_message_type ?? current.last_message_type ?? null
        : current.last_message_type ?? null,
      last_message_media_url: Object.prototype.hasOwnProperty.call(update, "last_message_media_url")
        ? update.last_message_media_url ?? current.last_message_media_url ?? null
        : current.last_message_media_url ?? null,
      customer_name: Object.prototype.hasOwnProperty.call(update, "customer_name")
        ? update.customer_name ?? current.customer_name ?? null
        : current.customer_name ?? null,
      customer_phone: Object.prototype.hasOwnProperty.call(update, "customer_phone")
        ? update.customer_phone ?? current.customer_phone ?? null
        : current.customer_phone ?? null,
      group_name: Object.prototype.hasOwnProperty.call(update, "group_name")
        ? update.group_name ?? current.group_name ?? null
        : current.group_name ?? null,
      group_avatar_url: Object.prototype.hasOwnProperty.call(update, "group_avatar_url")
        ? update.group_avatar_url ?? current.group_avatar_url ?? null
        : current.group_avatar_url ?? null,
      remote_id: Object.prototype.hasOwnProperty.call(update, "remote_id")
        ? update.remote_id ?? current.remote_id ?? null
        : current.remote_id ?? null,
      kind: update.kind ?? current.kind ?? null,
      status: update.status ?? current.status,
        ai_agent_id: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_id")
          ? (update as any).ai_agent_id ?? (current as any)?.ai_agent_id ?? null
          : (current as any)?.ai_agent_id ?? null,
        ai_agent_name: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_name")
          ? (update as any).ai_agent_name ?? (current as any)?.ai_agent_name ?? null
          : (current as any)?.ai_agent_name ?? null,
      unread_count: Object.prototype.hasOwnProperty.call(update, "unread_count")
        ? update.unread_count ?? current.unread_count ?? 0
        : current.unread_count ?? 0,
      department_id: Object.prototype.hasOwnProperty.call(update, "department_id")
        ? update.department_id ?? current.department_id ?? null
        : current.department_id ?? null,
      department_name: Object.prototype.hasOwnProperty.call(update, "department_name")
        ? update.department_name ?? current.department_name ?? null
        : current.department_name ?? null,
      department_color: Object.prototype.hasOwnProperty.call(update, "department_color")
        ? update.department_color ?? current.department_color ?? null
        : current.department_color ?? null,
      department_icon: Object.prototype.hasOwnProperty.call(update, "department_icon")
        ? update.department_icon ?? current.department_icon ?? null
        : current.department_icon ?? null,
    } as Chat;

    const normalized = normalizeChat(mergedRaw);
    arr[idx] = normalized;
    arr.sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
    updateChatSnapshots(normalized);
    return arr;
  });

  setSelectedChat((prev) => {
    if (prev && prev.id === update.chatId) {
      return normalizeChat({ ...prev, ...update });
    }
    return prev;
  });
}, [normalizeChat, updateChatSnapshots]);

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {

      try {
        const rows = await fetchJson<Tag[]>(`${API}/livechat/tags`);
        if (!cancelled) setAllTags(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setAllTags([]);
      }
    };
    loadTags();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    if (currentChat?.id) s.emit("join", { chatId: currentChat.id });
    return () => {
      if (currentChat?.id) s.emit("leave", { chatId: currentChat.id });
    };
  }, [currentChat?.id]);


  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const onTags = (payload: any) => {
      const cid = currentChatIdRef.current;
      if (cid && payload?.chatId === cid && Array.isArray(payload?.tags)) {
        setChatTags(payload.tags);
      }
      
      // Also update the chat in the list
      if (payload?.chatId && Array.isArray(payload?.tags)) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === payload.chatId
              ? { ...c, tag_ids: payload.tags }
              : c
          )
        );
      }
    };
    s.on("chat:tags", onTags);
    return () => {
      s.off("chat:tags", onTags);
    };
  }, []);

  // Contacts live inside the Livechat page now (no route navigation)

  // Load contacts (paged)





const scrollToBottom = useCallback(
  (behavior: ScrollBehavior = "smooth") => {
    const scroll = () => {
      bottomRef.current?.scrollIntoView({
        behavior,
        block: "end",
      });
    };
    requestAnimationFrame(scroll);
    setTimeout(scroll, 0);
  },
  [bottomRef],
);

  const generateDraftId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const sortMessagesAsc = (list: Message[]) => {
    return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const normalizeMessage = useCallback((raw: any): Message => {
    if (!raw) return raw as Message;
    
    const deliveryStatus =
      typeof raw?.delivery_status === "string" && raw.delivery_status
        ? raw.delivery_status.toUpperCase()
        : typeof raw?.view_status === "string" && raw.view_status
          ? raw.view_status.toUpperCase()
          : null;
    const clientDraftId =
      typeof raw?.client_draft_id === "string" && raw.client_draft_id
        ? raw.client_draft_id
        : typeof raw?.draftId === "string" && raw.draftId
          ? raw.draftId
          : typeof raw?.draft_id === "string" && raw.draft_id
            ? raw.draft_id
            : null;
    
    // Ensure sender_type is set correctly
    // If missing or invalid, derive from is_from_customer
    let senderType = raw.sender_type;
    if (!senderType || (senderType !== "AGENT" && senderType !== "CUSTOMER")) {
      // Map boolean is_from_customer to string sender_type
      if (typeof raw.is_from_customer === "boolean") {
        senderType = raw.is_from_customer ? "CUSTOMER" : "AGENT";
      } else if (typeof raw.is_from_customer === "string") {
        senderType = raw.is_from_customer;
      } else {
        senderType = "CUSTOMER"; // Default fallback
      }
    }
    
    const normalized = {
      ...raw,
      sender_type: senderType,
      media_url: raw.media_url ?? null,
      type: raw.type ?? "TEXT",
      remote_participant_id: raw.remote_participant_id ?? null,
      remote_sender_id: raw.remote_sender_id ?? null,
      remote_sender_name: raw.remote_sender_name ?? null,
      remote_sender_phone: raw.remote_sender_phone ?? null,
      remote_sender_avatar_url: raw.remote_sender_avatar_url ?? null,
      remote_sender_is_admin:
        typeof raw.remote_sender_is_admin === "boolean" ? raw.remote_sender_is_admin : null,
      replied_message_id: raw.replied_message_id ?? null,
      delivery_status: deliveryStatus,
      client_draft_id: clientDraftId,
      error_reason: raw?.error_reason ?? null,
      view_status:
        typeof raw?.view_status === "string" && raw.view_status
          ? raw.view_status.toUpperCase()
          : deliveryStatus,
    } as Message;
    
    return normalized;
  }, []);

  const normalizeMessagesList = useCallback((list: any[]): Message[] => list.map((item) => normalizeMessage(item)), [normalizeMessage]);

  const trackMessageLatency = useCallback((messageId: string | null | undefined, startedAt: number) => {
    if (typeof messageId !== "string" || !messageId.trim()) return;
    messageLatencyRef.current.set(messageId, startedAt);
  }, []);

  const logSendLatency = useCallback(
    (chatId: string | null | undefined, messageId: string | null | undefined, status?: string | null) => {
      if (typeof messageId !== "string" || !messageId) return;
      const startedAt = messageLatencyRef.current.get(messageId);
      if (startedAt == null) return;
      messageLatencyRef.current.delete(messageId);
      const durationMs = Number((performance.now() - startedAt).toFixed(1));
      // metrics log removed
    },
    [],
  );

  const mergeMessagesAscending = (current: Message[], incoming: Message[]) => {
    if (!incoming.length) return sortMessagesAsc(current);
    const map = new Map<string, Message>();
    for (const item of current) map.set(item.id, item);
    for (const item of incoming) map.set(item.id, item);
    return sortMessagesAsc(Array.from(map.values()));
  };

  const appendMessageToCache = useCallback(
    (msg: Message) => {
      const normalized = normalizeMessage(msg);
      const chatId = normalized.chat_id;
      const existing = messagesCache.get(chatId) ?? [];
      
      // Find existing message by ID, client_draft_id, or external_id (for draft replacement)
      const index = existing.findIndex(
        (item) =>
          item.id === normalized.id ||
          (normalized.client_draft_id && item.client_draft_id === normalized.client_draft_id) ||
          ((normalized as any).external_id && (item as any).external_id === (normalized as any).external_id && item.id?.startsWith('draft-')),
      );
      
      let updated: Message[];
      if (index >= 0) {
        const previous = existing[index];
        // Preserve replied_message_id if normalized doesn't have it but previous does
        // Also preserve sender_type if previous is a draft with correct sender_type
        const merged = { 
          ...previous, 
          ...normalized,
          // Don't overwrite replied_message_id with null/undefined if previous had a value
          replied_message_id: normalized.replied_message_id ?? previous.replied_message_id ?? null,
          // Preserve sender_type from draft if normalized doesn't have it or if it's wrong
          sender_type: normalized.sender_type || previous.sender_type || "CUSTOMER",
        };
        const clone = [...existing];
        clone[index] = merged;
        if (
          normalized.client_draft_id &&
          (normalized.id !== previous.id || previous.client_draft_id === normalized.client_draft_id)
        ) {
          draftsRef.current.delete(normalized.client_draft_id);
        } else if (!normalized.client_draft_id && previous.client_draft_id) {
          draftsRef.current.delete(previous.client_draft_id);
        }
        updated = sortMessagesAsc(clone);
      } else {
        updated = sortMessagesAsc([...existing, normalized]);
      }
      messagesCache.set(chatId, updated);
      if (currentChatIdRef.current === chatId) {
        setMessages(updated);
        scrollToBottom();
      }
    },
    [normalizeMessage, scrollToBottom, setMessages, messagesCache],
  );

  const updateMessageStatusInCache = useCallback(
    (payload: {
      chatId?: string | null;
      messageId?: string | null;
      draftId?: string | null;
      view_status?: string | null;
      delivery_status?: string | null;
      error_reason?: string | null;
      merge?: Partial<Message>;
    }) => {
      if (!payload?.chatId) return;
      const cached = messagesCache.get(payload.chatId) ?? [];
      if (cached.length === 0) return;

      const normalizedView =
        typeof payload.view_status === "string" && payload.view_status
          ? payload.view_status.toUpperCase()
          : undefined;
      const normalizedDelivery =
        typeof payload.delivery_status === "string" && payload.delivery_status
          ? payload.delivery_status.toUpperCase()
          : undefined;

      let changed = false;
      const next = cached.map((msg) => {
        const matches =
          (payload.messageId && msg.id === payload.messageId) ||
          (payload.draftId &&
            (msg.id === payload.draftId || msg.client_draft_id === payload.draftId));
        if (!matches) return msg;

        const updated: Message = { ...msg };
        if (normalizedView !== undefined && updated.view_status !== normalizedView) {
          updated.view_status = normalizedView;
          changed = true;
        }
        if (normalizedDelivery !== undefined && updated.delivery_status !== normalizedDelivery) {
          updated.delivery_status = normalizedDelivery;
          changed = true;
        }
        if (payload.error_reason !== undefined && updated.error_reason !== payload.error_reason) {
          updated.error_reason = payload.error_reason ?? null;
          changed = true;
        }
        if (payload.merge) {
          Object.assign(updated, payload.merge);
          changed = true;
        }
        return updated;
      });
      if (!changed) return;
      const updatedList = sortMessagesAsc(next);
      messagesCache.set(payload.chatId, updatedList);
      if (currentChatIdRef.current === payload.chatId) {
        setMessages(updatedList);
      }
    },
    [messagesCache, setMessages],
  );

  const removeMessageFromCache = useCallback(
    (chatId: string, messageId: string) => {
      const cached = messagesCache.get(chatId) ?? [];
      if (cached.length === 0) return;
      const filtered = cached.filter(
        (msg) => msg.id !== messageId && msg.client_draft_id !== messageId,
      );
      if (filtered.length === cached.length) return;
      messagesCache.set(chatId, filtered);
      if (currentChatIdRef.current === chatId) {
        setMessages(filtered);
      }
    },
    [messagesCache, setMessages],
  );

  const replaceDraftWithMessage = useCallback(
    (draftId: string, message: Partial<Message> & { id: string; chat_id?: string }) => {
      const stored = draftsRef.current.get(draftId);
      const chatId = message.chat_id ?? stored?.chatId ?? null;
      if (!chatId) return;
      draftsRef.current.delete(draftId);

      const normalized = normalizeMessage({
        ...message,
        chat_id: chatId,
        delivery_status: (message.delivery_status ?? "SENT") as string,
        view_status: message.view_status ?? "SENT",
        client_draft_id: draftId,
        error_reason: null,
      });

      const cached = messagesCache.get(chatId) ?? [];
      const filtered = cached.filter(
        (msg) =>
          msg.id !== draftId &&
          msg.client_draft_id !== draftId &&
          msg.id !== normalized.id,
      );
      const updated = sortMessagesAsc([...filtered, normalized]);
      messagesCache.set(chatId, updated);
      if (currentChatIdRef.current === chatId) {
        setMessages(updated);
      }
    },
    [normalizeMessage, messagesCache, setMessages],
  );

  const markDraftAsError = useCallback(
    (draftId: string, chatId?: string | null, reason?: string | null) => {
      const stored = draftsRef.current.get(draftId);
      const effectiveChatId = chatId ?? stored?.chatId ?? null;
      if (!effectiveChatId) return;
      if (!stored) {
        draftsRef.current.set(draftId, {
          chatId: effectiveChatId,
          content: "",
          type: "TEXT",
          createdAt: new Date().toISOString(),
        });
      }
      updateMessageStatusInCache({
        chatId: effectiveChatId,
        draftId,
        view_status: "ERROR",
        delivery_status: "ERROR",
        error_reason: reason ?? "Falha ao enviar",
      });
    },
    [updateMessageStatusInCache],
  );

  const createDraftMessage = useCallback(
    (chat: Chat, content: string, quotedMessage?: Message | null, type: string = "TEXT") => {
      const draftId = generateDraftId();
      const createdAt = new Date().toISOString();
      draftsRef.current.set(draftId, {
        chatId: chat.id,
        content,
        type,
        createdAt,
      });
      appendMessageToCache({
        id: draftId,
        chat_id: chat.id,
        body: content,
        content,
        sender_type: "AGENT",
        sender_id: currentUser?.id || null,
        sender_name: currentUser?.name || null,
        sender_avatar_url: currentUser?.avatar || null,
        created_at: createdAt,
        view_status: "SENDING",
        delivery_status: "SENDING",
        type,
        is_private: false,
        client_draft_id: draftId,
        error_reason: null,
        replied_message_id: quotedMessage?.id || null, // Add replied message ID
      } as Message);
      return { draftId, createdAt };
    },
    [appendMessageToCache, currentUser],
  );

  useEffect(() => {
    const s = io(API, { withCredentials: true });
    socketRef.current = s;

    s.on("connect", () => {
      console.log("[Socket] Connected");
      setSocketReady(true);
    });

    s.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setSocketReady(false);
    });

    const onMessageNew = (m: Message) => {
      appendMessageToCache(m);
      logSendLatency(m.chat_id ?? null, m.id ?? null, m.view_status ?? null);
      
      // Bump chat to top quando receber mensagem nova
      bumpChatToTop({
        chatId: m.chat_id,
        last_message: m.body ?? (m.media_url ? "[MEDIA]" : ""),
        last_message_at: m.created_at,
        last_message_from: (m.sender_type === "CUSTOMER" || m.sender_type === "AGENT") ? m.sender_type : undefined,
        last_message_type: m.type ?? null,
        last_message_media_url: m.media_url ?? null,
        group_name: Object.prototype.hasOwnProperty.call(m, "group_name") ? (m as any).group_name ?? null : undefined,
        group_avatar_url: Object.prototype.hasOwnProperty.call(m, "group_avatar_url")
          ? (m as any).group_avatar_url ?? null
          : undefined,
        remote_id: Object.prototype.hasOwnProperty.call(m, "remote_id") ? (m as any).remote_id ?? null : undefined,
        kind: Object.prototype.hasOwnProperty.call(m, "kind") ? (m as any).kind ?? null : undefined,
        unread_count: Object.prototype.hasOwnProperty.call(m, "unread_count") 
          ? (m as any).unread_count ?? undefined
          : undefined,
      });
    };

    const onMessageStatus = (payload: any) => {
      const chatId = payload?.chatId ?? payload?.chat_id ?? null;
      const messageId = payload?.messageId ?? payload?.message_id ?? null;
      const draftId = payload?.draftId ?? payload?.draft_id ?? null;
      const statusValue =
        payload?.status ??
        payload?.delivery_status ??
        payload?.view_status ??
        payload?.raw_status ??
        null;
      const reason = payload?.reason ?? payload?.error ?? null;
      updateMessageStatusInCache({
        chatId,
        messageId,
        draftId,
        view_status: payload?.view_status ?? statusValue ?? null,
        delivery_status: statusValue ?? null,
        error_reason: reason ?? null,
      });
      if (draftId) {
        logSendLatency(chatId ?? null, draftId, statusValue ?? null);
      } else {
        logSendLatency(chatId ?? null, messageId ?? null, statusValue ?? null);
      }
    };

    const onChatUpdated = (p: any) => {
      bumpChatToTop({
        chatId: p.chatId,
        last_message: p.last_message ?? null,
        last_message_at: p.last_message_at ?? null,
        last_message_from: p.last_message_from ?? undefined,
        last_message_type: Object.prototype.hasOwnProperty.call(p, "last_message_type")
          ? p.last_message_type ?? null
          : undefined,
        last_message_media_url: Object.prototype.hasOwnProperty.call(p, "last_message_media_url")
          ? p.last_message_media_url ?? null
          : undefined,
        customer_name: Object.prototype.hasOwnProperty.call(p, "customer_name") ? p.customer_name ?? null : undefined,
        customer_phone: Object.prototype.hasOwnProperty.call(p, "customer_phone") ? p.customer_phone ?? null : undefined,
        group_name: Object.prototype.hasOwnProperty.call(p, "group_name") ? p.group_name ?? null : undefined,
        group_avatar_url: Object.prototype.hasOwnProperty.call(p, "group_avatar_url")
          ? p.group_avatar_url ?? null
          : undefined,
        remote_id: Object.prototype.hasOwnProperty.call(p, "remote_id") ? p.remote_id ?? null : undefined,
        kind: Object.prototype.hasOwnProperty.call(p, "kind") ? p.kind ?? null : undefined,
        status: p.status ?? undefined,
        unread_count: Object.prototype.hasOwnProperty.call(p, "unread_count") 
          ? p.unread_count ?? undefined
          : undefined,
        department_id: Object.prototype.hasOwnProperty.call(p, "department_id")
          ? p.department_id ?? null
          : undefined,
        department_name: Object.prototype.hasOwnProperty.call(p, "department_name")
          ? p.department_name ?? null
          : undefined,
        department_color: Object.prototype.hasOwnProperty.call(p, "department_color")
          ? p.department_color ?? null
          : undefined,
        department_icon: Object.prototype.hasOwnProperty.call(p, "department_icon")
          ? p.department_icon ?? null
          : undefined,
      });
    };

    // Listener para atualiza��o de m�dia em background
    const onMediaReady = (payload: any) => {
      if (!payload?.messageId || !payload?.media_url) return;
      console.log('[livechat] Media ready:', payload);
      
      // Atualiza mensagem no cache incluindo caption
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { 
                ...msg, 
                media_url: payload.media_url, 
                media_storage_path: payload.media_storage_path,
                caption: payload.caption ?? msg.caption,
              }
            : msg
        )
      );
    };

    // Listener para mudan�a de agente de IA
    const onAgentChanged = (payload: any) => {
      if (payload.chatId) {
        bumpChatToTop({
          chatId: payload.chatId,
          ai_agent_id: payload.ai_agent_id,
          ai_agent_name: payload.ai_agent_name,
        } as any);
      }
    };

    const onDepartmentChanged = (payload: any) => {
      const chatId = payload?.chatId ?? payload?.chat_id ?? null;
      if (!chatId) return;
      const nextDepartmentId = payload?.department_id ?? null;
      const nextUpdate = {
        chatId,
        department_id: nextDepartmentId,
        department_name: payload?.department_name ?? null,
        department_color: payload?.department_color ?? null,
        department_icon: payload?.department_icon ?? null,
      } as any;

      bumpChatToTop(nextUpdate);
      setCurrentChat((prev) => (prev && prev.id === chatId ? ({ ...prev, ...nextUpdate } as Chat) : prev));
      setSelectedChat((prev) => (prev && prev.id === chatId ? ({ ...prev, ...nextUpdate } as Chat) : prev));
      setChats((prev) => {
        const exists = prev.some((chat) => chat.id === chatId);
        if (!exists) return prev;
        if (selectedDepartmentId && nextDepartmentId !== selectedDepartmentId) {
          return prev.filter((chat) => chat.id !== chatId);
        }
        return prev.map((chat) => (chat.id === chatId ? ({ ...chat, ...nextUpdate } as Chat) : chat));
      });
      if (selectedDepartmentId && nextDepartmentId !== selectedDepartmentId) {
        setChatsTotal((prev) => Math.max(0, prev - 1));
        if (currentChatIdRef.current === chatId) {
          setCurrentChat(null);
          setSelectedChat(null);
        }
      }
      setDepartmentsRefreshKey((prev) => prev + 1);
      setDepartmentError(null);
    };

    // Listener para envio de mensagens interativas (botões)
    const onInteractiveMessage = async (payload: any) => {
      console.log("[SOCKET] Received send:interactive_message", payload);
      
      const { chatId, message, buttons, footer, agentId } = payload;
      
      if (!chatId || !message || !Array.isArray(buttons) || buttons.length === 0) {
        console.error("[SOCKET] Invalid interactive message payload", payload);
        return;
      }

      // Buscar chat para obter inbox_id e customer_phone
      const chat = chatsRef.current.find((c) => c.id === chatId);
      if (!chat) {
        console.error("[SOCKET] Chat not found for interactive message", { chatId });
        return;
      }

      const inbox = inboxes.find((i) => i.id === chat.inbox_id);
      const isMetaCloud = inbox?.provider?.toUpperCase() === "META_CLOUD";

      if (!isMetaCloud) {
        console.error("[SOCKET] Interactive buttons only work with META_CLOUD provider", {
          chatId,
          provider: inbox?.provider,
        });
        return;
      }

      try {
        // Criar draft otimista usando crypto.randomUUID se disponível
        const draftId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" 
          ? crypto.randomUUID() 
          : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const createdAt = new Date().toISOString();
        
        const displayMessage = `${message}\n\n${buttons.map((b: any) => `• ${b.title}`).join('\n')}`;
        
        const draft = {
          id: draftId,
          chat_id: chatId,
          content: displayMessage,
          type: "INTERACTIVE",
          is_from_customer: false,
          created_at: createdAt,
          view_status: "sending",
          sender_id: null,
          sender_name: "Agente IA",
          media_url: null,
        };

        appendMessageToCache(draft as any);

        // Enviar via API do backend
        const response = await fetchJson<any>(`${API}/api/meta/send-interactive-buttons`, {
          method: "POST",
          body: JSON.stringify({
            inboxId: chat.inbox_id,
            chatId: chat.id,
            customerPhone: chat.customer_phone,
            message,
            buttons,
            footer: footer || undefined,
          }),
        });

        console.log("[SOCKET] Interactive message sent successfully", {
          chatId,
          wamid: response.wamid,
          buttonsCount: buttons.length,
        });

        // Atualizar status do draft
        updateMessageStatusInCache({
          chatId,
          draftId,
          view_status: "sent",
          delivery_status: "sent",
          merge: { view_status: "sent" },
        });
      } catch (error: any) {
        console.error("[SOCKET] Failed to send interactive message", error);
        alert(`Erro ao enviar botões: ${error.message || "Erro desconhecido"}`);
      }
    };

    s.on("message:new", onMessageNew);
    s.on("message:inbound", onMessageNew);  // Tamb�m trata como message:new
    s.on("message:outbound", onMessageNew); // Tamb�m trata como message:new
    s.on("message:status", onMessageStatus);
    s.on("chat:updated", onChatUpdated);
    s.on("message:media-ready", onMediaReady);
    s.on("chat:agent-changed", onAgentChanged);
    s.on("chat:department-changed", onDepartmentChanged);
    s.on("send:interactive_message", onInteractiveMessage);

    return () => {
      s.off("message:new", onMessageNew);
      s.off("message:inbound", onMessageNew);
      s.off("message:outbound", onMessageNew);
      s.off("message:status", onMessageStatus);
      s.off("chat:updated", onChatUpdated);
      s.off("message:media-ready", onMediaReady);
      s.off("chat:agent-changed", onAgentChanged);
      s.off("chat:department-changed", onDepartmentChanged);
      s.off("send:interactive_message", onInteractiveMessage);
      s.disconnect();
    };
  }, [
    appendMessageToCache,
    updateMessageStatusInCache,
    bumpChatToTop,
    logSendLatency,
    selectedDepartmentId,
  ]);

  const loadChats = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      const activeKindParam = chatScope === "groups" ? "GROUP" : "DIRECT";
      const statusKey = status && status !== "ALL" ? status : "ALL";
      const inboxKey = inboxId || "*";
      const searchKey = debouncedQ.trim();
      const departmentKey = selectedDepartmentId || "*";
      const cacheKey = JSON.stringify({
        inbox: inboxKey,
        status: statusKey,
        kind: activeKindParam,
        q: searchKey || "",
        department: departmentKey,
        limit: PAGE_SIZE,
      });

      const metaEntry = chatsCacheMetaRef.current[cacheKey];
      const effectiveReset = reset || currentChatsKeyRef.current !== cacheKey;

      if (effectiveReset) {
        try {
          chatsAbortRef.current?.abort();
        } catch {}
        chatsAbortRef.current = new AbortController();
        chatsOffsetRef.current = 0;
      } else if (isChatsLoadingRef.current) {
        return { items: chatsRef.current, total: chatsTotalRef.current };
      }

      const myReqId = ++chatsReqIdRef.current;
      const controller = effectiveReset ? chatsAbortRef.current! : new AbortController();
      const previousOffsetValue = chatsOffsetRef.current;
      const previousHasMoreValue = hasMoreChatsRef.current;

      isChatsLoadingRef.current = true;
      setIsChatsLoading(true);

      const offset = effectiveReset ? 0 : chatsOffsetRef.current;
      const params: any = {
        limit: PAGE_SIZE,
        offset,
        q: searchKey || undefined,
        status,
        inboxId: inboxId || undefined,
        kind: activeKindParam,
        departmentId: selectedDepartmentId || undefined,
      };

      const applyResult = (items: Chat[], total: number) => {
        const normalizedItems = normalizeChats(items);
        let nextList = normalizedItems;
        console.debug("[livechat] applyResult", {
          cacheKey,
          rawCount: items?.length ?? 0,
          normalizedCount: normalizedItems.length,
          total,
          effectiveReset,
        });

        if (myReqId !== chatsReqIdRef.current) {
          console.debug("[livechat] applyResult aborted (stale req)", { myReqId, currentReqId: chatsReqIdRef.current });
          return { items: chatsRef.current, total: chatsTotalRef.current };
        }

        setChats((prev) => {
          if (effectiveReset) {
            nextList = [...normalizedItems].sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
            console.debug("[livechat] setChats(reset)", { nextCount: nextList.length });
            return nextList;
          }
          const map = new Map<string, Chat>();
          for (const c of prev) map.set(c.id, c);
          for (const c of normalizedItems) map.set(c.id, c);
          nextList = Array.from(map.values());
          nextList.sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
          console.debug("[livechat] setChats(merge)", { prevCount: prev.length, nextCount: nextList.length });
          return nextList;
        });

        const baseOffset = effectiveReset ? 0 : offset;
        const nextOffset = baseOffset + normalizedItems.length;
        chatsOffsetRef.current = nextOffset;

        setChatsTotal(total ?? nextList.length);
        const more = total != null
          ? nextOffset < total && normalizedItems.length === PAGE_SIZE
          : normalizedItems.length === PAGE_SIZE;
        setHasMoreChats(more);

        chatsStoreRef.current[cacheKey] = {
          items: nextList,
          total: total ?? nextList.length,
          offset: chatsOffsetRef.current,
          hasMore: more,
        };
        currentChatsKeyRef.current = cacheKey;
        console.debug("[livechat] store updated", {
          cacheKey,
          storedCount: nextList.length,
          total: total ?? nextList.length,
          hasMore: more,
          offset: chatsOffsetRef.current,
        });

        return { items: nextList, total };
      };

      try {
        const s = socketRef.current;
        if (s?.connected) {
          const ack = await new Promise<{ items: Chat[]; total: number } | null>((resolve) => {
            let settled = false;
            const timer = window.setTimeout(() => {
              if (!settled) resolve(null);
            }, 2000);
            s.emit("livechat:chats:list", params, (resp: any) => {
              settled = true;
              window.clearTimeout(timer);
              if (!resp?.ok) return resolve(null);
              resolve({
                items: (resp.items || []) as Chat[],
                total: (resp.total ?? (resp.items || []).length) as number,
              });
            });
          });
          if (ack) {
            if (effectiveReset) currentChatsKeyRef.current = cacheKey;
            return applyResult(ack.items || [], ack.total || 0);
          }
        }

        const qs = new URLSearchParams();
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.offset) qs.set("offset", String(params.offset));
        if (params.q) qs.set("q", String(params.q));
        if (params.status && params.status !== "ALL") qs.set("status", String(params.status));
        if (params.inboxId) qs.set("inboxId", String(params.inboxId));
        if (params.kind) qs.set("kind", String(params.kind));
        if (params.departmentId) qs.set("department_id", String(params.departmentId));

        const headers = new Headers();
        headers.set("Accept", "application/json");
        const token = getAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
        if (offset === 0 && metaEntry?.etag) {
          headers.set("If-None-Match", metaEntry.etag);
        }
        if (offset === 0 && metaEntry?.lastModified) {
          headers.set("If-Modified-Since", metaEntry.lastModified);
        }

        const url = `${API}/livechat/chats?${qs.toString()}`;
        console.debug("[livechat] fetch chats init", { url, headers });
        const response = await fetch(url, {
          method: "GET",
          headers,
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        console.debug("[livechat] fetch chats response", { status: response.status, url });

        if (response.status === 304) {
          if (offset === 0) {
            const etagHeader = response.headers.get("ETag");
            const lastModHeader = response.headers.get("Last-Modified");
            if (etagHeader || lastModHeader) {
              chatsCacheMetaRef.current[cacheKey] = {
                etag: etagHeader || metaEntry?.etag || null,
                lastModified: lastModHeader || metaEntry?.lastModified || null,
              };
            }
          }
          if (effectiveReset) {
            const snapshot = chatsStoreRef.current[cacheKey];
            if (snapshot) {
              console.debug("[livechat] using snapshot after 304", { cacheKey, count: snapshot.items.length });
              setChats(snapshot.items);
              setChatsTotal(snapshot.total);
              setHasMoreChats(snapshot.hasMore);
              chatsOffsetRef.current = snapshot.offset;
              currentChatsKeyRef.current = cacheKey;
            } else {
              console.debug("[livechat] 304 without snapshot, retrying", { cacheKey });
              const retryHeaders = new Headers(headers);
              retryHeaders.delete("If-None-Match");
              retryHeaders.delete("If-Modified-Since");
              retryHeaders.set("Cache-Control", "no-cache");

              const retryResponse = await fetch(url, {
                method: "GET",
                headers: retryHeaders,
                credentials: "include",
                cache: "no-store",
              });
              console.debug("[livechat] retry response", { status: retryResponse.status });

              if (retryResponse.status === 401) {
                navigate("/login");
                throw new Error("Unauthorized");
              }

              if (!retryResponse.ok) {
                let retryPayload: any = null;
                try {
                  retryPayload = await retryResponse.json();
                } catch {
                  retryPayload = null;
                }
                const retryMessage = retryPayload?.error || `HTTP ${retryResponse.status}`;
                throw new Error(retryMessage);
              }

              const retryData = (await retryResponse.json()) as { items: Chat[]; total: number };
              const retryEtag = retryResponse.headers.get("ETag");
              const retryLastMod = retryResponse.headers.get("Last-Modified");
              chatsCacheMetaRef.current[cacheKey] = {
                etag: retryEtag || null,
                lastModified: retryLastMod || null,
              };
              currentChatsKeyRef.current = cacheKey;
              console.debug("[livechat] retry apply result", { items: retryData.items?.length ?? 0, total: retryData.total });
              return applyResult(retryData.items || [], retryData.total ?? 0);
            }
          }
          return { items: chatsRef.current, total: chatsTotalRef.current };
        }

        if (response.status === 401) {
          navigate("/login");
          throw new Error("Unauthorized");
        }

        if (!response.ok) {
          let payload: any = null;
          try {
            payload = await response.json();
          } catch {}
          const message = payload?.error || `HTTP ${response.status}`;
          throw new Error(message);
        }

        const data = (await response.json()) as { items: Chat[]; total: number };
        console.debug("[livechat] fetch chats ok", { items: data.items?.length ?? 0, total: data.total });
        const etagHeader = response.headers.get("ETag");
        const lastModHeader = response.headers.get("Last-Modified");
        chatsCacheMetaRef.current[cacheKey] = {
          etag: etagHeader || null,
          lastModified: lastModHeader || null,
        };

        if (effectiveReset) currentChatsKeyRef.current = cacheKey;

        return applyResult(data.items || [], data.total ?? 0);
      } catch (error: any) {
        console.error("[livechat] loadChats error", error);
        if (error?.name === "AbortError") {
          return { items: chatsRef.current, total: chatsTotalRef.current };
        }
        console.error("Falha ao carregar chats", error);
        if (myReqId === chatsReqIdRef.current) {
          chatsOffsetRef.current = previousOffsetValue;
          setHasMoreChats(previousHasMoreValue);
        }
        return { items: chatsRef.current, total: chatsTotalRef.current };
      } finally {
        if (myReqId === chatsReqIdRef.current) {
          isChatsLoadingRef.current = false;
          setIsChatsLoading(false);
        }
      }
    },
    [API, debouncedQ, status, inboxId, selectedDepartmentId, PAGE_SIZE, normalizeChats, navigate, chatScope],
  );

  const loadMessages = useCallback(
    async (chatId: string, options: { reset?: boolean; before?: string | null } = {}) => {
      const { reset = false, before = null } = options;
      const requestId = Symbol(`messages-${chatId}-${reset ? "reset" : "more"}`);
      messagesRequestRef.current = requestId;

      if (reset) {
        messagesMetaRef.current[chatId] = { nextBefore: null, hasMore: true };
      }

      const meta = messagesMetaRef.current[chatId];
      const effectiveBefore = reset ? null : (before ?? meta?.nextBefore ?? null);

      if (!reset) {
        if (meta && !meta.hasMore) {
          if (currentChatIdRef.current === chatId) {
            setMessagesHasMore(false);
          }
          if (messagesRequestRef.current === requestId) {
            messagesRequestRef.current = null;
          }
          return false;
        }
        if (!effectiveBefore) {
          if (currentChatIdRef.current === chatId && meta) {
            setMessagesHasMore(meta.hasMore);
          }
          if (messagesRequestRef.current === requestId) {
            messagesRequestRef.current = null;
          }
          return false;
        }
      }

      const params = new URLSearchParams();
      params.set("limit", String(MESSAGES_PAGE_SIZE));
      if (effectiveBefore) params.set("before", effectiveBefore);

      try {
        const res = await fetch(`${API}/livechat/chats/${chatId}/messages?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        });
        const headerBefore = res.headers.get("X-Next-Before");
        const textBody = await res.text();
        
        let payload: any = [];
        if (textBody) {
          try {
            payload = JSON.parse(textBody);
          } catch {
            payload = [];
          }
        }

        if (!res.ok) {
          if (res.status === 401) {
            navigate("/login");
            throw new Error("Unauthorized");
          }
          throw new Error((payload as any)?.error || `HTTP ${res.status}`);
        }

        const rawItems = Array.isArray(payload) ? (payload as Message[]) : [];
        const normalizedList = sortMessagesAsc(normalizeMessagesList(rawItems));

        const fallbackCursor = normalizedList.length > 0 ? normalizedList[0].created_at : null;
        const headerCursor = headerBefore && headerBefore.trim() !== "" ? headerBefore : null;
        const hasMore = (
          headerBefore != null
            ? headerBefore.trim() !== ""
            : normalizedList.length >= MESSAGES_PAGE_SIZE
        );
        const nextBefore = hasMore ? (headerCursor ?? fallbackCursor) : null;

        const existing = messagesCache.get(chatId) ?? [];
        const prevCount = existing.length;
        const combined = reset ? normalizedList : mergeMessagesAscending(existing, normalizedList);
        messagesCache.set(chatId, combined);
        messagesMetaRef.current[chatId] = { nextBefore, hasMore };

        const isLatest = messagesRequestRef.current === requestId;
        if (isLatest && currentChatIdRef.current === chatId) {
          setMessages(combined);
          setMessagesHasMore(hasMore);
          if (reset) {
            scrollToBottom();
          }
        }
        if (isLatest) {
          messagesRequestRef.current = null;
        }

        return reset ? combined.length > 0 : combined.length > prevCount;
      } catch (error) {
        if (messagesRequestRef.current === requestId) {
          messagesRequestRef.current = null;
        }
        throw error;
      }
    },
    [API, navigate, scrollToBottom, setMessagesHasMore, normalizeMessagesList, messagesCache],
  );



  const handleSelectChat = useCallback(
    (chatId: string) => {
      const target =
        chatsRef.current.find((item) => item.id === chatId) ?? chats.find((item) => item.id === chatId);
      if (!target) return;
      setCurrentChat(target);
    },
    [chats],
  );

  const handleChatsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasMoreChats || isChatsLoadingRef.current) return;
      const target = event.currentTarget;
      const distanceToBottom = target.scrollHeight - (target.scrollTop + target.clientHeight);
      if (distanceToBottom <= 80) {
        loadChats().catch(() => { });
      }
    },
    [hasMoreChats, loadChats],
  );

  const handleMessagesScroll = useCallback(
    async (event: UIEvent<HTMLDivElement>) => {
      const chatId = currentChatIdRef.current;
      if (!chatId) return;
      if (messagesLoading) return;
      if (!messagesHasMore) return;
      if (isPrependingMessagesRef.current) return;

      const target = event.currentTarget;
      if (target.scrollTop > 40) return;

      const meta = messagesMetaRef.current[chatId];
      const beforeCursor = meta?.nextBefore;
      if (!beforeCursor) {
        setMessagesHasMore(meta?.hasMore ?? false);
        return;
      }

      isPrependingMessagesRef.current = true;
      setIsFetchingOlderMessages(true);

      const previousHeight = target.scrollHeight;
      const previousScrollTop = target.scrollTop;

      try {
        const appended = await loadMessages(chatId, { before: beforeCursor });
        requestAnimationFrame(() => {
          const container = messagesContainerRef.current;
          if (!container) return;
          const newHeight = container.scrollHeight;
          const heightDiff = newHeight - previousHeight;
          container.scrollTop = previousScrollTop + heightDiff;
        });
        if (!appended) {
          const metaAfter = messagesMetaRef.current[chatId];
          if (metaAfter) {
            setMessagesHasMore(metaAfter.hasMore);
          }
        }
      } catch (error) {
        console.error("Falha ao carregar mensagens antigas", error);
      } finally {
        setIsFetchingOlderMessages(false);
        isPrependingMessagesRef.current = false;
      }
    },
    [loadMessages, messagesHasMore, messagesLoading],
  );


  const handleChangeDepartment = useCallback(
    async (departmentId: string | null) => {
      if (!currentChat?.id) return;
      const chatId = currentChat.id;
      if ((currentChat.department_id ?? null) === (departmentId ?? null)) {
        return;
      }
      setDepartmentError(null);
      setIsDepartmentChanging(true);
      try {
        const payload = await fetchJson<Chat>(`${API}/livechat/chats/${chatId}/department`, {
          method: "PUT",
          body: JSON.stringify({ department_id: departmentId ?? null }),
        });
        const normalized = normalizeChat(payload);
        const willRemove = Boolean(selectedDepartmentId && normalized.department_id !== selectedDepartmentId);

        setCurrentChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          return willRemove ? null : normalized;
        });
        setSelectedChat((prev) => {
          if (!prev || prev.id !== chatId) return prev;
          return willRemove ? null : normalized;
        });
        setChats((prev) =>
          willRemove
            ? prev.filter((chat) => chat.id !== chatId)
            : prev.map((chat) => (chat.id === chatId ? normalized : chat)),
        );

        if (willRemove) {
          setChatsTotal((prev) => Math.max(0, prev - 1));
          if (currentChatIdRef.current === chatId) {
            currentChatIdRef.current = null;
          }
        } else {
          updateChatSnapshots(normalized);
          bumpChatToTop({
            chatId,
            department_id: normalized.department_id ?? null,
            department_name: normalized.department_name ?? null,
            department_color: normalized.department_color ?? null,
            department_icon: normalized.department_icon ?? null,
          } as any);
        }

        loadChats({ reset: true }).catch((error) => {
          console.warn("[livechat] reload chats after department change failed", error);
        });

        setDepartmentsRefreshKey((prev) => prev + 1);
        setDepartmentError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao atualizar departamento";
        setDepartmentError(message);
      } finally {
        setIsDepartmentChanging(false);
      }
    },
    [
      API,
      currentChat?.id,
      currentChat?.department_id,
      fetchJson,
      normalizeChat,
      selectedDepartmentId,
      updateChatSnapshots,
      bumpChatToTop,
      loadChats,
    ],
  );

  useEffect(() => {
    const activeKindParam = chatScope === "groups" ? "GROUP" : "DIRECT";
    const statusKey = status && status !== "ALL" ? status : "ALL";
    const inboxKey = inboxId || "*";
    const searchKey = debouncedQ.trim();
    const departmentKey = selectedDepartmentId || "*";
    const cacheKey = JSON.stringify({
      inbox: inboxKey,
      status: statusKey,
      kind: activeKindParam,
      q: searchKey || "",
      department: departmentKey,
      limit: PAGE_SIZE,
    });

    const snapshot = chatsStoreRef.current[cacheKey];
    if (snapshot) {
      currentChatsKeyRef.current = cacheKey;
      setChats(snapshot.items);
      setChatsTotal(snapshot.total);
      setHasMoreChats(snapshot.hasMore);
      chatsOffsetRef.current = snapshot.offset;
    } else {
      currentChatsKeyRef.current = cacheKey;
      setChats([]);
      setChatsTotal(0);
      setHasMoreChats(true);
      chatsOffsetRef.current = 0;
    }

    loadChats({ reset: true }).catch(() => { });
  }, [debouncedQ, status, inboxId, selectedDepartmentId, chatScope, loadChats]);



  useEffect(() => {
    const chatId = currentChat?.id;
    if (!chatId) {
      setMessages([]);
      setMessagesLoading(false);
      setMessagesHasMore(true);
      setIsFetchingOlderMessages(false);
      messagesRequestRef.current = null;
      return;
    }
    
    // CORREÇÃO: Sempre carregar mensagens frescas do servidor ao trocar de chat
    // Não confiar no cache para evitar mensagens desatualizadas
    const cached = messagesCache.get(chatId);
    const hasCache = Array.isArray(cached) && cached.length > 0;
    
    // Mostrar cache apenas se tiver, mas sempre revalidar
    if (hasCache && cached) {
      setMessages(cached);
      scrollToBottom();
    } else {
      setMessages([]);
    }
    
    const meta = messagesMetaRef.current[chatId];
    setMessagesHasMore(meta?.hasMore ?? true);
    setIsFetchingOlderMessages(false);
    let disposed = false;
    
    // Sempre mostrar loading ao trocar de chat para indicar que está revalidando
    setMessagesLoading(true);
    
    loadMessages(chatId, { reset: true })
      .catch(() => { })
      .finally(() => {
        if (disposed) return;
        if (currentChatIdRef.current === chatId) {
          setMessagesLoading(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, [currentChat?.id, loadMessages, messagesCache]);





  useEffect(() => {
    if (!currentChat?.id) {
      setChatTags([]);
      return;
    }

    const s = socketRef.current;
    if (s?.connected) {
      s.emit(
        "livechat:chats:tags:get",
        { chatId: currentChat.id },
        (resp: any) => {
          setChatTags(uniqueIds(resp?.ok ? resp.data || [] : []));
        },
      );
      return;
    }

    fetchJson<string[]>(`${API}/livechat/chats/${currentChat.id}/tags`)
      .then((rows) => {
        setChatTags(uniqueIds(rows));
      })
      .catch(() => {
        setChatTags([]);
      });
  }, [currentChat?.id]);



  // Autoabrir chat por query string ?openChat=<id>



  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get("openChat");
    if (!openId) return;
    const exists = chats.find((c) => c.id === openId);
    if (exists) {
      setCurrentChat(exists);
      return;
    }
    (async () => {
      const resp = await loadChats();
      const item = (resp.items || []).find((c) => c.id === openId);
      if (item) setCurrentChat(item);
    })();
  }, [location.search, chats, loadChats]);


  // Load contacts when contacts section active



  useEffect(() => {
    if (section === "all") setStatus("ALL");
    else if (section === "unanswered") setStatus("OPEN");
    if (section !== "all" && section !== "unanswered") {
      setCurrentChat(null);
      setMessages([]);
      setChatTags([]);
    }
  }, [section]);


  useEffect(() => {
    let cancelled = false;
    const s = socketRef.current;
    const load = () => {
      if (s && s.connected) {
        s.emit("livechat:inboxes:my", (resp: any) => {
          if (cancelled) return;
          setInboxesLoading(false);
          if (resp?.ok) {
            const inboxList = resp.data || [];
            setInboxes(inboxList);
          } else {
            setInboxes([]);
          }
        });
      } else {
        fetchJson<Inbox[]>(`${API}/livechat/inboxes/my`)
          .then((rows) => {
            if (!cancelled) {
              setInboxesLoading(false);
              const inboxList = rows || [];
              setInboxes(inboxList);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setInboxesLoading(false);
              setInboxes([]);
            }
          });
      }
    };

    load();
    const onConnect = () => load();
    s?.on("connect", onConnect);
    return () => {
      cancelled = true;
      s?.off("connect", onConnect);
    };
  }, []);

  // Check inbox access and wizard
  useEffect(() => {
    if (!socketReady) return;

    let alive = true;
    setIsCheckingWizard(true);
    setAccessCheckError(null);

    (async () => {
      try {
        // First check if user has access to any inbox
        const myInboxesRes = await fetch(`${API}/livechat/inboxes/my`, {
          credentials: "include",
        });
        
        if (!myInboxesRes.ok) {
          if (myInboxesRes.status === 403) {
            const errorData = await myInboxesRes.json().catch(() => ({}));
            if (alive) {
              setHasInboxAccess(false);
              setAccessCheckError(
                errorData.reason || 
                "Você não tem acesso a nenhuma caixa de entrada. Entre em contato com o administrador."
              );
            }
            return;
          }
          throw new Error("Failed to check inbox access");
        }

        const inboxes = await myInboxesRes.json();
        
        if (alive) {
          if (!inboxes || inboxes.length === 0) {
            setHasInboxAccess(false);
            setAccessCheckError(
              "Você não está vinculado a nenhuma caixa de entrada. Entre em contato com o administrador."
            );
            return;
          }
          
          setHasInboxAccess(true);
          
          // Now check wizard status
          try {
            const wizardRes = await fetch(`${API}/livechat/inboxes/should-show-wizard`, {
              credentials: "include",
            });
            if (wizardRes.ok) {
              const data = await wizardRes.json();
              if (alive) {
                setShowFirstInboxWizard(data.shouldShow || false);
              }
            }
          } catch (wizardError) {
            console.error("Error checking wizard:", wizardError);
          }
        }
      } catch (error) {
        console.error("Error checking inbox access:", error);
        if (alive) {
          setHasInboxAccess(false);
          setAccessCheckError("Erro ao verificar acesso às caixas de entrada.");
        }
      } finally {
        if (alive) setIsCheckingWizard(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [socketReady]);



  const sendMessageToChat = useCallback(
    async (chat: Chat, rawContent: string, replyToMsgId?: string | null) => {
      const trimmed = rawContent.trim();
      if (!trimmed) return;

      const providerId =
        (inboxes.find((inbox) => inbox.id === chat.inbox_id)?.provider || "").toUpperCase();
      const isWaha = providerId === "WAHA";

      // Find the quoted message to include in draft
      const quotedMsg = replyToMsgId ? messages.find(m => m.id === replyToMsgId) : null;

      const { draftId, createdAt } = createDraftMessage(chat, trimmed, quotedMsg);
      const sendStartedAt = performance.now();
      trackMessageLatency(draftId, sendStartedAt);
      bumpChatToTop({
        chatId: chat.id,
        last_message: trimmed,
        last_message_at: createdAt,
        last_message_from: "AGENT",
        last_message_type: "TEXT",
        last_message_media_url: null,
      });
      scrollToBottom();

      if (isWaha) {
        const candidates = [chat.customer_phone, chat.external_id];
        let to = "";
        for (const candidate of candidates) {
          if (typeof candidate !== "string") continue;
          const normalized = candidate.trim();
          if (!normalized) continue;
          if (normalized.includes("@")) {
            to = normalized;
            break;
          }
          const digits = normalized.replace(/\D/g, "");
          if (digits) {
            to = `${digits}@c.us`;
            break;
          }
        }
        if (!to) {
          console.error("Falha ao resolver destinatario WAHA do chat", chat.id);
          markDraftAsError(draftId, chat.id, "Destinat�rio inv�lido");
          logSendLatency(chat.id, draftId, "ERROR");
          return;
        }

        try {
          const response = await fetchJson<any>(`${API}/waha/sendText`, {
            method: "POST",
            body: JSON.stringify({
              inboxId: chat.inbox_id,
              chatId: chat.id,
              to,
              content: trimmed,
              draftId,
              reply_to: replyToMsgId || null,
            }),
          });
          const responseDraftId =
            (response && typeof response === "object" && "draftId" in response
              ? (response as any).draftId
              : null) ?? null;
          if (responseDraftId && responseDraftId !== draftId) {
            const stored = draftsRef.current.get(draftId);
            if (stored) {
              draftsRef.current.set(responseDraftId, stored);
              draftsRef.current.delete(draftId);
            }
            updateMessageStatusInCache({
              chatId: chat.id,
              draftId,
              delivery_status: "SENT",
              view_status: "SENT",
              error_reason: null,
              merge: { client_draft_id: responseDraftId },
            });
          } else {
            updateMessageStatusInCache({
              chatId: chat.id,
              draftId,
              delivery_status: "SENT",
              view_status: "SENT",
              error_reason: null,
            });
          }
          logSendLatency(chat.id, draftId, "SENT");
        } catch (error: any) {
          const reason = error instanceof Error ? error.message : "Falha ao enviar mensagem";
          markDraftAsError(draftId, chat.id, reason);
          logSendLatency(chat.id, draftId, "ERROR");
          console.error("Falha ao enviar mensagem (WAHA)", error);
        }
        return;
      }

      try {
        const token = getAccessToken();
        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        if (token) headers.set("Authorization", `Bearer ${token}`);
        const response = await fetch(`${API}/livechat/messages`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ 
            chatId: chat.id, 
            text: trimmed, 
            senderType: "AGENT", 
            draftId,
            reply_to: replyToMsgId || null,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          const err = new Error(payload?.error || `HTTP ${response.status}`);
          (err as any).draftId = payload?.draftId ?? draftId;
          throw err;
        }
        const inserted = (payload?.data ?? payload) as any;
        replaceDraftWithMessage(draftId, {
          ...inserted,
          chat_id: inserted?.chat_id ?? chat.id,
          delivery_status: "SENT",
          view_status: inserted?.view_status ?? "SENT",
        });
        logSendLatency(chat.id, draftId, "SENT");
      } catch (error: any) {
        const reason = error instanceof Error ? error.message : "Falha ao enviar mensagem";
        const failedDraftId =
          typeof (error as any)?.draftId === "string" ? (error as any).draftId : draftId;
        markDraftAsError(failedDraftId, chat.id, reason);
        logSendLatency(chat.id, draftId, "ERROR");
        console.error("Falha ao enviar mensagem", error);
      }
    },
    [
      API,
      inboxes,
      createDraftMessage,
      trackMessageLatency,
      bumpChatToTop,
      scrollToBottom,
      markDraftAsError,
      updateMessageStatusInCache,
      replaceDraftWithMessage,
      logSendLatency,
    ],
  );

  const send = useCallback(async () => {
    if (!currentChat) return;
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const replyId = replyingTo?.id || null;
    setText("");
    setReplyingTo(null);
    await sendMessageToChat(currentChat, trimmedText, replyId);
  }, [currentChat, text, replyingTo, sendMessageToChat]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  }, []);

  const retryFailedMessage = useCallback(
    async (message: Message) => {
      const draftKey = message.client_draft_id || message.id;
      const stored = draftsRef.current.get(draftKey);
      const chatId = message.chat_id;
      if (!chatId) return;
      const chat =
        (currentChat && currentChat.id === chatId ? currentChat : chatsRef.current.find((c) => c.id === chatId)) ||
        null;
      if (!chat || !stored || !stored.content.trim()) return;
      removeMessageFromCache(chatId, message.id);
      draftsRef.current.delete(draftKey);
      await sendMessageToChat(chat, stored.content);
    },
    [currentChat, removeMessageFromCache, sendMessageToChat],
  );

  const handleEditMessage = useCallback(
    async (
      message: Message,
      data: { text: string; linkPreview?: boolean; linkPreviewHighQuality?: boolean },
    ) => {
      if (!currentChat?.id) return;
      const chatId = currentChat.id;
      // optimistic UI update
      updateMessageStatusInCache({
        chatId,
        messageId: message.id,
        merge: { content: data.text, body: data.text, view_status: "Edited" as any },
      });
      try {
        await fetchJson<{ ok: boolean; data?: any }>(
          `${API}/livechat/chats/${chatId}/messages/${message.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ text: data.text, linkPreview: data.linkPreview ?? true, linkPreviewHighQuality: data.linkPreviewHighQuality ?? false }),
          },
        );
      } catch (e) {
        console.error("Falha ao editar mensagem", e);
        // Soft revert marker
        updateMessageStatusInCache({ chatId, messageId: message.id, merge: { view_status: message.view_status || null } });
        alert("Falha ao editar mensagem");
      }
    },
    [API, currentChat?.id, updateMessageStatusInCache],
  );

  const handleDeleteMessage = useCallback(
    async (message: Message) => {
      if (!currentChat?.id) return;
      const chatId = currentChat.id;
      if (!confirm("Apagar esta mensagem para todos?")) return;
      // optimistic UI update
      const prev = { content: message.content, body: message.body, view_status: message.view_status } as any;
      updateMessageStatusInCache({ chatId, messageId: message.id, merge: { content: "", body: "", view_status: "Deleted" as any } });
      try {
        await fetchJson<{ ok: boolean; data?: any }>(
          `${API}/livechat/chats/${chatId}/messages/${message.id}`,
          { method: "DELETE" },
        );
      } catch (e) {
        console.error("Falha ao apagar mensagem", e);
        // revert
        updateMessageStatusInCache({ chatId, messageId: message.id, merge: prev });
        alert("Falha ao apagar mensagem");
      }
    },
    [API, currentChat?.id, updateMessageStatusInCache],
  );



  const uploadFile = async (file: File) => {
    if (!currentChat) return;
    // Derive message type from file
    const mt = (file.type || "").toLowerCase();
    const type = mt.startsWith("image/")
      ? "IMAGE"
      : mt.startsWith("video/")
        ? "VIDEO"
        : mt.startsWith("audio/")
          ? "AUDIO"
          : "DOCUMENT";

    const quotedMsg = replyingTo;

    // Create optimistic draft with preview URL
    const previewUrl = URL.createObjectURL(file);
    const { draftId } = createDraftMessage(currentChat, file.name, quotedMsg || undefined, type);
    updateMessageStatusInCache({
      chatId: currentChat.id,
      draftId,
      delivery_status: "SENDING",
      view_status: "SENDING",
      merge: { media_url: previewUrl, upload_progress: 0, type },
    });

    // Prepare formData
    const formData = new FormData();
    formData.set("file", file, file.name);
    if (replyingTo?.id) {
      formData.set("reply_to", replyingTo.id);
    }

    try {
      const xhr = new XMLHttpRequest();
      const url = `${API}/livechat/chats/${currentChat.id}/messages/media`;
      xhr.open("POST", url, true);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        updateMessageStatusInCache({
          chatId: currentChat.id,
          draftId,
          merge: { upload_progress: pct },
        });
      };
      const done = await new Promise<{ ok: boolean; payload: any }>((resolve) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            try {
              const text = xhr.responseText || "{}";
              const json = JSON.parse(text);
              resolve({ ok: xhr.status >= 200 && xhr.status < 300, payload: json });
            } catch {
              resolve({ ok: xhr.status >= 200 && xhr.status < 300, payload: null });
            }
          }
        };
        xhr.send(formData);
      });

      const payload = done.payload || {};
      const inserted = (payload?.inserted ?? payload?.data ?? (done.ok ? payload : null)) as any;
      if (!done.ok || !inserted) {
        if ((payload as any)?.error === "mime_not_allowed") {
          alert(`Esse formato (${(payload as any)?.mimetype || "desconhecido"}) nao e suportado pelo WhatsApp. Tente outro navegador (OGG/AAC).`);
        }
        throw new Error((payload as any)?.error || `upload_failed (${xhr.status})`);
      }

      replaceDraftWithMessage(draftId, {
        ...inserted,
        chat_id: inserted.chat_id ?? currentChat.id,
        delivery_status: "SENT",
        view_status: inserted?.view_status ?? "SENT",
      });
      bumpChatToTop({
        chatId: inserted.chat_id ?? currentChat.id,
        last_message: inserted.content ?? file.name,
        last_message_at: inserted.created_at ?? new Date().toISOString(),
        last_message_from: "AGENT",
        last_message_type: inserted.type ?? type,
        last_message_media_url: inserted.media_url ?? null,
      });
      setReplyingTo(null);
      scrollToBottom();
    } catch (err: any) {
      console.error("Falha ao enviar arquivo", err);
      markDraftAsError(draftId, currentChat.id, err?.message || "Falha ao enviar arquivo");
    } finally {
      try { URL.revokeObjectURL(previewUrl); } catch {}
      // clear progress after a moment
      setTimeout(() => {
        updateMessageStatusInCache({ chatId: currentChat.id, draftId, merge: { upload_progress: null } });
      }, 1000);
    }
  };


  const handlePickFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  // substitua sua fun??o por esta
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidates = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const pick = (t: string) => (window as any).MediaRecorder?.isTypeSupported?.(t);
      const mimeType = pick(candidates[0]) ? candidates[0] : pick(candidates[1]) ? candidates[1] : candidates[2];

      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const ext = mimeType.startsWith("audio/ogg") ? "ogg" : (mimeType.includes("webm") ? "webm" : "bin");
          const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mimeType });
          await uploadFile(file);
        } catch (e) {
          console.error("Falha ao enviar audio", e);
          alert("Nao foi possivel enviar o audio. Tente outro navegador (suporte a OGG/AAC).");
        } finally {
          try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
          streamRef.current = null;
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      }, 60_000);
    } catch {
      alert("Permita acesso ao microfone ou tente novamente.");
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
      streamRef.current = null;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
    }
  };




  const addEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    setShowEmoji(false);
  };

  const addTag = useCallback(
    async (tagId: string) => {
      if (!currentChat?.id) return;
      
      // Prevent duplicate requests
      const operationKey = `add-${currentChat.id}-${tagId}`;
      if (tagOperationsRef.current.has(operationKey)) {
        return;
      }
      
      tagOperationsRef.current.add(operationKey);
      
      try {
        await fetchJson(`${API}/livechat/chats/${currentChat.id}/tags`, {
          method: "POST",
          body: JSON.stringify({ tagId }),
        });
      } catch (error: any) {
        // If it's a 409 conflict, the tag already exists - no action needed
        if (error?.status === 409 || error?.message?.includes('409')) {
          return;
        }
        
        console.error("Falha ao adicionar tag", error);
        // Revert optimistic update on error
        setChatTags((prev) => prev.filter(id => id !== tagId));
      } finally {
        tagOperationsRef.current.delete(operationKey);
      }
    },
    [currentChat?.id],
  );


  const removeTag = useCallback(
    async (tagId: string) => {
      if (!currentChat?.id) return;
      
      // Prevent duplicate requests
      const operationKey = `remove-${currentChat.id}-${tagId}`;
      if (tagOperationsRef.current.has(operationKey)) {
        return;
      }
      
      tagOperationsRef.current.add(operationKey);
      
      try {
        await fetchJson(`${API}/livechat/chats/${currentChat.id}/tags/${tagId}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Falha ao remover tag", error);
        // Revert optimistic update on error
        setChatTags((prev) => [...prev, tagId]);
      } finally {
        tagOperationsRef.current.delete(operationKey);
      }
    },
    [currentChat?.id],
  );

  const assignAgent = useCallback(
    async (userId: string | null) => {
      if (!currentChat?.id) return;
      const chatId = currentChat.id;
      const resp = await fetchJson<{
        assigned_agent_id: string | null;
        assigned_agent_name: string | null;
        assigned_agent_user_id?: string | null;
      }>(`${API}/livechat/chats/${chatId}/assignee`, {
        method: "PUT",
        body: JSON.stringify({ userId }),

      });


      setCurrentChat((prev) =>
        prev && prev.id === chatId
          ? {
            ...prev,
            assigned_agent_id: resp?.assigned_agent_id ?? null,
            assigned_agent_name: resp?.assigned_agent_name ?? null,
            assigned_agent_user_id:
              resp?.assigned_agent_user_id ?? userId ?? null,
          }
          : prev,
      );
      setSelectedChat((prev) =>
        prev && prev.id === chatId
          ? {
            ...prev,
            assigned_agent_id: resp?.assigned_agent_id ?? null,
            assigned_agent_name: resp?.assigned_agent_name ?? null,
            assigned_agent_user_id:
              resp?.assigned_agent_user_id ?? userId ?? null,
          }
          : prev,
      );
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
              ...c,
              assigned_agent_id: resp?.assigned_agent_id ?? null,
              assigned_agent_name: resp?.assigned_agent_name ?? null,
              assigned_agent_user_id:
                resp?.assigned_agent_user_id ?? userId ?? null,
            }
            : c,
        ),
      );
    },
    [currentChat?.id],
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      if (!currentChat?.id) return;
      
      // Check current state to decide action
      const isCurrentlySelected = chatTags.includes(tagId);
      
      if (isCurrentlySelected) {
        // Remove tag
        setChatTags((prev) => prev.filter(id => id !== tagId));
        void removeTag(tagId);
      } else {
        // Add tag
        setChatTags((prev) => [...prev, tagId]);
        void addTag(tagId);
      }
    },
    [currentChat?.id, chatTags, addTag, removeTag],
  );


  const sendPrivate = async () => {
    if (!currentChat || !privateText.trim()) return;
    const s = socketRef.current;
    if (s?.connected) {
      s.emit(
        "message:private:send",
        { chatId: currentChat.id, text: privateText.trim() },
        () => { },
      );
    } else {
      await fetchJson<Message>(
        `${API}/livechat/chats/${currentChat.id}/private/messages`,
        {
          method: "POST",
          body: JSON.stringify({ text: privateText.trim() }),
        },
      ).catch(() => { });
    }
    setPrivateText("");
  };


  // Loading state while checking access
  if (isCheckingWizard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // If user has no inbox access, show blocked state
  if (hasInboxAccess === false) {
    return (
      <div className="relative h-screen overflow-hidden">
        {/* Blurred background */}
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 backdrop-blur-xl" style={{ filter: 'blur(8px)' }}>
          <div className="h-full w-full opacity-30">
            <div className="flex h-full">
              <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"></div>
              <div className="flex-1 bg-gray-50 dark:bg-gray-900"></div>
            </div>
          </div>
        </div>
        
        {/* Alert overlay */}
        <div className="relative z-10 flex items-center justify-center h-full px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 p-8">
            <div className="text-center">
              {/* Icon */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Acesso Negado
              </h3>
              
              {/* Message */}
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {accessCheckError || "Você não tem acesso a nenhuma caixa de entrada."}
              </p>
              
              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>O que fazer?</strong><br />
                  Entre em contato com o administrador da sua empresa para solicitar acesso às caixas de entrada do livechat.
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  Recarregar página
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ml-16 min-h-screen transition-colors duration-300"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
        <div className="grid h-[calc(100vh-4rem)] grid-cols-12 gap-4">
          <div className="col-span-2">
            <LivechatMenu section={section} onChange={setSection} />
          </div>

          {(section === "all" || section === "unanswered") && (
            <Card padding="md" className="col-span-4 flex flex-col max-h-screen min-h-0">
              <div className="shrink-0">
                <div className="mb-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-70" />
                    <input
                      className="config-input w-full rounded-lg pl-9 pr-3 py-2 text-sm"
                      placeholder="Buscar conversa ou contato"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <div ref={filtersContainerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((prev) => !prev)}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      style={{
                        backgroundColor: filtersOpen
                          ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                          : "var(--color-surface)",
                        borderColor: filtersOpen
                          ? "color-mix(in srgb, var(--color-primary) 38%, transparent)"
                          : "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)",
                        color: filtersOpen || activeFilterCount > 0
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      }}
                    >
                      <FiFilter size={16} />
                      <span>Filtros</span>
                      {activeFilterCount > 0 && (
                        <span
                          className="min-w-[1.25rem] rounded-full px-1 text-center text-xs font-semibold"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--color-primary) 85%, transparent)",
                            color: "var(--color-on-primary)",
                          }}
                        >
                          {activeFilterCount}
                        </span>
                      )}
                    </button>

                    {filtersOpen && (
                      <div
                        className="absolute right-0 z-40 mt-2 w-64 rounded-lg border shadow-lg"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)",
                          color: "var(--color-text)",
                        }}
                      >
                        <div className="border-b px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--color-surface-muted) 75%, transparent)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide">Filtrar por</span>
                            <button
                              type="button"
                              onClick={() => setFiltersOpen(false)}
                              className="rounded p-1 text-xs hover:opacity-80"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3 px-3 py-3 text-sm">
                          <div>
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">Caixa</span>
                            <select
                              className="config-input w-full rounded-lg px-3 py-2 text-sm"
                              value={inboxId}
                              onChange={(e) => setInboxId(e.target.value)}
                            >
                              <option value="">Todas as caixas</option>
                              {inboxes.map((ib) => (
                                <option key={ib.id} value={ib.id}>
                                  {ib.name} {ib.phone_number ? `(${ib.phone_number})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">Status</span>
                            <select
                              className="config-input w-full rounded-lg px-3 py-2 text-sm"
                              value={status}
                              onChange={(e) => setStatus(e.target.value)}
                            >
                              {FILTER_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">Departamento</span>
                            <div className="relative">
                              <select
                                className="config-input w-full rounded-lg px-3 py-2 text-sm"
                                value={selectedDepartmentId ?? ""}
                                onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
                              >
                                <option value="">Todos os departamentos</option>
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center justify-between gap-2 border-t px-3 py-2"
                          style={{ borderColor: "color-mix(in srgb, var(--color-surface-muted) 75%, transparent)" }}
                        >
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:opacity-80"
                            style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}
                          >
                            Limpar filtros
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltersOpen(false)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor: "var(--color-primary)",
                              color: "var(--color-on-primary)",
                            }}
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChatScope("conversations")}
                    className="px-3 py-1.5 rounded-full text-sm transition-colors border hover:opacity-95"
                    style={{
                      backgroundColor:
                        chatScope === "conversations"
                          ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                          : "var(--color-surface-muted)",
                      color:
                        chatScope === "conversations"
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      borderColor:
                        chatScope === "conversations"
                          ? "color-mix(in srgb, var(--color-primary) 45%, transparent)"
                          : "transparent",
                    }}
                  >
                    Conversas
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatScope("groups")}
                    className="px-3 py-1.5 rounded-full text-sm transition-colors border hover:opacity-95"
                    style={{
                      backgroundColor:
                        chatScope === "groups"
                          ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                          : "var(--color-surface-muted)",
                      color:
                        chatScope === "groups"
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      borderColor:
                        chatScope === "groups"
                          ? "color-mix(in srgb, var(--color-primary) 45%, transparent)"
                          : "transparent",
                    }}
                  >
                    Grupos
                  </button>
                </div>
              </div>

              <div
                ref={chatsListRef}
                onScroll={handleChatsScroll}
                className="
              flex-1 min-h-0 overflow-y-auto divide-y-0
              scrollbar-thin scrollbar-track-transparent
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_12%,var(--color-bg))]
              hover:[&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_22%,var(--color-bg))]
            "
              >
                {chatListItems.length === 0 ? (
                  <div className="p-3 text-sm theme-text-muted">
                    {isChatsLoading
                      ? "Carregando chats..."
                      : chatScope === "groups"
                        ? "Nenhum grupo"
                        : "Nenhuma conversa"}
                  </div>
                ) : (
                  <ChatList
                    chats={chatListItems}
                    activeChatId={currentChat?.id}
                    onSelectChat={handleSelectChat}
                    isGroupList={chatScope === "groups"}
                    inboxes={inboxes}
                    tags={allTags}
                  />
                )}

                {chatListItems.length > 0 && isChatsLoading && (
                  <div className="p-3 text-xs theme-text-muted text-center">Carregando chats...</div>
                )}
                {chatListItems.length > 0 && !hasMoreChats && !isChatsLoading && (
                  <div className="p-3 text-xs theme-text-muted opacity-60 text-center">
                    {chatScope === "groups" ? "N?o h? mais grupos." : "N?o h? mais conversas."}
                  </div>
                )}
              </div>
            </Card>
          )}


          {(section === "all" || section === "unanswered") && (
            <Card padding="md" className="col-span-6 flex flex-col relative min-h-screen max-h-screen">
              <ChatHeader
                apiBase={API}
                chat={currentChat}
                inboxId={currentChat?.inbox_id ?? null}
                departments={departments}
                departmentsLoading={departmentsLoading}
                selectedDepartmentId={currentChat?.department_id ?? null}
                onChangeDepartment={handleChangeDepartment}
                isDepartmentChanging={isDepartmentChanging}
                departmentError={departmentError}
                tags={allTags}
                selectedTagIds={chatTags}
                assigneeUserId={currentChat?.assigned_agent_user_id ?? null}
                assigneeName={currentChat?.assigned_agent_name ?? null}
                onToggleTag={toggleTag}
                onAssignAgent={assignAgent}
                funnelStages={stagesList}
                currentStageId={selectedChat?.stage_id ?? (null as any)}
                currentStageName={(selectedChat as any)?.stage_name ?? null}
                currentNote={(selectedChat?.note ?? "") as any}
                onChangeStage={handleChangeStage}
                onUpdateNote={handleUpdateNote}
                currentStatus={(currentChat?.status ?? null) as any}
                statusOptions={CHAT_STATUS_OPTIONS}
                onChangeStatus={(next) => { if (currentChat) return updateChatStatus(currentChat.id, next); }}
              />


              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-auto space-y-1.5 pr-1
              scrollbar-thin scrollbar-track-transparent
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_12%,var(--color-bg))]
              hover:[&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_22%,var(--color-bg))]
            "
              >
                {isFetchingOlderMessages && (
                  <div className="py-2 text-center text-xs theme-text-muted">
                    Carregando mensagens anteriores...
                  </div>
                )}
                {!isFetchingOlderMessages && !messagesHasMore && messages.length > 0 && (
                  <div className="py-2 text-center text-xs theme-text-muted opacity-70">
                    N?o h? mais mensagens no hist?rico.
                  </div>
                )}
                {messagesLoading && (
                  <div className="py-4 text-center text-sm theme-text-muted">Carregando mensagens...</div>
                )}

                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    isAgent={m.sender_type === "AGENT"}
                    mediaItems={mediaItems}
                    mediaIndex={mediaIndexById.get(m.id) ?? undefined}
                    showRemoteSenderInfo={currentChat ? isGroupChat(currentChat) : false}
                    onRetry={retryFailedMessage}
                    onReply={() => setReplyingTo(m)}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    allMessages={messages}
                    customerName={currentChat?.customer_name || currentChat?.display_name || null}
                  />
                ))}

                {!messagesLoading && messages.length === 0 && (
                  <div className="py-4 text-center text-sm theme-text-muted">Nenhuma mensagem.</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsPrivateOpen(true)}
                  >
                    Mensagem privada
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePickFile}
                    title="Enviar anexo"
                    aria-label="Enviar anexo"
                  >
                    <FiPaperclip className="h-5 w-5" />
                  </Button>

                  <Button
                    size="sm"
                    variant={isRecording ? "danger" : "ghost"}
                    onClick={toggleRecording}
                    title="Gravar �udio"
                    aria-label="Gravar �udio"
                  >
                    <FiMic className="w-5 h-5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowEmoji((v) => !v)}
                    title="Emoji"
                    aria-label="Emoji"
                  >
                    <FiSmile className="h-5 w-5" />
                  </Button>
                </div>

                {showEmoji && (
                  <div
                    className="grid w-fit grid-cols-8 gap-1 rounded-lg border p-2 text-xl shadow"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 70%, transparent)",
                    }}
                  >
                    {"????????????????"
                      .split("")
                      .map((e, i) => (
                        <button
                          key={i}
                          className="hover:scale-110 transition"
                          onClick={() => addEmoji(e)}
                        >
                          {e}
                        </button>
                      ))}
                  </div>
                )}

                {replyingTo && (
                  <div className="mb-2">
                    <ReplyPreview 
                      message={{
                        id: replyingTo.id,
                        content: replyingTo.content || '',
                        type: replyingTo.type || 'TEXT',
                        sender_name: replyingTo.sender_name || undefined,
                      }}
                      onCancel={() => setReplyingTo(null)}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    className="config-input flex-1 rounded-lg px-3 py-2 text-sm"
                    placeholder={isRecording ? "Gravando �udio..." : "Digite sua mensagem..."}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    disabled={isRecording}
                  />
                  <Button
                    variant="gradient"
                    size="md"
                    onClick={send}
                    disabled={isRecording}
                  >
                    Enviar
                  </Button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </Card>
          )}

          {section === "labels" && (
            <Card padding="lg" className="col-span-10">
              <LabelsManager apiBase={API} />
            </Card>
          )}

          {section === "contacts" && (
            <div className="col-span-10">
              <ContactsCRM apiBase={API} socket={socketRef.current} />
            </div>
          )}

          {section === "campaigns" && (
            <Card padding="md" className="col-span-10 flex flex-col min-h-screen max-h-screen">
              <CampaignsPanel apiBase={API} />
            </Card>
          )}
        </div>

      {/* Modal de privado */}
        {isPrivateOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
            style={{ backgroundColor: "var(--color-overlay)" }}
          >
            <div
              className="flex max-h-[80vh] w-[min(640px,95vw)] flex-col rounded-2xl border p-4 transition-colors duration-300"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "color-mix(in srgb, var(--color-surface) 98%, transparent)",
                boxShadow: "0 32px 70px -45px rgba(8, 12, 20, 0.95)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold theme-heading">Conversa privada</div>
                <button
                  onClick={() => setIsPrivateOpen(false)}
                  className="rounded p-2 transition hover:opacity-75"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 40%, transparent)" }}
                >
                  <FiX className="h-5 w-5 theme-text-muted" />
                </button>
              </div>

              {currentChat && (
                <div className="mb-2 text-sm theme-text-muted">
                  Agente atribu?do:{" "}
                  <span className="font-medium theme-heading">
                    {currentChat.assigned_agent_name || "?"}
                  </span>
                </div>
              )}

              <div className="mb-3 text-xs theme-text-muted">
                Somente sua equipe v? estas mensagens. Elas tamb?m aparecem no hist?rico do chat, destacadas como privadas.
              </div>

              <div
                className="flex-1 space-y-1.5 overflow-auto rounded-lg border p-2 pr-1
              scrollbar-thin scrollbar-track-transparent
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_12%,var(--color-bg))]
              hover:[&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_22%,var(--color-bg))]
            "
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-bg)",
                }}
              >
                {messages
                  .filter((m) => m.is_private || m.type === "PRIVATE")
                  .map((m) => (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      isAgent={true}
                      mediaItems={mediaItems}
                      mediaIndex={mediaIndexById.get(m.id) ?? undefined}
                      onRetry={retryFailedMessage}
                      allMessages={messages}
                      customerName={currentChat?.customer_name || currentChat?.display_name || null}
                    />
                  ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className="config-input flex-1 rounded-lg px-3 py-2 text-sm"
                  placeholder="Mensagem privada..."
                  value={privateText}
                  onChange={(e) => setPrivateText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendPrivate();
                    }
                  }}
                />
                <Button
                  variant="gradient"
                  size="md"
                  onClick={sendPrivate}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Wizard de primeira inbox */}
      {showFirstInboxWizard && (
        <FirstInboxWizard 
          onComplete={() => {
            console.log("[Livechat] Wizard concluído, recarregando inboxes");
            setShowFirstInboxWizard(false);
            // Recarregar inboxes
            fetchJson<Inbox[]>(`${API}/livechat/inboxes/my`)
              .then((rows) => {
                setInboxes(rows || []);
                if (rows && rows.length > 0) {
                  console.log("[Livechat] Inbox criada com sucesso!");
                }
              })
              .catch((err) => {
                console.error("[Livechat] Erro ao recarregar inboxes:", err);
              });
          }}
          onSkip={() => {
            console.log("[Livechat] Wizard pulado");
            setShowFirstInboxWizard(false);
          }}
        />
      )}
    </div>
  );
}










