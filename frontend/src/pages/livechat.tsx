import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../utils/api";
import { useNavigate, useLocation, useParams, useOutletContext } from "react-router-dom";
import { cleanupService } from "../services/cleanupService";
import { useCompany } from "../hooks/useCompany";
import ChatList, { type Chat as ChatListItem } from "../components/livechat/ChatList";
import LivechatMenu, { type LivechatSection } from "../components/livechat/LivechatMenu";
import { ChatHeader } from "../components/livechat/ChatHeader";
import { MessageBubble } from "../components/livechat/MessageBubble";
import { LabelsManager } from "../components/livechat/LabelsManager";
import { ReplyPreview } from "../components/livechat/ReplyPreview";
import type { Chat, Message, Inbox, Tag, Contact } from "@livechat/shared";
import { FiPaperclip, FiMic, FiSmile, FiX, FiFilter, FiSearch, FiMessageSquare, FiMenu, FiLayers, FiFileText } from "react-icons/fi";
import { ContactsCRM } from "../components/livechat/ContactsCRM";
import CampaignsPanel from "../components/livechat/CampaignsPanel";
import FlowsPanel from "../components/livechat/FlowsPanel";
import { FlowPicker } from "../components/livechat/FlowPicker";
import { MetaTemplatePicker } from "../components/livechat/MetaTemplatePicker";
import { FirstInboxWizard } from "../components/livechat/FirstInboxWizard";
import { ContactInfoPanel } from "../components/livechat/ContactInfoPanel";
import { MentionInput } from "../components/MentionInput";
import { Button, Card } from "../components/ui";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5000";

const MEDIA_PREVIEW_LABELS: Record<string, string> = {
  IMAGE: "📷 Imagem",
  VIDEO: "🎥 Vídeo",
  AUDIO: "🎤 Áudio",
  DOCUMENT: "📄 Documento",
  FILE: "📄 Documento",
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

function formatDateSeparator(dateString: string) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  if (isToday(date)) {
    return "Hoje";
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  
  const diff = Date.now() - date.getTime();
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 7) {
     // Capitalize first letter
     const weekday = format(date, "EEEE", { locale: ptBR });
     return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  
  return format(date, "dd/MM/yyyy");
}

function isGenericName(name: string | null | undefined) {
  if (!name) return true;
  const cleaned = name.replace(/\D/g, "");
  // Se for apenas números e longo (telefone), ou se contiver @ (remote id), ou se for um UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
  return (cleaned.length >= 8 && /^\d+$/.test(cleaned)) || name.includes("@") || isUuid;
}

function pickBetterName(newName: string | null | undefined, oldName: string | null | undefined) {
  if (!newName || newName.trim() === "") return oldName || null;
  if (!oldName || oldName.trim() === "") return newName || null;
  
  const newIsGeneric = isGenericName(newName);
  const oldIsGeneric = isGenericName(oldName);
  
  // Se o novo nome for real e o antigo genérico, prefere o novo
  if (!newIsGeneric && oldIsGeneric) return newName;
  // Se o novo for genérico e o antigo real, prefere o antigo
  if (newIsGeneric && !oldIsGeneric) return oldName;
  
  // Caso contrário, fica com o novo (ou o que for mais longo se ambos forem reais)
  return newName;
}

import { LimitModal } from "../components/ui/LimitModal";

export default function LiveChatPage() {
  const navigate = useNavigate();
  const { chatId, flowId } = useParams();
  const { setMobileOpen } = useOutletContext<{ setMobileOpen: (open: boolean) => void }>();

  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(true);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [chatListWidth, setChatListWidth] = useState(350);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      // Subtract global sidebar (64px) + local livechat menu (64px)
      const newWidth = e.clientX - 128; 
      if (newWidth > 250 && newWidth < 600) {
        setChatListWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  
  // Limit Modal State
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitData, setLimitData] = useState<{ message?: string; resource?: string; limit?: number; current?: number }>({});
  const { company } = useCompany();
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  // Fetch current user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data);
        }
      } catch (e) {
        console.error("Failed to fetch user profile", e);
      }
    };
    fetchProfile();
  }, []);

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
  const [status, setStatus] = useState<string>("ALL");
  const [chatScope, setChatScope] = useState<"conversations" | "groups">("conversations");
  const [section, setSection] = useState<LivechatSection>("all");

  // Sync section to URL
  useEffect(() => {
    if (section === "all") {
      if (chatId && chatId !== "flows") return;
      navigate("/livechat", { replace: true });
    } else if (section === "flows") {
      if (flowId) {
        navigate(`/livechat/flows/${flowId}`, { replace: true });
      } else {
        navigate("/livechat/flows", { replace: true });
      }
    } else if (section === "campaigns") {
      navigate("/livechat?section=campaigns", { replace: true });
    } else if (section === "contacts") {
      navigate("/livechat?section=contacts", { replace: true });
    } else if (section === "labels") {
      navigate("/livechat?section=labels", { replace: true });
    } else if (section === "unanswered") {
      navigate("/livechat?section=unanswered", { replace: true });
    }
  }, [section, flowId, chatId]);

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
  const [showFlowPicker, setShowFlowPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatsListRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesMetaRef = useRef<Record<string, { nextBefore: string | null; hasMore: boolean }>>({});
  const isPrependingMessagesRef = useRef(false);
  const [isFetchingOlderMessages, setIsFetchingOlderMessages] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Private mode toggle state
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);

  const lastCustomerMessage = useMemo(() => {
    return [...messages].reverse().find(m => m.sender_type === "CUSTOMER");
  }, [messages]);

  const isMetaChat = useMemo(() => {
    if (!currentChat) return false;
    const inbox = inboxes.find(ib => ib.id === currentChat.inbox_id);
    return inbox?.provider === "META_CLOUD" || inbox?.provider === "WHATSAPP";
  }, [currentChat, inboxes]);

  const isWindowOpen = useMemo(() => {
    if (!isMetaChat) return true;
    if (!lastCustomerMessage) return false;
    
    const lastDate = new Date(lastCustomerMessage.created_at);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours < 24;
  }, [lastCustomerMessage, isMetaChat]);
  const [companyUsers, setCompanyUsers] = useState<Array<{ id: string; name: string; email?: string; avatar?: string }>>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const tagOperationsRef = useRef<Set<string>>(new Set()); // Track ongoing tag operations
  const currentChatIdRef = useRef<string | null>(null);
  const chatsTotalRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  const messagesCache = messagesCacheRef.current;
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
  const metadataCacheRef = useRef<Record<string, { 
    display_name?: string | null, 
    customer_name?: string | null,
    group_name?: string | null,
    customer_avatar_url?: string | null,
    group_avatar_url?: string | null,
    photo_url?: string | null,
    unread_count?: number | null
  }>>({});
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
    setStatus("ALL");
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
    base.group_avatar_url = base.group_avatar_url || null;
    base.customer_avatar_url = base.customer_avatar_url || null;
    base.photo_url = (base as any).photo_url || null;
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

    // Priorizar nomes que não sejam genéricos (UUID ou Telefone)
    const nonGenericCandidates = nameCandidates.filter(n => !isGenericName(n));
    const resolvedName = nonGenericCandidates.length > 0 ? nonGenericCandidates[0] : (nameCandidates.length > 0 ? nameCandidates[0] : null);
    
    base.display_name = resolvedName;
    if (!resolvedName && base.customer_name) {
      base.display_name = base.customer_name;
    }
    if (finalIsGroup && !base.group_name && base.display_name) {
      base.group_name = base.display_name;
    }

    const maybeGroupSize = base.group_size ?? (raw as any)?.group_size ?? (raw as any)?.participants_count ?? null;
    base.group_size = typeof maybeGroupSize === "number" && Number.isFinite(maybeGroupSize) ? maybeGroupSize : null;

    // APLICAR CACHE (Sticky Metadata) para evitar perda de nome/foto em atualizações parciais ou resets
    const chatId = base.id;
    if (chatId) {
      // ✅ CORREÇÃO: Se o chat está aberto, o unread_count DEVE ser 0
      if (currentChatIdRef.current === chatId) {
        base.unread_count = 0;
      }

      const cached = metadataCacheRef.current[chatId];
      if (cached) {
        base.display_name = pickBetterName(base.display_name, cached.display_name);
        base.customer_name = pickBetterName(base.customer_name, cached.customer_name);
        base.group_name = pickBetterName(base.group_name, cached.group_name);
        base.customer_avatar_url = base.customer_avatar_url || cached.customer_avatar_url || null;
        base.group_avatar_url = base.group_avatar_url || cached.group_avatar_url || null;
        base.photo_url = base.photo_url || cached.photo_url || null;
      }
      
      // ATUALIZAR CACHE com os melhores valores atuais
      metadataCacheRef.current[chatId] = {
        display_name: base.display_name,
        customer_name: base.customer_name,
        group_name: base.group_name,
        customer_avatar_url: base.customer_avatar_url,
        group_avatar_url: base.group_avatar_url,
        photo_url: base.photo_url,
        unread_count: base.unread_count
      };
    }

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
    // ✅ ATUALIZAR CHATS STATE (lista normal)
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chatId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...partial };
      return updated;
    });
    
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
  }, [setChats]);

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
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/livechat/chats/${chatId}/status`, {
        method: "PUT",
        credentials: "include",
        headers,
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
      // ✅ CORREÇÃO: Atualizar o estado local IMEDIATAMENTE para feedback visual instantâneo
      patchChatLocal(chatId, { unread_count: 0 } as any);
      
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/livechat/chats/${chatId}/mark-read`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        // 404 = chat não existe ou sem permissão - silenciar (comum após logout/troca de empresa)
        if (res.status === 404) {
          return;
        }
        const json = await res.json().catch(() => ({}));
        // Se falhar, não reverter - melhor manter o estado otimista
        return;
      }
      await res.json().catch(() => ({}));
    } catch (error) {
      console.error("[READ_RECEIPTS] erro inesperado ao marcar como lida", {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Não reverter o estado mesmo em caso de erro
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
      
      // Formatar a última mensagem com "Você: " se for do agente
      let lastMessageText: string | null = null;
      if (mediaLabel) {
        lastMessageText = mediaLabel;
      } else if (chat.last_message) {
        const prefix = chat.last_message_from === "AGENT" ? "Você: " : "";
        const cleanLastMessage = chat.last_message
          .replace(/\?\?\s*audio/gi, "🎤 Áudio")
          .replace(/\?\?\s*Documento/gi, "📄 Documento")
          .replace(/\?\?\s*Imagem/gi, "📷 Imagem")
          .replace(/\?\?\s*Vídeo/gi, "🎥 Vídeo")
          .replace(/\?\?\s*Sticker/gi, "🎨 Sticker")
          .replace(/\[AUDIO\]/gi, "🎤 Áudio")
          .replace(/\[IMAGE\]/gi, "📷 Imagem")
          .replace(/\[VIDEO\]/gi, "🎥 Vídeo")
          .replace(/\[DOCUMENT\]/gi, "📄 Documento")
          .replace(/\[STICKER\]/gi, "🎨 Sticker");
        lastMessageText = `${prefix}${cleanLastMessage}`;
      }
      
      const displayName = (chat.display_name && chat.display_name.trim())
        ? chat.display_name.trim()
        : isGroup
          ? chat.group_name || sanitizeRemoteIdentifier(chat.display_remote_id || chat.remote_id || chat.external_id) || chat.id
          : chat.customer_name || chat.display_phone || sanitizeRemoteIdentifier(chat.display_remote_id || chat.remote_id || chat.external_id) || chat.id;
      const photoUrl = isGroup
        ? chat.group_avatar_url || (chat as any)?.photo_url || null
        : chat.customer_avatar_url || (chat as any)?.customer_photo_url || (chat as any)?.photo_url || null;

      return {
        ...(chat as ChatListItem),
        id: chat.id,
        name: displayName,
        last_message: lastMessageText,
        last_message_at: chat.last_message_at ?? chat.created_at ?? null,
        last_message_from: chat.last_message_from ?? null,
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
    if (!currentChat) return;

    const currentMatches = chatScope === "groups" ? isGroupChat(currentChat) : !isGroupChat(currentChat);
    if (!currentMatches) {
      // Se o chat atual não corresponde ao escopo (ex: mudou de Conversas para Grupos),
      // apenas desselecione. Não selecione o primeiro automaticamente.
      setCurrentChat(null);
      setSelectedChat(null);
    }
  }, [chatScope, currentChat, isGroupChat]);


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

  // Load company users for mentions
  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      try {
        const token = getAccessToken();
        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const url = new URL(`${API}/api/users/company`);
        if (currentChat?.inbox_id) {
          url.searchParams.append('inboxId', currentChat.inbox_id);
        }

        const res = await fetch(url.toString(), {
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const rows = await res.json();
        
        if (cancelled) return;
        const formatted = Array.isArray(rows)
          ? rows.map((row: any) => ({
              id: row.public_user_id || row.user_id || row.id,
              name: row.name ?? "Sem nome",
              email: row.email ?? undefined,
              avatar: row.avatar || row.profile_picture || undefined,
            }))
          : [];
        setCompanyUsers(formatted);
      } catch (error) {
        console.error("[livechat] Error loading company users:", error);
        if (!cancelled) setCompanyUsers([]);
      }
    };
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [API, currentChat?.inbox_id]);




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
    
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${API}/kanban/my-board`, { 
      credentials: "include",
      headers
    });
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
        chatId, // Pass chatId for system message
        // Opcional: manda observao do modal se voc tiver ela aqui
        // note: noteDraft,
      };

      const headers = new Headers({ "Content-Type": "application/json" });
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/kanban/cards/ensure`, {
        method: "POST",
        credentials: "include",
        headers,
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
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/livechat/chats/${chatId}/note`, {
        method: "PATCH",
        credentials: "include",
        headers,
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
  customer_avatar_url?: string | null;
  display_name?: string | null;
  remote_id?: string | null;
  kind?: string | null;
  status?: string;
  unread_count?: number | null;
  department_id?: string | null;
  department_name?: string | null;
  department_color?: string | null;
  department_icon?: string | null;
}) => {
  console.debug('[livechat] 🔄 bumpChatToTop called:', {
    chatId: update.chatId,
    last_message: update.last_message,
    last_message_from: update.last_message_from,
    last_message_at: update.last_message_at,
  });
  
  setChats((prev) => {
    const arr = [...prev];
    const idx = arr.findIndex((c) => c.id === update.chatId);
    
    // Se chat não existe, criar novo chat
    if (idx === -1) {
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
        ? pickBetterName(update.customer_name, current.customer_name)
        : current.customer_name || null,
      customer_phone: Object.prototype.hasOwnProperty.call(update, "customer_phone")
        ? update.customer_phone || current.customer_phone || null
        : current.customer_phone || null,
      group_name: Object.prototype.hasOwnProperty.call(update, "group_name")
        ? pickBetterName(update.group_name, current.group_name)
        : current.group_name || null,
      group_avatar_url: Object.prototype.hasOwnProperty.call(update, "group_avatar_url")
        ? update.group_avatar_url || current.group_avatar_url || null
        : current.group_avatar_url || null,
      customer_avatar_url: Object.prototype.hasOwnProperty.call(update, "customer_avatar_url")
        ? update.customer_avatar_url || current.customer_avatar_url || null
        : current.customer_avatar_url || null,
      photo_url: Object.prototype.hasOwnProperty.call(update, "photo_url")
        ? (update as any).photo_url || (current as any).photo_url || null
        : (current as any).photo_url || null,
      remote_id: Object.prototype.hasOwnProperty.call(update, "remote_id")
        ? update.remote_id || current.remote_id || null
        : current.remote_id || null,
      kind: update.kind ?? current.kind ?? null,
      status: update.status ?? current.status,
      display_name: pickBetterName(update.display_name, current.display_name),
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

  // ✅ CORREÇÃO: Atualizar selectedChat e currentChat também
  setSelectedChat((prev) => {
    if (prev && prev.id === update.chatId) {
      // Use the same merge logic as setChats to preserve fields
      const merged = {
        ...prev,
        last_message: update.last_message ?? prev.last_message ?? null,
        last_message_at: update.last_message_at ?? prev.last_message_at ?? prev.created_at ?? null,
        last_message_from: update.last_message_from ?? prev.last_message_from ?? null,
        last_message_type: Object.prototype.hasOwnProperty.call(update, "last_message_type")
          ? update.last_message_type ?? prev.last_message_type ?? null
          : prev.last_message_type ?? null,
        last_message_media_url: Object.prototype.hasOwnProperty.call(update, "last_message_media_url")
          ? update.last_message_media_url ?? prev.last_message_media_url ?? null
          : prev.last_message_media_url ?? null,
        customer_name: Object.prototype.hasOwnProperty.call(update, "customer_name")
          ? pickBetterName(update.customer_name, prev.customer_name)
          : prev.customer_name || null,
        customer_phone: Object.prototype.hasOwnProperty.call(update, "customer_phone")
          ? update.customer_phone || prev.customer_phone || null
          : prev.customer_phone || null,
        group_name: Object.prototype.hasOwnProperty.call(update, "group_name")
          ? pickBetterName(update.group_name, prev.group_name)
          : prev.group_name || null,
        group_avatar_url: Object.prototype.hasOwnProperty.call(update, "group_avatar_url")
          ? update.group_avatar_url || prev.group_avatar_url || null
          : prev.group_avatar_url || null,
        customer_avatar_url: Object.prototype.hasOwnProperty.call(update, "customer_avatar_url")
          ? update.customer_avatar_url || prev.customer_avatar_url || null
          : prev.customer_avatar_url || null,
        photo_url: Object.prototype.hasOwnProperty.call(update, "photo_url")
          ? (update as any).photo_url || (prev as any).photo_url || null
          : (prev as any).photo_url || null,
        remote_id: Object.prototype.hasOwnProperty.call(update, "remote_id")
          ? update.remote_id || prev.remote_id || null
          : prev.remote_id || null,
        kind: update.kind ?? prev.kind ?? null,
        status: update.status ?? prev.status,
        display_name: pickBetterName(update.display_name, prev.display_name),
        ai_agent_id: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_id")
          ? (update as any).ai_agent_id ?? (prev as any)?.ai_agent_id ?? null
          : (prev as any)?.ai_agent_id ?? null,
        ai_agent_name: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_name")
          ? (update as any).ai_agent_name ?? (prev as any)?.ai_agent_name ?? null
          : (prev as any)?.ai_agent_name ?? null,
        unread_count: Object.prototype.hasOwnProperty.call(update, "unread_count")
          ? update.unread_count ?? prev.unread_count ?? 0
          : prev.unread_count ?? 0,
        department_id: Object.prototype.hasOwnProperty.call(update, "department_id")
          ? update.department_id ?? prev.department_id ?? null
          : prev.department_id ?? null,
        department_name: Object.prototype.hasOwnProperty.call(update, "department_name")
          ? update.department_name ?? prev.department_name ?? null
          : prev.department_name ?? null,
        department_color: Object.prototype.hasOwnProperty.call(update, "department_color")
          ? update.department_color ?? prev.department_color ?? null
          : prev.department_color ?? null,
        department_icon: Object.prototype.hasOwnProperty.call(update, "department_icon")
          ? update.department_icon ?? prev.department_icon ?? null
          : prev.department_icon ?? null,
      };
      
      // Se este é o chat selecionado, garantir que unread_count seja 0
      if (currentChatIdRef.current === update.chatId) {
        merged.unread_count = 0;
      }
      return normalizeChat(merged as any);
    }
    return prev;
  });
  
  // Atualizar currentChat também se for o mesmo
  setCurrentChat((prev) => {
    if (prev && prev.id === update.chatId) {
      // Use the same merge logic as setChats to preserve fields
      const merged = {
        ...prev,
        last_message: update.last_message ?? prev.last_message ?? null,
        last_message_at: update.last_message_at ?? prev.last_message_at ?? prev.created_at ?? null,
        last_message_from: update.last_message_from ?? prev.last_message_from ?? null,
        last_message_type: Object.prototype.hasOwnProperty.call(update, "last_message_type")
          ? update.last_message_type ?? prev.last_message_type ?? null
          : prev.last_message_type ?? null,
        last_message_media_url: Object.prototype.hasOwnProperty.call(update, "last_message_media_url")
          ? update.last_message_media_url ?? prev.last_message_media_url ?? null
          : prev.last_message_media_url ?? null,
        customer_name: Object.prototype.hasOwnProperty.call(update, "customer_name")
          ? pickBetterName(update.customer_name, prev.customer_name)
          : prev.customer_name || null,
        customer_phone: Object.prototype.hasOwnProperty.call(update, "customer_phone")
          ? update.customer_phone || prev.customer_phone || null
          : prev.customer_phone || null,
        group_name: Object.prototype.hasOwnProperty.call(update, "group_name")
          ? pickBetterName(update.group_name, prev.group_name)
          : prev.group_name || null,
        group_avatar_url: Object.prototype.hasOwnProperty.call(update, "group_avatar_url")
          ? update.group_avatar_url || prev.group_avatar_url || null
          : prev.group_avatar_url || null,
        customer_avatar_url: Object.prototype.hasOwnProperty.call(update, "customer_avatar_url")
          ? update.customer_avatar_url || prev.customer_avatar_url || null
          : prev.customer_avatar_url || null,
        photo_url: Object.prototype.hasOwnProperty.call(update, "photo_url")
          ? (update as any).photo_url || (prev as any).photo_url || null
          : (prev as any).photo_url || null,
        remote_id: Object.prototype.hasOwnProperty.call(update, "remote_id")
          ? update.remote_id || prev.remote_id || null
          : prev.remote_id || null,
        kind: update.kind ?? prev.kind ?? null,
        status: update.status ?? prev.status,
        display_name: pickBetterName(update.display_name, prev.display_name),
        ai_agent_id: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_id")
          ? (update as any).ai_agent_id ?? (prev as any)?.ai_agent_id ?? null
          : (prev as any)?.ai_agent_id ?? null,
        ai_agent_name: Object.prototype.hasOwnProperty.call(update as any, "ai_agent_name")
          ? (update as any).ai_agent_name ?? (prev as any)?.ai_agent_name ?? null
          : (prev as any)?.ai_agent_name ?? null,
        unread_count: Object.prototype.hasOwnProperty.call(update, "unread_count")
          ? update.unread_count ?? prev.unread_count ?? 0
          : prev.unread_count ?? 0,
        department_id: Object.prototype.hasOwnProperty.call(update, "department_id")
          ? update.department_id ?? prev.department_id ?? null
          : prev.department_id ?? null,
        department_name: Object.prototype.hasOwnProperty.call(update, "department_name")
          ? update.department_name ?? prev.department_name ?? null
          : prev.department_name ?? null,
        department_color: Object.prototype.hasOwnProperty.call(update, "department_color")
          ? update.department_color ?? prev.department_color ?? null
          : prev.department_color ?? null,
        department_icon: Object.prototype.hasOwnProperty.call(update, "department_icon")
          ? update.department_icon ?? prev.department_icon ?? null
          : prev.department_icon ?? null,
      };

      // Chat aberto sempre tem unread_count = 0
      merged.unread_count = 0;
      return normalizeChat(merged as any);
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
  
  // Auto-mark chat as read when opening (with debounce)
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    
    if (currentChat?.id) {
      s.emit("join", { chatId: currentChat.id });
      
      // ✅ AUTO-MARK AS READ quando abrir chat com mensagens não lidas
      if (currentChat.unread_count && currentChat.unread_count > 0) {
        console.log('[READ_RECEIPTS] Agendando mark-read', {
          chatId: currentChat.id,
          unread_count: currentChat.unread_count,
        });
        
        // Debounce de 500ms para garantir que usuário realmente visualizou
        const timer = setTimeout(() => {
          markChatAsRead(currentChat.id);
        }, 500);
        
        return () => {
          clearTimeout(timer);
          if (currentChat?.id) s.emit("leave", { chatId: currentChat.id });
        };
      }
    }
    
    return () => {
      if (currentChat?.id) s.emit("leave", { chatId: currentChat.id });
    };
  }, [currentChat?.id, currentChat?.unread_count, markChatAsRead]);


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

  // ✅ Socket listeners para sincronização de leitura em tempo real
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    // Listener para chat:read (outro usuário/aba/dispositivo marcou como lido)
    const onChatRead = (payload: { chatId: string; inboxId?: string; timestamp: string }) => {
      if (payload?.chatId) {
        // Atualizar unread_count localmente para 0
        patchChatLocal(payload.chatId, { unread_count: 0 } as any);
      }
    };

    // Listener para message:status (status de mensagem individual atualizado)
    const onMessageStatus = (payload: { 
      kind?: string;
      chatId: string; 
      messageId: string; 
      externalId?: string;
      view_status?: string;
      status?: string;
    }) => {
      const currentChatId = currentChatIdRef.current;
      if (payload?.chatId === currentChatId && payload?.messageId) {
        // Atualizar view_status da mensagem no histórico local
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.messageId
              ? { 
                  ...msg, 
                  view_status: payload.view_status || payload.status || msg.view_status 
                }
              : msg
          )
        );
      }
    };

    s.on('chat:read', onChatRead);
    s.on('message:status', onMessageStatus);

    return () => {
      s.off('chat:read', onChatRead);
      s.off('message:status', onMessageStatus);
    };
  }, [patchChatLocal]);

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
    // If missing or invalid, derive from is_from_customer or fromMe
    let senderType = raw.sender_type;
    if (!senderType || (senderType !== "AGENT" && senderType !== "CUSTOMER" && senderType !== "SYSTEM" && senderType !== "AI")) {
      // Map boolean is_from_customer to string sender_type
      if (typeof raw.is_from_customer === "boolean") {
        senderType = raw.is_from_customer ? "CUSTOMER" : (raw.type === "SYSTEM" ? "SYSTEM" : (raw.sender_id ? "AGENT" : "AI"));
      } else if (typeof raw.fromMe === "boolean") {
        senderType = raw.fromMe ? "AGENT" : "CUSTOMER";
      } else if (typeof raw.is_from_customer === "string") {
        senderType = raw.is_from_customer;
      } else {
        senderType = "CUSTOMER"; // Default fallback
      }
    }
    
    const normalized = {
      ...raw,
      chat_id: raw.chat_id ?? raw.chatId ?? null,
      body: raw.body ?? raw.content ?? raw.text ?? null,
      sender_type: senderType,
      media_url: raw.media_url ?? raw.mediaUrl ?? null,
      media_public_url: raw.media_public_url ?? raw.mediaPublicUrl ?? null,
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
      interactive_content: raw.interactive_content ?? raw.interactiveContent ?? null,
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
      
      const normalizedExternalId = (normalized as any).external_id;
      
      // Find existing message by ID, client_draft_id, or external_id (for draft replacement)
      const index = existing.findIndex(
        (item) => {
          // Match by message ID
          if (item.id === normalized.id) return true;
          
          // Match by client_draft_id
          if (normalized.client_draft_id && item.client_draft_id === normalized.client_draft_id) return true;
          
          // Match by external_id for META draft replacement
          // Draft has id like "draft-wamid.HBg..." and external_id "wamid.HBg..."
          // Confirmed message has UUID id and same external_id
          if (normalizedExternalId && (item as any).external_id === normalizedExternalId) {
            return true;
          }
          
          return false;
        }
      );
      
      // If normalized is a draft and we found a confirmed message with same external_id, ignore the draft
      if (index >= 0 && normalized.id?.startsWith('draft-') && !existing[index].id?.startsWith('draft-')) {
        return;
      }
      
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
      
      const isCurrent = currentChatIdRef.current === chatId;

      if (isCurrent) {
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

  // 1. Socket Connection Lifecycle (Static)
  useEffect(() => {
    const s = io(API, { withCredentials: true });
    socketRef.current = s;

    s.on("connect", () => {
      setSocketReady(true);
      if (company?.id) {
        s.emit("join:company", { companyId: company.id });
      }
    });

    s.on("disconnect", (reason) => {
      setSocketReady(false);
    });

    s.on("connect_error", (err) => {
      console.error("[livechat] Socket connect error:", err);
    });

    // Listen for mention notifications (static)
    s.on("user:mentioned", (data: any) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Você foi mencionado!", {
          body: "Alguém mencionou você em uma conversa privada",
          icon: "/favicon.ico",
        });
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // 2. Event Listeners (Dynamic)
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onMessageNew = (m: Message) => {
      appendMessageToCache(m);
      logSendLatency(m.chat_id ?? null, m.id ?? null, m.view_status ?? null);
      
      // Determinar last_message_from baseado no sender_type
      let lastMessageFrom: "CUSTOMER" | "AGENT" | undefined = undefined;
      if (m.sender_type === "CUSTOMER") {
        lastMessageFrom = "CUSTOMER";
      } else if (m.sender_type === "AGENT" || m.sender_type === "AI") {
        // Tanto AGENT quanto AI são considerados "AGENT" para o chat list
        lastMessageFrom = "AGENT";
      }
      
      // ✅ CORREÇÃO: Se o chat está aberto no momento, não incrementar unread_count
      // O backend já incrementou o contador, mas se o usuário está visualizando,
      // devemos manter em 0 e chamar mark-read
      const isChatOpen = currentChatIdRef.current === m.chat_id;
      const isFromCustomer = m.sender_type === "CUSTOMER";
      
      // Se chat está aberto E mensagem é do cliente, marcar como lida imediatamente
      if (isChatOpen && isFromCustomer) {
        // Marcar como lida após um pequeno delay para garantir que foi exibida
        setTimeout(() => {
          markChatAsRead(m.chat_id);
        }, 300);
      }

      // Calcular novo unread_count
      let nextUnreadCount: number | undefined = undefined;
      
      if (isChatOpen && isFromCustomer) {
        nextUnreadCount = 0;
      } else if (Object.prototype.hasOwnProperty.call(m, "unread_count")) {
        nextUnreadCount = (m as any).unread_count;
      } else if (isFromCustomer) {
        // Se não veio no payload, incrementar localmente
        const currentChatObj = chatsRef.current.find(c => c.id === m.chat_id);
        const currentCount = currentChatObj?.unread_count ?? 0;
        nextUnreadCount = currentCount + 1;
      }
      
      // Bump chat to top quando receber mensagem nova
      bumpChatToTop({
        chatId: m.chat_id,
        last_message: m.body ?? (m.media_url ? "[MEDIA]" : ""),
        last_message_at: m.created_at,
        last_message_from: lastMessageFrom,
        last_message_type: m.type ?? null,
        last_message_media_url: m.media_url ?? null,
        group_name: Object.prototype.hasOwnProperty.call(m, "group_name") ? (m as any).group_name ?? null : undefined,
        group_avatar_url: Object.prototype.hasOwnProperty.call(m, "group_avatar_url")
          ? (m as any).group_avatar_url ?? null
          : undefined,
        remote_id: Object.prototype.hasOwnProperty.call(m, "remote_id") ? (m as any).remote_id ?? null : undefined,
        kind: Object.prototype.hasOwnProperty.call(m, "kind") ? (m as any).kind ?? null : undefined,
        unread_count: nextUnreadCount,
        // Preservar/Atualizar nome e foto se vierem na mensagem
        customer_name: m.remote_sender_name,
        customer_avatar_url: m.remote_sender_avatar_url,
        photo_url: m.remote_sender_avatar_url,
      } as any);
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
      // ✅ CORREÇÃO: Se o chat está aberto, garantir que unread_count seja 0
      const isChatOpen = currentChatIdRef.current === p.chatId;
      
      // Construct update object dynamically to avoid overwriting with undefined
      const update: any = { chatId: p.chatId };
      
      if (p.last_message !== undefined) update.last_message = p.last_message;
      if (p.last_message_at !== undefined) update.last_message_at = p.last_message_at;
      if (p.last_message_from !== undefined) update.last_message_from = p.last_message_from;
      if (p.last_message_type !== undefined) update.last_message_type = p.last_message_type;
      if (p.last_message_media_url !== undefined) update.last_message_media_url = p.last_message_media_url;
      
      if (p.customer_name !== undefined) update.customer_name = p.customer_name;
      if (p.customer_phone !== undefined) update.customer_phone = p.customer_phone;
      
      if (p.group_name !== undefined) update.group_name = p.group_name;
      if (p.group_avatar_url !== undefined) update.group_avatar_url = p.group_avatar_url;
      if (p.customer_avatar_url !== undefined) update.customer_avatar_url = p.customer_avatar_url;
      if (p.photo_url !== undefined) update.photo_url = p.photo_url;
      
      if (p.remote_id !== undefined) update.remote_id = p.remote_id;
      if (p.kind !== undefined) update.kind = p.kind;
      if (p.status !== undefined) update.status = p.status;
      
      if (isChatOpen) {
        update.unread_count = 0;
      } else if (p.unread_count !== undefined) {
        // Se o chat não está aberto, mas temos um valor local de 0 (porque acabamos de ler)
        // e o valor do socket é > 0, talvez o socket esteja atrasado.
        // No entanto, se for uma mensagem NOVA, o unread_count deveria ser incrementado.
        // Para evitar que o contador "volte" para um valor antigo, poderíamos comparar,
        // mas o socket costuma ser a fonte da verdade para o contador global.
        update.unread_count = p.unread_count;
      }
      
      if (p.department_id !== undefined) update.department_id = p.department_id;
      if (p.department_name !== undefined) update.department_name = p.department_name;
      if (p.department_color !== undefined) update.department_color = p.department_color;
      if (p.department_icon !== undefined) update.department_icon = p.department_icon;

      bumpChatToTop(update);
    };

    // Listener para atualiza��o de m�dia em background
    const onMediaReady = (payload: any) => {
      if (!payload?.messageId || (!payload?.media_url && !payload?.media_storage_path && !payload?.media_public_url)) return;
      
      const updateMsg = (msg: Message): Message => {
        if (msg.id !== payload.messageId) return msg;
        return { 
          ...msg, 
          media_url: payload.media_url ?? msg.media_url, 
          media_public_url: payload.media_public_url ?? msg.media_public_url,
          media_storage_path: payload.media_storage_path ?? msg.media_storage_path,
          caption: payload.caption ?? msg.caption,
        };
      };

      // 1. Atualiza estado local (mensagens visíveis)
      setMessages((prev) => prev.map(updateMsg));

      // 2. Atualiza cache global para persistência entre trocas de chat
      messagesCache.forEach((msgs, chatId) => {
        const index = msgs.findIndex(m => m.id === payload.messageId);
        if (index !== -1) {
          const updated = [...msgs];
          updated[index] = updateMsg(updated[index]);
          messagesCache.set(chatId, updated);
        }
      });
    };

    // Listener para mudança de agente de IA
    const onAgentChanged = (payload: any) => {
      const chatId = payload?.chatId;
      if (!chatId) return;
      
      const update = {
        chatId,
        ai_agent_id: payload.ai_agent_id,
        ai_agent_name: payload.ai_agent_name,
      } as any;

      bumpChatToTop(update);
      
      // Atualizar currentChat e selectedChat se for o chat atual
      setCurrentChat((prev) => (prev && prev.id === chatId ? { ...prev, ...update } : prev));
      setSelectedChat((prev) => (prev && prev.id === chatId ? { ...prev, ...update } : prev));
      
      // Atualizar na lista de chats
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, ...update } : chat)));
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
    };

    s.on("message:new", onMessageNew);
    s.on("message:inbound", onMessageNew);  // Tamb�m trata como message:new
    s.on("message:outbound", onMessageNew); // Tamb�m trata como message:new
    s.on("message:status", onMessageStatus);
    s.on("chat:updated", onChatUpdated);
    s.on("message:media-ready", onMediaReady);
    s.on("chat:agent-changed", onAgentChanged);
    s.on("chat:department-changed", onDepartmentChanged);
    s.on("socket.livechat.flow_submission", (p: any) => console.log("[SOCKET] Flow submission:", p));
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
      s.off("socket.livechat.flow_submission");
      s.off("send:interactive_message", onInteractiveMessage);
      // DO NOT disconnect here, as the socket is managed by the parent effect
    };
  }, [
    appendMessageToCache,
    updateMessageStatusInCache,
    bumpChatToTop,
    logSendLatency,
    selectedDepartmentId,
  ]);

  // ✅ JOIN company room when socket is ready AND company is loaded
  useEffect(() => {
    if (!socketReady || !company?.id || !socketRef.current) {
      return;
    }

    const companyId = company.id;
    const socket = socketRef.current;
    
    socket.emit("join", { companyId });
    
    // Cleanup: leave company room on unmount
    return () => {
      if (socket && companyId) {
        socket.emit("leave", { companyId });
      }
    };
  }, [socketReady, company?.id]);

  // Registrar socket no cleanupService e escutar evento de logout
  useEffect(() => {
    // Registrar socket para desconectar no logout
    if (socketRef.current) {
      cleanupService.registerSocket(socketRef.current);
    }
  }, [socketRef.current]);

  useEffect(() => {
    const handleLogout = () => {
      // Limpar cache de mensagens
      messagesCache.clear();
      
      // Limpar metadata de cache
      chatsCacheMetaRef.current = {};
      messagesMetaRef.current = {};
      
      // Limpar store de chats
      chatsStoreRef.current = {};
      currentChatsKeyRef.current = null;
      
      // Resetar estados principais
      setChats([]);
      setMessages([]);
      setCurrentChat(null);
      setSelectedChat(null);
      setSelectedDepartmentId(null);
      setInboxId('');
      setText('');
      setReplyingTo(null);
      setChatTags([]);
      setCompanyUsers([]);
      setMentions([]);
      
      // Limpar drafts
      draftsRef.current.clear();
      
      // Desconectar socket (redundante mas seguro)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };

    window.addEventListener('user:logout', handleLogout);
    
    return () => {
      window.removeEventListener('user:logout', handleLogout);
    };
  }, [messagesCache]);

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
            // MERGE com o estado anterior para preservar nomes e fotos reais
            const merged = normalizedItems.map(nc => {
              const existing = prev.find(p => p.id === nc.id);
              if (!existing) return nc;
              
              // Se o chat está aberto, o unread_count DEVE ser 0
              const isChatOpen = currentChatIdRef.current === nc.id;
              
              return {
                ...nc,
                display_name: pickBetterName(nc.display_name, existing.display_name),
                customer_name: pickBetterName(nc.customer_name, existing.customer_name),
                group_name: pickBetterName(nc.group_name, existing.group_name),
                group_avatar_url: nc.group_avatar_url || existing.group_avatar_url || null,
                customer_avatar_url: nc.customer_avatar_url || existing.customer_avatar_url || null,
                photo_url: (nc as any).photo_url || (existing as any).photo_url || null,
                // Preservar unread_count 0 se o chat estiver aberto ou se já estava 0 localmente
                // Isso evita que o contador "volte" se a API retornar dado atrasado
                unread_count: isChatOpen ? 0 : (existing.unread_count === 0 ? 0 : nc.unread_count),
              };
            });
            nextList = [...merged].sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());
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
        // AbortError é esperado durante navegação rápida - não logar como erro
        if (error?.name === "AbortError") {
          return { items: chatsRef.current, total: chatsTotalRef.current };
        }
        console.error("[livechat] loadChats error", error);
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
        const headers = new Headers({
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        });
        
        const token = getAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const res = await fetch(`${API}/livechat/chats/${chatId}/messages?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          headers,
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
          // 404 = chat não existe ou sem permissão - silenciar (comum após logout/troca de empresa)
          if (res.status === 404) {
            console.debug("[loadMessages] Chat não encontrado ou sem permissão", { chatId });
            // Retornar array vazio para não quebrar a UI
            messagesCache.set(chatId, []);
            messagesMetaRef.current[chatId] = { nextBefore: null, hasMore: false };
            if (currentChatIdRef.current === chatId) {
              setMessages([]);
              setMessagesHasMore(false);
            }
            if (messagesRequestRef.current === requestId) {
              messagesRequestRef.current = null;
            }
            return false;
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
        
        let combined: Message[];
        if (reset) {
          // MERGE: Se for reset, ainda assim queremos manter mensagens que chegaram via socket
          // que podem ser mais novas que as retornadas pela API (race condition)
          const apiIds = new Set(normalizedList.map(m => m.id));
          const socketOnly = existing.filter(m => !apiIds.has(m.id) && !m.id?.startsWith('draft-'));
          combined = sortMessagesAsc([...normalizedList, ...socketOnly]);
        } else {
          combined = mergeMessagesAscending(existing, normalizedList);
        }
        
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
    (selectedChatId: string) => {
      navigate(`/livechat/${selectedChatId}`);
    },
    [navigate],
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
  
  // Handle URL chat selection (both /:chatId and ?openChat=ID)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = chatId || params.get("openChat");

    // Handle section and filter from URL
    const sectionParam = params.get("section");
    if (sectionParam && ["all", "unanswered", "contacts", "campaigns", "flows", "labels"].includes(sectionParam)) {
      setSection(sectionParam as LivechatSection);
    }

    if (chatId === "flows") {
      setSection("flows");
    }


    const filterParam = params.get("filter");
    if (filterParam === "unresponded") {
      setSection("unanswered");
      setStatus("OPEN");
    }

    if (targetId) {
      if (currentChat?.id === targetId) return;

      const existing = chatsRef.current.find((c) => c.id === targetId);
      if (existing) {
        setCurrentChat(existing);
      } else {
        const fetchChat = async () => {
          try {
            const data = await fetchJson<Chat>(`${API}/livechat/chats/${targetId}`);
            if (data) {
              const normalized = normalizeChat(data);
              setChats((prev) => {
                if (prev.some((c) => c.id === normalized.id)) return prev;
                return [normalized, ...prev];
              });
              setCurrentChat(normalized);
            }
          } catch (e) {
            console.error("Failed to fetch chat from URL", e);
          }
        };
        fetchChat();
      }
    } else {
      // Only clear if we are in a state where we expect a chat but none is selected via URL
      // But be careful not to clear if the user just clicked something that hasn't updated URL yet?
      // Actually, if we use navigate(), URL updates first.
      if (currentChat) setCurrentChat(null);
    }
  }, [chatId, location.search, currentChat, setChats, normalizeChat, fetchJson]);


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
        const headers = new Headers();
        const token = getAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const myInboxesRes = await fetch(`${API}/livechat/inboxes/my`, {
          credentials: "include",
          headers
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
              headers
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
          // Check for limit error
          if (response.status === 403 && payload?.code === "LIMIT_REACHED") {
            setLimitData({
              message: payload.message,
              resource: payload.resource,
              limit: payload.limit,
              current: payload.current
            });
            setLimitModalOpen(true);
            // Remove draft
            updateMessageStatusInCache({ chatId: chat.id, draftId, error_reason: "Limit reached", delivery_status: "ERROR" });
            return;
          }

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
    
    // Se está em modo privado, enviar via socket privado
    if (isPrivateMode) {
      const s = socketRef.current;
      if (s?.connected) {
        s.emit(
          "message:private:send",
          { chatId: currentChat.id, text: trimmedText, mentions },
          (response: any) => {
            if (response?.ok === false) {
              console.error("Erro ao enviar mensagem privada:", response.error);
            }
          },
        );
        setText("");
        setMentions([]);
      }
      return;
    }
    
    // Modo normal (público)
    const replyId = replyingTo?.id || null;
    setText("");
    setReplyingTo(null);
    await sendMessageToChat(currentChat, trimmedText, replyId);
  }, [currentChat, text, replyingTo, sendMessageToChat, isPrivateMode, mentions]);

  const handleSendMetaFlow = useCallback(async (flow: any, config: any) => {
    if (!currentChat) return;
    try {
      const token = getAccessToken();
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/api/meta/flows/send`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          inboxId: currentChat.inbox_id,
          chatId: currentChat.id,
          flowId: flow.id,
          ctaText: config.ctaText,
          headerText: config.headerText,
          bodyText: config.bodyText
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao enviar flow");
      }

      const { data: inserted } = await res.json();
      if (inserted) {
        appendMessageToCache({
          ...inserted,
          body: inserted.body || inserted.content,
          sender_name: currentUser?.name || "Você"
        });
      }
      
      setShowFlowPicker(false);
    } catch (error: any) {
      console.error("Failed to send flow:", error);
      alert(error.message);
    }
  }, [currentChat, API]);

  const handleSendMetaTemplate = useCallback(async (template: any, components: any[] = []) => {
    if (!currentChat) return;
    try {
      const token = getAccessToken();
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/api/meta/templates/send`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          inboxId: currentChat.inbox_id,
          chatId: currentChat.id,
          templateName: template.name,
          languageCode: template.language,
          components: components
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao enviar template");
      }

      const { data: inserted } = await res.json();
      if (inserted) {
        appendMessageToCache({
          ...inserted,
          body: inserted.body || inserted.content,
          sender_name: currentUser?.name || "Você"
        });
      }
      
      setShowTemplatePicker(false);
    } catch (error: any) {
      console.error("Failed to send template:", error);
      alert(error.message);
    }
  }, [currentChat, API]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Se está em modo privado, extrair menções
    if (isPrivateMode && newText.includes('@[')) {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const extractedMentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newText)) !== null) {
        extractedMentions.push(match[2]); // match[2] é o user_id
      }
      setMentions(extractedMentions);
    } else if (isPrivateMode) {
      setMentions([]);
    }
  }, [isPrivateMode]);

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
        updateMessageStatusInCache({ chatId, messageId: message.id, merge: { view_status: (message.view_status || undefined) as any } });
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
        // Check for limit error
        if ((payload as any)?.code === "LIMIT_REACHED") {
            setLimitData({
              message: (payload as any).message,
              resource: (payload as any).resource,
              limit: (payload as any).limit,
              current: (payload as any).current
            });
            setLimitModalOpen(true);
            throw new Error("Limite do plano atingido");
        }

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

      // Setup Audio Analysis for volume visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        setVolume(Math.min(average * 2, 100));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
      const pick = (t: string) => (window as any).MediaRecorder?.isTypeSupported?.(t);
      const mimeType = candidates.find(t => pick(t)) || "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const ext = mimeType.startsWith("audio/ogg") ? "ogg" : (mimeType.includes("webm") ? "webm" : "bin");
          const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mimeType });
          await uploadFile(file);
        } catch (e) {
          console.error("Falha ao enviar audio", e);
          alert("Não foi possível enviar o áudio.");
        } finally {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          setIsRecording(false);
          setRecordingTime(0);
          setVolume(0);
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordingTime(0);
      updateVolume();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao iniciar gravação:", err);
      alert("Permita acesso ao microfone para gravar.");
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

  const [isAssigning, setIsAssigning] = useState(false);

  const assignAgent = useCallback(
    async (userId: string | null) => {
      if (!currentChat?.id) return;
      setIsAssigning(true);
      const chatId = currentChat.id;
      try {
        const body = userId ? { userId } : { unassign: true };
        const resp = await fetchJson<{
          assigned_agent_id: string | null;
          assigned_agent_name: string | null;
          assigned_agent_user_id?: string | null;
        }>(`${API}/livechat/chats/${chatId}/assignee`, {
          method: "PUT",
          body: JSON.stringify(body),
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
      } finally {
        setIsAssigning(false);
      }
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
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-red-200 dark:border-red-900 p-8">
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
    <div className="flex-1 flex overflow-hidden livechat-theme h-full">
      {/* Menu Local do Livechat (Coluna de Ícones) - Oculto em mobile */}
      <div className="hidden md:flex w-16 flex-col border-r border-(--color-border) bg-(--color-surface) py-4 shrink-0 z-20">
        <LivechatMenu 
          section={section} 
          onChange={setSection} 
          collapsed={true} 
        />
      </div>

      <section className="flex flex-1 overflow-hidden relative h-full">
        {(section === "all" || section === "unanswered") && (
          <>
            {/* Chat List Column */}
            <div 
              className={`flex flex-col border-r border-(--color-border) bg-(--color-surface) backdrop-blur-sm z-10 h-full relative ${chatId ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}
              style={typeof window !== 'undefined' && window.innerWidth >= 768 ? { width: chatListWidth } : {}}
            >
              <div className="shrink-0 p-3 border-b border-(--color-border)">
                <div className="mb-3 flex items-center gap-2 relative">
                  {/* Global Sidebar Toggle (Mobile Only) */}
                  <button 
                    onClick={() => setMobileOpen(true)}
                    className="md:hidden p-2 hover:bg-accent rounded-xl border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
                  >
                    <FiMenu size={20} />
                  </button>

                  <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-(--color-text-muted)" />
                    <input
                      className="config-input w-full rounded-xl pl-9 pr-3 py-2 text-sm"
                      placeholder="Buscar conversa..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <div ref={filtersContainerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((prev) => !prev)}
                      className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
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
                      <span className="hidden xl:inline">Filtros</span>
                      {activeFilterCount > 0 && (
                        <span
                          className="min-w-5 rounded-full px-1 text-center text-xs font-semibold"
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
                        className="absolute right-0 z-40 mt-2 w-64 rounded-xl border shadow-md"
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
                              className="rounded p-1 text-xs transition-opacity hover:opacity-80"
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
                            className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-80"
                            style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}
                          >
                            Limpar filtros
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltersOpen(false)}
                            className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide"
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
                    className="rounded-full px-3 py-1.5 text-sm font-semibold transition-colors border"
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
                    className="rounded-full px-3 py-1.5 text-sm font-semibold transition-colors border"
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
                className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_12%,var(--color-bg))]
              hover:[&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--color-text)_22%,var(--color-bg))]
            "
              >
                {chatListItems.length === 0 ? (
                  <div className="p-4 text-sm theme-text-muted text-center">
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
                    {chatScope === "groups" ? "Não há mais grupos." : "Não há mais conversas."}
                  </div>
                )}
              </div>
            {/* Chat Area */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-50 transition-colors"
              onMouseDown={startResizing}
            />
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-w-0 h-full">
              {!currentChat ? (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-60">
                  <div className="mb-4 rounded-full bg-gray-100 p-6 dark:bg-gray-800">
                    <FiMessageSquare size={48} />
                  </div>
                  <h3 className="text-lg font-medium">Nenhum chat selecionado</h3>
                  <p className="text-sm">Selecione uma conversa para iniciar o atendimento</p>
                </div>
              ) : (
                <>
              <ChatHeader
                apiBase={API}
                chat={currentChat}
                onToggleInfo={() => setInfoPanelOpen((prev) => !prev)}
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
                onChangeStatus={(next) => {
                  if (currentChat) return updateChatStatus(currentChat.id, next);
                }}
                aiAgentId={currentChat?.ai_agent_id ?? null}
                aiAgentName={(currentChat as any)?.ai_agent_name ?? null}
                onAssignAIAgent={async (agentId) => {
                  if (!currentChat) return;
                  try {
                    const headers = new Headers({ "Content-Type": "application/json" });
                    const token = getAccessToken();
                    if (token) headers.set("Authorization", `Bearer ${token}`);

                    const response = await fetch(`${API}/livechat/chats/${currentChat.id}/ai-agent`, {
                      method: "PUT",
                      headers,
                      credentials: "include",
                      body: JSON.stringify({ agentId }),
                    });
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || "Falha ao atribuir agente de IA");
                    }
                    const updated = await response.json();
                    setCurrentChat((prev: any) => prev ? { ...prev, ai_agent_id: updated.ai_agent_id, ai_agent_name: updated.ai_agent_name } : prev);
                    setSelectedChat((prev: any) => prev ? { ...prev, ai_agent_id: updated.ai_agent_id, ai_agent_name: updated.ai_agent_name } : prev);
                  } catch (error) {
                    console.error("[Livechat] Erro ao atribuir agente de IA:", error);
                    throw error;
                  }
                }}
              />

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-auto p-4 space-y-1.5 scrollbar-thin scrollbar-track-transparent
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
                    Não há mais mensagens no histórico.
                  </div>
                )}
                {messagesLoading && (
                  <div className="py-4 text-center text-sm theme-text-muted">Carregando mensagens...</div>
                )}

                {/* Floating Action: Assign Self */}
                {!messagesLoading && currentChat && !currentChat.assigned_agent_id && (
                  <div className="sticky top-2 z-10 flex justify-center mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full shadow-lg px-4 py-2 flex items-center gap-3 backdrop-blur-sm">
                      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        Ninguém responsável por este chat.
                      </span>
                      <button
                        disabled={isAssigning}
                        onClick={async () => {
                          try {
                            if (currentUser?.id) {
                               await assignAgent(currentUser.id);
                            }
                          } catch (e) {
                            console.error("Failed to self-assign", e);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-sm flex items-center gap-1"
                      >
                        {isAssigning ? "Atribuindo..." : "Assumir atendimento"}
                      </button>
                    </div>
                  </div>
                )}

                {messages.map((m, index) => {
                  const showDateSeparator =
                    index === 0 ||
                    !isSameDay(new Date(m.created_at), new Date(messages[index - 1].created_at));
                  
                  const dateLabel = showDateSeparator ? formatDateSeparator(m.created_at) : null;

                  return (
                    <div key={m.id}>
                      {showDateSeparator && dateLabel && (
                        <div className="flex justify-center my-4">
                          <span className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                            {dateLabel}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        m={m}
                        isAgent={m.sender_type === "AGENT" || m.sender_type === "AI"}
                        mediaItems={mediaItems}
                        mediaIndex={mediaIndexById.get(m.id) ?? undefined}
                        showRemoteSenderInfo={currentChat ? isGroupChat(currentChat) : false}
                        onRetry={retryFailedMessage}
                        onReply={() => setReplyingTo(m)}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onSend={(val) => {
                          if (currentChat) sendMessageToChat(currentChat, val);
                        }}
                        allMessages={messages}
                        customerName={currentChat?.customer_name || currentChat?.display_name || null}
                      />
                    </div>
                  );
                })}

                {!messagesLoading && messages.length === 0 && (
                  <div className="py-4 text-center text-sm theme-text-muted">Nenhuma mensagem.</div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-(--color-border) p-4 bg-(--color-surface) backdrop-blur-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
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
                    variant="ghost"
                    onClick={() => setShowFlowPicker(true)}
                    title="Enviar Meta Flow"
                    aria-label="Enviar Meta Flow"
                  >
                    <FiLayers className="h-5 w-5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTemplatePicker(true)}
                    title="Enviar Template WhatsApp"
                    aria-label="Enviar Template WhatsApp"
                  >
                    <FiFileText className="h-5 w-5" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isRecording ? "danger" : "ghost"}
                      onClick={toggleRecording}
                      title={isRecording ? "Parar gravação" : "Gravar áudio"}
                      aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
                      className={isRecording ? "relative" : ""}
                    >
                      <FiMic className="h-5 w-5 z-10" />
                      {isRecording && (
                        <span 
                          className="absolute inset-0 rounded-md bg-red-500/30 transition-transform duration-75" 
                          style={{ transform: `scale(${1 + volume / 50})` }}
                        />
                      )}
                    </Button>
                    {isRecording && (
                      <span className="text-xs font-mono text-red-500 font-bold">
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>

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
                    className="mb-3 grid max-w-[260px] grid-cols-8 gap-1 rounded-xl border p-2 text-xl shadow"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                    }}
                  >
                    {"????????????????"
                      .split("")
                      .map((e, i) => (
                        <button
                          key={i}
                          className="transition-transform hover:scale-110"
                          onClick={() => addEmoji(e)}
                        >
                          {e}
                        </button>
                      ))}
                  </div>
                )}

                {replyingTo && (
                  <div className="mb-3">
                    <ReplyPreview
                      message={{
                        id: replyingTo.id,
                        content: replyingTo.content || "",
                        type: replyingTo.type || "TEXT",
                        sender_name: replyingTo.sender_name || undefined,
                      }}
                      onCancel={() => setReplyingTo(null)}
                    />
                  </div>
                )}

                {/* 24h Window Warning for Meta */}
                {isMetaChat && !isWindowOpen && !isPrivateMode && (
                  <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <FiAlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Janela de 24h fechada
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/60 mt-0.5">
                        O cliente não entra em contato há mais de 24 horas. Para reativar a conversa no WhatsApp, você deve enviar um <strong>Template</strong> pré-aprovado.
                      </p>
                      <button 
                        onClick={() => setShowTemplatePicker(true)}
                        className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <FiFileText className="w-3 h-3" /> Abrir Templates
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPrivateMode(!isPrivateMode)}
                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                      isPrivateMode
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                    }`}
                    title={isPrivateMode ? "Modo Privado Ativo" : "Ativar Modo Privado"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  
                  {isPrivateMode ? (
                    <MentionInput
                      className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                        isPrivateMode
                          ? "bg-blue-50 border-2 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
                          : "bg-(--color-surface-muted) border border-(--color-border) text-(--color-text)"
                      }`}
                      placeholder={isRecording ? "Gravando áudio..." : "Mensagem privada - use @nome para mencionar"}
                      value={text}
                      onChange={(val, extractedMentions) => {
                        setText(val);
                        setMentions(extractedMentions);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      users={companyUsers}
                      disabled={isRecording}
                      autoFocus
                    />
                  ) : (
                    <input
                      className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                        isMetaChat && !isWindowOpen
                          ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60"
                          : "bg-(--color-surface-muted) border border-(--color-border) text-(--color-text)"
                      } placeholder-(--color-text-muted) focus:outline-none focus:border-(--color-primary)`}
                      placeholder={
                        isRecording 
                          ? "Gravando áudio..." 
                          : (isMetaChat && !isWindowOpen) 
                            ? "Janela fechada - use templates" 
                            : "Digite sua mensagem..."
                      }
                      value={text}
                      onChange={handleTextChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      disabled={isRecording || (isMetaChat && !isWindowOpen)}
                    />
                  )}
                  
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
              </>
              )}
            </div>
            {infoPanelOpen && currentChat && (
              <ContactInfoPanel 
                chat={currentChat} 
                apiBase={API}
                onClose={() => setInfoPanelOpen(false)} 
              />
            )}
          </>
        )}

        {section === "labels" && (
          <div className="flex-1 overflow-hidden p-6 h-full flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <button 
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 hover:bg-accent rounded-xl border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
              >
                <FiMenu size={20} />
              </button>
              <h2 className="text-xl font-semibold">Labels</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <LabelsManager apiBase={API} />
            </div>
          </div>
        )}

        {section === "contacts" && (
          <div className="flex-1 overflow-hidden p-6 h-full flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <button 
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 hover:bg-accent rounded-xl border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
              >
                <FiMenu size={20} />
              </button>
              <h2 className="text-xl font-semibold">Contatos</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContactsCRM apiBase={API} socket={socketRef.current} />
            </div>
          </div>
        )}

        {section === "campaigns" && (
          <div className="flex-1 overflow-hidden p-6 h-full flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <button 
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 hover:bg-accent rounded-xl border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
              >
                <FiMenu size={20} />
              </button>
              <h2 className="text-xl font-semibold">Campanhas</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <CampaignsPanel apiBase={API} />
            </div>
          </div>
        )}

        {section === "flows" && (
          <div className="flex-1 overflow-hidden h-full flex flex-col relative">
            <div className="flex-1 overflow-hidden relative">
              <FlowsPanel apiBase={API} initialFlowId={flowId} />
            </div>
          </div>
        )}



      {/* Limit Modal */}
      <LimitModal 
        isOpen={limitModalOpen} 
        onClose={() => setLimitModalOpen(false)}
        message={limitData.message}
        resource={limitData.resource}
        limit={limitData.limit}
        current={limitData.current}
      />

      {showFirstInboxWizard && (
        <FirstInboxWizard
          onComplete={() => {
            setShowFirstInboxWizard(false);
            fetchJson<Inbox[]>(`${API}/livechat/inboxes/my`)
              .then((rows) => {
                setInboxes(rows || []);
              })
              .catch((err) => {
                console.error("[Livechat] Erro ao recarregar inboxes:", err);
              });
          }}
          onSkip={() => {
            setShowFirstInboxWizard(false);
          }}
        />
      )}

      {showFlowPicker && currentChat && (
        <FlowPicker
          inboxId={currentChat.inbox_id}
          onSelect={handleSendMetaFlow}
          onClose={() => setShowFlowPicker(false)}
        />
      )}

      {showTemplatePicker && currentChat && (
        <MetaTemplatePicker
          inboxId={currentChat.inbox_id}
          onSelect={handleSendMetaTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
        </section>
    </div>
  );
}











