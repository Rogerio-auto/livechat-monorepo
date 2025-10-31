﻿import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction, type UIEvent } from "react";
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
import type { Chat, Message, Inbox, Tag, Contact } from "../componets/livechat/types";
import { FiPaperclip, FiMic, FiSmile, FiX } from "react-icons/fi";
import { ContactsCRM } from "../componets/livechat/ContactsCRM";
import CampaignsPanel from "../componets/livechat/CampaignsPanel";
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
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [inboxId, setInboxId] = useState<string>("");
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const chatsTotalRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const messagesCache = useMemo(() => new Map<string, Message[]>(), []);
  const messageLatencyRef = useRef<Map<string, number>>(new Map());
  const messagesRequestRef = useRef<symbol | null>(null);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, string | null>>({});
  const chatsAbortRef = useRef<AbortController | null>(null);
  const chatsCacheMetaRef = useRef<Record<string, { etag: string | null; lastModified: string | null }>>({});
  const chatsStoreRef = useRef<Record<string, { items: Chat[]; total: number; offset: number; hasMore: boolean }>>({});
  const currentChatsKeyRef = useRef<string | null>(null);
  const chatsReqIdRef = useRef(0);

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

    return base as Chat;
  }, []);

  const normalizeChats = useCallback((list: any[]): Chat[] => list.map((item) => normalizeChat(item)), [normalizeChat]);

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
          ? `${chat.last_message_from === "AGENT" ? "Voc�: " : ""}${chat.last_message}`
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
      };
    });
  }, [filteredChats, isGroupChat]);

  useEffect(() => {
    chatsTotalRef.current = chatsTotal;
  }, [chatsTotal]);

  useEffect(() => {
    hasMoreChatsRef.current = hasMoreChats;
  }, [hasMoreChats]);


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
  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
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
  };




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

  // [KANBAN-BACKEND] util para atualizar card localmente



  function patchChatLocal(chatId: string, partial: Partial<Chat>) {
    setSelectedChat((prev) => (prev && prev.id === chatId ? { ...prev, ...partial } : prev));
    setChatsByStage((prev) => {
      const draft = structuredClone(prev);
      // se mudou stage_id, remover da coluna antiga e p?r na nova
      if (partial.stage_id) {
        const oldStage = Object.keys(draft).find(s =>
          (draft[s] || []).some(c => c.id === chatId)
        );
        if (oldStage) draft[oldStage] = draft[oldStage].filter(c => c.id !== chatId);
        draft[partial.stage_id] = [...(draft[partial.stage_id] || []), { ...(selectedChat as Chat), ...partial }];
      } else {
        // s? atualiza os campos dentro da coluna atual

        const stageKey = (selectedChat as any)?.stage_id;
        if (stageKey && draft[stageKey]) {
          draft[stageKey] = draft[stageKey].map(c => c.id === chatId ? { ...c, ...partial } : c);
        }
      }
      return draft;
    });
  }

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
        null;

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
      const res = await fetch(`${API}/kanban/cards/ensure`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          columnId: stageId,
          title,
          leadId,
          email,
          phone,
          // Opcional: manda observao do modal se voc tiver ela aqui
          // note: noteDraft,
        }),
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
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);
  useEffect(() => {
    if (!currentChat) {
      const prevChatId = currentChatIdRef.current;
      if (prevChatId) {
        socketRef.current?.emit("leave", { chatId: prevChatId });
      }
      setSelectedChat(null);
      return;
    }
    if (currentChat?.id && currentChatIdRef.current !== currentChat.id) {
      socketRef.current?.emit("join", { chatId: currentChat.id });
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
  }, [currentChat]);
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
}) => {
  setChats((prev) => {
    const arr = [...prev];
    const idx = arr.findIndex((c) => c.id === update.chatId);
    if (idx === -1) return prev;

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

  setCurrentChat((prev) => {
    if (prev && prev.id === update.chatId) {
      return normalizeChat({ ...prev, ...update });
    }
    return prev;
  });
}, [normalizeChat, updateChatSnapshots]);





  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    // Novo contrato (relay j? emite tamb?m os legados)
    const handleChatUpdated = (u: any) => bumpChatToTop(u);
    const handleMessageActivity = (m: any) => {
      bumpChatToTop({
        chatId: m.chat_id,
        last_message: m.body ?? (m.media_url ? "[MEDIA]" : ""),
        last_message_at: m.created_at,
        last_message_from: m.sender_type,
        last_message_type: m.type ?? null,
        last_message_media_url: m.media_url ?? null,
        group_name: Object.prototype.hasOwnProperty.call(m, "group_name") ? m.group_name ?? null : undefined,
        group_avatar_url: Object.prototype.hasOwnProperty.call(m, "group_avatar_url")
          ? m.group_avatar_url ?? null
          : undefined,
        remote_id: Object.prototype.hasOwnProperty.call(m, "remote_id") ? m.remote_id ?? null : undefined,
        kind: Object.prototype.hasOwnProperty.call(m, "kind") ? m.kind ?? null : undefined,
      });
    };
    const handleMessageStatus = (st: any) => {
      if (!st?.messageId) return;
      setMessageStatuses(prev => ({
        ...prev,
        [st.messageId]: st.view_status ?? st.raw_status ?? null,
      }));
    };

    s.on("chat:updated", handleChatUpdated);
    s.on("message:new", handleMessageActivity);
    // (Opcional) se voc? quiser tratar diferente:
    s.on("message:inbound", handleMessageActivity);
    s.on("message:outbound", handleMessageActivity);
    s.on("message:status", handleMessageStatus);

    return () => {
      s.off("chat:updated", handleChatUpdated);
      s.off("message:new", handleMessageActivity);
      s.off("message:inbound", handleMessageActivity);
      s.off("message:outbound", handleMessageActivity);
      s.off("message:status", handleMessageStatus);
    };
  }, [selectedChat?.id, setMessageStatuses]);





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

  const sortMessagesAsc = (list: Message[]) => {
    return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const normalizeMessage = useCallback((raw: any): Message => {
    if (!raw) return raw as Message;
    return {
      ...raw,
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
    } as Message;
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
      console.log("[metrics][ui]", {
        chatId: chatId ?? null,
        messageId,
        durationMs,
        status: status ?? null,
      });
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
      if (existing.some((item) => item.id === normalized.id)) return;
      const updated = sortMessagesAsc([...existing, normalized]);
      messagesCache.set(chatId, updated);
      if (currentChatIdRef.current === chatId) {
        setMessages(updated);
        scrollToBottom();
      }
    },
    [normalizeMessage, scrollToBottom, setMessages, messagesCache],
  );

  const updateMessageStatusInCache = useCallback(
    (payload: { chatId?: string | null; messageId?: string | null; view_status?: string | null }) => {
      if (!payload?.chatId || !payload?.messageId) return;
      const cached = messagesCache.get(payload.chatId) ?? [];
      if (cached.length === 0) return;
      let changed = false;
      const next = cached.map((msg) => {
        if (msg.id !== payload.messageId) return msg;
        if (msg.view_status === payload.view_status) return msg;
        changed = true;
        return { ...msg, view_status: payload.view_status ?? null };
      });
      if (!changed) return;
      messagesCache.set(payload.chatId, next);
      if (currentChatIdRef.current === payload.chatId) {
        setMessages(next);
      }
    },
    [setMessages, messagesCache],
  );

  useEffect(() => {
    const s = io(API, { withCredentials: true });
    socketRef.current = s;

    const onMessageNew = (m: Message) => {
      appendMessageToCache(m);
      logSendLatency(m.chat_id ?? null, m.id ?? null, m.view_status ?? null);
    };

    const onMessageStatus = (payload: any) => {
      const chatId = payload?.chatId ?? payload?.chat_id ?? null;
      const messageId = payload?.messageId ?? payload?.message_id ?? null;
      const viewStatus = payload?.view_status ?? payload?.raw_status ?? null;
      updateMessageStatusInCache({
        chatId,
        messageId,
        view_status: viewStatus ?? null,
      });
      logSendLatency(chatId ?? null, messageId ?? null, viewStatus ?? null);
    };

    s.on("message:new", onMessageNew);
    s.on("message:status", onMessageStatus);
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
      });
    };

    s.on("chat:updated", onChatUpdated);

    return () => {
      s.off("message:new", onMessageNew);
      s.off("message:status", onMessageStatus);
      s.off("chat:updated", onChatUpdated);
      s.disconnect();
    };
  }, [appendMessageToCache, updateMessageStatusInCache, bumpChatToTop, logSendLatency]);

  const loadChats = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      const activeKindParam = chatScope === "groups" ? "GROUP" : "DIRECT";
      const statusKey = status && status !== "ALL" ? status : "ALL";
      const inboxKey = inboxId || "*";
      const searchKey = debouncedQ.trim();
      const cacheKey = JSON.stringify({
        inbox: inboxKey,
        status: statusKey,
        kind: activeKindParam,
        q: searchKey || "",
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
    [API, debouncedQ, status, inboxId, PAGE_SIZE, normalizeChats, navigate, chatScope],
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


  useEffect(() => {
    const activeKindParam = chatScope === "groups" ? "GROUP" : "DIRECT";
    const statusKey = status && status !== "ALL" ? status : "ALL";
    const inboxKey = inboxId || "*";
    const searchKey = debouncedQ.trim();
    const cacheKey = JSON.stringify({
      inbox: inboxKey,
      status: statusKey,
      kind: activeKindParam,
      q: searchKey || "",
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
  }, [debouncedQ, status, inboxId, chatScope, loadChats]);



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
    const cached = messagesCache.get(chatId);
    const hasCache = Array.isArray(cached);
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
    setMessagesLoading(!hasCache);
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
      .then((rows) => setChatTags(uniqueIds(rows)))
      .catch(() => setChatTags([]));
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
          if (resp?.ok) setInboxes(resp.data || []);
          else setInboxes([]);
        });
      } else {
        fetchJson<Inbox[]>(`${API}/livechat/inboxes/my`)
          .then((rows) => {
            if (!cancelled) setInboxes(rows || []);
          })
          .catch(() => {
            if (!cancelled) setInboxes([]);
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



  const send = async () => {
    if (!currentChat) return;
    const sendStartedAt = performance.now();
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const provider =
      (inboxes.find((inbox) => inbox.id === currentChat.inbox_id)?.provider || "").toUpperCase();
    const isWaha = provider === "WAHA";

    setText("");
    try {
      if (isWaha) {
        const candidates = [currentChat.customer_phone, currentChat.external_id];
        let to = "";
        for (const candidate of candidates) {
          if (typeof candidate !== "string") continue;
          const trimmed = candidate.trim();
          if (!trimmed) continue;
          if (trimmed.includes("@")) {
            to = trimmed;
            break;
          }
          const digits = trimmed.replace(/\D/g, "");
          if (digits) {
            to = `${digits}@c.us`;
            break;
          }
        }
        if (!to) {
          console.error("Falha ao resolver destinatario WAHA do chat", currentChat.id);
          setText(trimmedText);
          return;
        }

        const response = await fetchJson<any>(`${API}/waha/sendText`, {
          method: "POST",
          body: JSON.stringify({
            inboxId: currentChat.inbox_id,
            chatId: currentChat.id,
            to,
            content: trimmedText,
          }),
        });
        const draftIdRaw =
          (response && typeof response === "object" && "draftId" in response
            ? (response as any).draftId
            : null) ?? ((response as any)?.data?.draftId ?? null);

        const draftId =
          draftIdRaw ||
          (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        if (!draftIdRaw) {
          console.warn("[livechat] WAHA draftId missing; using fallback id", {
            chatId: currentChat.id,
          });
        }
        trackMessageLatency(draftId, sendStartedAt);
        const nowIso = new Date().toISOString();
        appendMessageToCache({
          id: draftId,
          chat_id: currentChat.id,
          body: trimmedText,
          content: trimmedText,
          media_url: null,
          sender_type: "AGENT",
          sender_id: null,
          created_at: nowIso,
          view_status: "Pending",
          type: "TEXT",
          is_private: false,
        });
        bumpChatToTop({
          chatId: currentChat.id,
          last_message: trimmedText,
          last_message_at: nowIso,
          last_message_from: "AGENT",
          last_message_type: "TEXT",
          last_message_media_url: null,
        });
        // Atualiza preview local antes do socket confirmar.
        scrollToBottom();
        return;
      }

      const payload = {
        chatId: currentChat.id,
        text: trimmedText,
        senderType: "AGENT",
      };

      const response = await fetchJson<any>(`${API}/livechat/messages`, {
        method: "POST",
        body: JSON.stringify({ chatId: currentChat.id, text: payload.text, senderType: payload.senderType }),
      });
      const inserted = (response?.data ?? response) as any;
      if (inserted?.id) {
        trackMessageLatency(inserted.id, sendStartedAt);
        appendMessageToCache({
          id: inserted.id,
          chat_id: inserted.chat_id ?? payload.chatId,
          body: inserted.body ?? inserted.content ?? payload.text,
          content: inserted.content ?? inserted.body ?? payload.text,
          media_url: inserted.media_url ?? null,
          sender_type: inserted.sender_type ?? (inserted.is_from_customer ? "CUSTOMER" : "AGENT"),
          sender_id: inserted.sender_id ?? null,
          created_at: inserted.created_at ?? new Date().toISOString(),
          view_status: inserted.view_status ?? null,
          type: inserted.type ?? "TEXT",
          is_private: Boolean(inserted.is_private),
        });
        scrollToBottom();
        bumpChatToTop({
          chatId: inserted.chat_id ?? payload.chatId,
          last_message: inserted.body ?? inserted.content ?? payload.text,
          last_message_at: inserted.created_at ?? new Date().toISOString(),
          last_message_from: inserted.sender_type ?? (inserted.is_from_customer ? "CUSTOMER" : "AGENT"),
          last_message_type: inserted.type ?? "TEXT",
          last_message_media_url: inserted.media_url ?? null,
        });
        // Evita reload: confiamos no socket para sincronizar.
      }
    } catch (err) {
      console.error("Falha ao enviar mensagem", err);
      setText(trimmedText); // restaura texto para tentativa posterior
    }
  };



  const uploadFile = async (file: File) => {
    if (!currentChat) return;
    const formData = new FormData();
    formData.set("file", file, file.name);

    try {
      const response = await fetch(`${API}/livechat/chats/${currentChat.id}/messages/media`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.inserted) {
        if ((payload as any)?.error === "mime_not_allowed") {
          alert(`Esse formato (${(payload as any)?.mimetype || "desconhecido"}) nao e suportado pelo WhatsApp. Tente outro navegador (OGG/AAC).`);
        }
        throw new Error((payload as any)?.error || "upload_failed");
      }
      const inserted = payload.inserted as any;

      appendMessageToCache({
        id: inserted.id,
        chat_id: inserted.chat_id ?? currentChat.id,
        body: inserted.content ?? file.name,
        content: inserted.content ?? file.name,
        media_url: inserted.media_url ?? null,
        sender_type: "AGENT",
        sender_id: inserted.sender_id ?? null,
        created_at: inserted.created_at ?? new Date().toISOString(),
        view_status: inserted.view_status ?? "Pending",
        type: inserted.type ?? "DOCUMENT",
        is_private: false,
      });
      bumpChatToTop({
        chatId: inserted.chat_id ?? currentChat.id,
        last_message: inserted.content ?? file.name,
        last_message_at: inserted.created_at ?? new Date().toISOString(),
        last_message_from: "AGENT",
        last_message_type: inserted.type ?? "DOCUMENT",
        last_message_media_url: inserted.media_url ?? null,
      });
      // Mantem lista consistente sem recarregar.
      scrollToBottom();
    } catch (err) {
      console.error("Falha ao enviar arquivo", err);
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
        "audio/mp4",
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
          const ext = mimeType.startsWith("audio/ogg") ? "ogg" : (mimeType === "audio/mp4" ? "m4a" : "webm");
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
      try {
        await fetchJson(`${API}/livechat/chats/${currentChat.id}/tags`, {
          method: "POST",
          body: JSON.stringify({ tagId }),
        });
      } catch (error) {

        console.error("Falha ao adicionar tag", error);

      }
    },

    [currentChat?.id],

  );


  const removeTag = useCallback(
    async (tagId: string) => {
      if (!currentChat?.id) return;
      try {
        await fetchJson(`${API}/livechat/chats/${currentChat.id}/tags/${tagId}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Falha ao remover tag", error);
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
      setChatTags((prev) => {
        const set = new Set(prev);
        let next: string[];
        if (set.has(tagId)) {
          set.delete(tagId);
          next = Array.from(set);
          void removeTag(tagId);
        } else {
          set.add(tagId);
          next = Array.from(set);
          void addTag(tagId);
        }
        return next;
      });
    },
    [currentChat?.id, addTag, removeTag],
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


  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-4rem)]">
          <div className="col-span-2">
            <LivechatMenu section={section} onChange={setSection} />
          </div>

          {(section === "all" || section === "unanswered") && (
            <div className="col-span-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] p-4 flex flex-col max-h-screen min-h-0 transition-colors duration-300">
              {/* Header (filtros) */}
              <div className="shrink-0">
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Caixa</label>
                  <select
                    className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/45"
                    value={inboxId}
                    onChange={(e) => setInboxId(e.target.value)}
                  >
                    {inboxes.length > 0 ? (
                      <>
                        <option value="">Todas as caixas</option>
                        {inboxes.map((ib) => (
                          <option key={ib.id} value={ib.id}>
                            {ib.name} {ib.phone_number ? `(${ib.phone_number})` : ""}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="" disabled>
                        Nenhuma caixa encontrada
                      </option>
                    )}
                  </select>
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/45"
                    placeholder="Buscar..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 px-2 py-2 text-sm text-[var(--color-text)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/45"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ALL">Todos</option>
                    <option value="OPEN">Abertos</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="AI">Agente de IA</option>
                    <option value="RESOLVED">Resolvidos</option>
                    <option value="CLOSED">Fechados</option>
                  </select>
                </div>

                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChatScope("conversations")}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${chatScope === "conversations"
                      ? "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)] border-[color:var(--color-primary)]/50"
                      : "bg-[color:var(--color-surface-muted)] text-[var(--color-text)] border-transparent hover:bg-[color:var(--color-surface-muted)]/80"}
                    `}
                  >
                    Conversas
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatScope("groups")}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${chatScope === "groups"
                      ? "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)] border-[color:var(--color-primary)]/50"
                      : "bg-[color:var(--color-surface-muted)] text-[var(--color-text)] border-transparent hover:bg-[color:var(--color-surface-muted)]/80"}
                    `}
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
              scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent
              hover:scrollbar-thumb-[#334155]
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[#1E293B]
              hover:[&::-webkit-scrollbar-thumb]:bg-[#334155]
            "
              >
                {chatListItems.length === 0 ? (
                  <div className="p-3 text-sm text-[var(--color-text-muted)]">
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
                  />
                )}

                {chatListItems.length > 0 && isChatsLoading && (
                  <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">Carregando chats...</div>
                )}
                {chatListItems.length > 0 && !hasMoreChats && !isChatsLoading && (
                  <div className="p-3 text-xs text-[var(--color-text-muted)] opacity-60 text-center">
                    {chatScope === "groups" ? "N�o h� mais grupos." : "N�o h� mais conversas."}
                  </div>
                )}
              </div>
            </div>
          )}


          {section === "all" || section === "unanswered" ? (
            <div className="col-span-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] p-4 flex flex-col relative min-h-screen max-h-screen transition-colors dura??o-300">
              <ChatHeader
                apiBase={API}
                chat={currentChat}
                inboxId={currentChat?.inbox_id ?? null}
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
              />

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-auto space-y-1.5 pr-1
              scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent
              hover:scrollbar-thumb-[#334155]
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
            "
              >
                {isFetchingOlderMessages && (
                  <div className="py-2 text-center text-xs text-[var(--color-text-muted)]">
                    Carregando mensagens anteriores...
                  </div>
                )}
                {!isFetchingOlderMessages && !messagesHasMore && messages.length > 0 && (
                  <div className="py-2 text-center text-xs text-[var(--color-text-muted)] opacity-70">
                    N?o h? mais mensagens no hist?rico.
                  </div>
                )}
                {messagesLoading && (
                  <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">Carregando mensagens...</div>
                )}

                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    isAgent={m.sender_type === "AGENT"}
                    mediaItems={mediaItems}
                    mediaIndex={mediaIndexById.get(m.id) ?? undefined}
                    showRemoteSenderInfo={currentChat ? isGroupChat(currentChat) : false}
                  />
                ))}

                {!messagesLoading && messages.length === 0 && (
                  <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">Nenhuma mensagem.</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setIsPrivateOpen(true)}
                    className="rounded border border-[color:var(--color-primary)]/45 bg-[color:var(--color-primary)]/15 px-2.5 py-1.5 text-xs font-medium text-[var(--color-highlight)] transition-colors dura??o-150 hover:bg-[color:var(--color-primary)]/25"
                  >
                    Mensagem privada
                  </button>

                  <button
                    onClick={handlePickFile}
                    className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/60 p-2 transition-colors dura??o-150 hover:bg-[color:var(--color-surface-muted)]/85"
                    title="Enviar anexo"
                  >
                    <FiPaperclip className="h-5 w-5 text-[var(--color-highlight)]" />
                  </button>

                  <button
                    onClick={toggleRecording}
                    className={`rounded border p-2 transition-colors dura??o-150 ${isRecording
                      ? "bg-red-900/40 border-red-700 text-red-300"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/60 text-[var(--color-text)] hover:bg-[color:var(--color-surface-muted)]/85"
                      }`}
                    title="Gravar ?udio"
                  >
                    <FiMic className={`w-5 h-5 ${isRecording ? "text-red-300" : "text-[var(--color-highlight)]"}`} />
                  </button>

                  <button
                    onClick={() => setShowEmoji((v) => !v)}
                    className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/60 p-2 transition-colors dura??o-150 hover:bg-[color:var(--color-surface-muted)]/85"
                    title="Emoji"
                  >
                    <FiSmile className="h-5 w-5 text-[var(--color-highlight)]" />
                  </button>
                </div>

                {showEmoji && (
                  <div className="grid grid-cols-8 gap-1 p-2 bg-[color:var(--color-surface-muted)]/70 border border-[color:var(--color-border)] rounded-lg shadow mb-2 w-fit text-xl">
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

                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 px-3 py-2 text-sm text-[var(--color-text)] transition-colors dura??o-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/45"
                    placeholder={isRecording ? "Gravando ?udio..." : "Digite sua mensagem..."}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    disabled={isRecording}
                  />
                  <button
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors dura??o-150 hover:bg-[var(--color-primary-strong)]"
                    onClick={send}
                    disabled={isRecording}
                  >
                    Enviar
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </div>
          ) : section === "labels" ? (
            <div className="col-span-10 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] p-6 transition-colors duration-300">
              <LabelsManager apiBase={API} />
            </div>
          ) : section === "contacts" ? (
            <div className="col-span-10">
              <ContactsCRM apiBase={API} socket={socketRef.current} />
            </div>
          ) :  section === "campaigns" && (
            <div className="col-span-10 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] p-4 flex flex-col min-h-screen max-h-screen transition-colors duration-300">
              <CampaignsPanel apiBase={API} />
            </div>
          )}
        </div>
      </div>

      {/* Modal de privado */}
      <div>
        {isPrivateOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/98 shadow-[0_32px_70px_-45px_rgba(8,12,20,0.95)] w-[min(640px,95vw)] p-4 flex flex-col max-h-[80vh] transition-colors duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-[var(--color-heading)]">Conversa privada</div>
                <button
                  onClick={() => setIsPrivateOpen(false)}
                  className="p-2 rounded hover:bg-[color:var(--color-surface-muted)]/75"
                >
                  <FiX className="h-5 w-5 text-[var(--color-text-muted)]" />
                </button>
              </div>

              {currentChat && (
                <div className="text-sm text-[var(--color-text-muted)] mb-2">
                  Agente atribu?do:{" "}
                  <span className="font-medium text-[var(--color-heading)]">
                    {currentChat.assigned_agent_name || "?"}
                  </span>
                </div>
              )}

              <div className="text-xs text-[var(--color-text-muted)] mb-3">
                Somente sua equipe v? estas mensagens. Elas tamb?m aparecem no hist?rico do chat, destacadas como privadas.
              </div>

              <div
                className="flex-1 overflow-auto space-y-1.5 pr-1 rounded-lg p-2 border border-[color:var(--color-border)] bg-[color:var(--color-bg)]
              scrollbar-thin scrollbar-thumb-[#1E293B] scrollbar-track-transparent
              hover:scrollbar-thumb-[#334155]
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
            "
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
                    />
                  ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/45"
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
                <button
                  onClick={sendPrivate}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-strong)]"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>

  );
}










