import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { FiCheck, FiCheckSquare, FiMoreVertical, FiTag, FiUserMinus, FiUsers, FiCpu, FiRefreshCw } from "react-icons/fi";
import type { Chat, Tag } from "./types";

type Agent = {
  id: string;
  name: string;
  is_active: boolean;
  integration_openai_id?: string | null;
};

type InboxAgent = {
  id: string;
  user_id: string;
  name: string | null;
  role: string | null;
  avatarUrl: string | null;
};

type FunnelStage = {
  id: string;
  name: string;
  color?: string | null;
};

type ChatHeaderProps = {
  apiBase: string;
  chat: Chat | null;
  inboxId?: string | null;
  tags: Tag[];
  selectedTagIds: string[];
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  onToggleTag?: (tagId: string) => void;
  onAssignAgent?: (userId: string | null) => Promise<void> | void;

  funnelStages?: FunnelStage[];                     // lista de colunas do kanban
  currentStageId?: string | null; 
  currentStageName?: string | null;                // coluna atual do chat
  currentNote?: string | null;                      // observação atual
  onChangeStage?: (stageId: string) => Promise<void> | void;  // callback pra mudar etapa
  onUpdateNote?: (note: string) => Promise<void> | void;      // callback pra salvar nota

  kanbanBoardId?: string | null

  /** Identificador do lead do chat (se existir) */
  chatLeadId?: string | null;

  /** E-mail/telefone do cliente (fallback de matching do card) */
  customerEmail?: string | null;
  customerPhone?: string | null;

  /** Título sugerido do card (fallback se não houver lead): ex.: nome do cliente */
  fallbackCardTitle?: string | null;

  /** Status atual do chat e opções disponíveis para troca */
  currentStatus?: string | null;
  statusOptions?: Array<{ value: string; label: string }>;
  onChangeStatus?: (nextStatus: string) => Promise<void> | void;
};

type DragContext = {
  pointerId: number;
  startX: number;
  startOffset: number;
};

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 1).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  const combo = (first + last).trim();
  return combo ? combo.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function sanitizeRemoteId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/@.*/, "").replace(/[^\w+.-]/g, "");
}

function getCustomerName(c?: Chat | null) {
  if (!c) return null;
  const kind = (c.kind || "").toString().toUpperCase();
  const remoteId = (c.remote_id || "") as string;
  if (kind === "GROUP" || (remoteId && remoteId.endsWith("@g.us"))) {
    return (
      (typeof c.display_name === "string" && c.display_name.trim()) ? c.display_name.trim() :
      c.group_name ??
      c.customer_name ??
      sanitizeRemoteId(c.display_remote_id ?? c.remote_id ?? c.external_id) ??
      sanitizeRemoteId(remoteId) ??
      null
    );
  }
  return (
    (typeof c.display_name === "string" && c.display_name.trim()) ? c.display_name.trim() :
    c.customer_name ??
    (c as any)?.name ??
    sanitizeRemoteId(c.display_remote_id ?? c.remote_id ?? c.external_id) ??
    null
  );
}

function getCustomerPhone(c?: Chat | null) {
  if (!c) return null;
  const kind = (c.kind || "").toString().toUpperCase();
  const remoteId = (c.remote_id || "") as string;
  if (kind === "GROUP" || (remoteId && remoteId.endsWith("@g.us"))) {
    return null;
  }
  const phone =
    c.display_phone ??
    c.customer_phone ??
    (c as any)?.phone ??
    (c as any)?.cellphone ??
    (c as any)?.celular ??
    null;
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, "");
  if (!digits) return String(phone);
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function getChatLeadId(c?: Chat | null) {
  return (
    (c as any)?.lead_id ??
    (c as any)?.leadId ??
    (c as any)?.customer_lead_id ??
    null
  );
}

function buildFallbackCardTitle(c?: Chat | null) {
  const name = getCustomerName(c);
  if (name) return name;
  const phone = getCustomerPhone(c);
  if (phone) return phone;
  const remote =
    sanitizeRemoteId(c?.display_remote_id ?? c?.remote_id ?? c?.external_id) ??
    c?.customer_id ??
    c?.id ??
    null;
  return remote ?? "Chat";
}

const Spinner = () => (
  <span className="h-4 w-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
);

export function ChatHeader({
  apiBase,
  chat,
  inboxId,
  tags,
  selectedTagIds,
  assigneeUserId,
  assigneeName,
  onToggleTag,
  onAssignAgent,

  funnelStages,
  currentStageId,
  currentNote,
  onChangeStage,
  onUpdateNote,
  kanbanBoardId: propKanbanBoardId = null,
  fallbackCardTitle: fallbackCardTitleProp = null,
  currentStatus = null,
  statusOptions = [],
  onChangeStatus,
}: ChatHeaderProps) {
  const [overlayMode, setOverlayMode] = useState<"menu" | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [agents, setAgents] = useState<InboxAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const minOffsetRef = useRef(0);
  const dragRef = useRef<DragContext | null>(null);

  const effectiveInboxId = inboxId ?? chat?.inbox_id ?? null;

  const computedFallbackCardTitle = useMemo(() => {
    if (typeof fallbackCardTitleProp === "string") return fallbackCardTitleProp;
    return buildFallbackCardTitle(chat);
  }, [fallbackCardTitleProp, chat]);

  const isGroupChat = useMemo(() => {
    if (!chat) return false;
    const kind = (chat.kind || "").toString().toUpperCase();
    if (kind === "GROUP") return true;
    const remoteId = (chat.remote_id || chat.external_id || "") as string;
    return typeof remoteId === "string" && remoteId.endsWith("@g.us");
  }, [chat]);

  const headerName = useMemo(() => {
    if (!chat) return null;
    if (isGroupChat) {
      return (
        chat.group_name ||
        chat.customer_name ||
        (chat as any)?.name ||
        chat.remote_id ||
        chat.external_id ||
        chat.id
      );
    }
    return (
      chat.customer_name ||
      (chat as any)?.name ||
      computedFallbackCardTitle ||
      chat.customer_phone ||
      chat.id
    );
  }, [chat, isGroupChat, computedFallbackCardTitle]);

  const headerSubtitle = useMemo(() => {
    if (!chat) return null;
    if (isGroupChat) {
      const remote = (chat.remote_id || chat.external_id || "") as string;
      return remote || null;
    }
    return chat.customer_phone || null;
  }, [chat, isGroupChat]);

  const headerSecondary = useMemo(() => {
    if (!chat) return null;
    if (headerSubtitle) return headerSubtitle;
    if (!isGroupChat && chat.customer_id) {
      return chat.customer_id.slice(0, 8);
    }
    if (isGroupChat) {
      return chat.remote_id || chat.external_id || null;
    }
    return null;
  }, [chat, headerSubtitle, isGroupChat]);

  const headerAvatarUrl = useMemo(() => {
    if (!chat) return null;
    if (isGroupChat) {
      return chat.group_avatar_url || null;
    }
    return chat.customer_avatar_url || (chat as any)?.avatar || null;
  }, [chat, isGroupChat]);

  // Debug leve do avatar do cabeçalho
  useEffect(() => {
    if (!chat) return;
    console.debug("[UI][Header] avatar computed", {
      chatId: chat.id,
      isGroup: isGroupChat,
      url: headerAvatarUrl,
    });
  }, [chat?.id, isGroupChat, headerAvatarUrl]);

  const headerInitials = useMemo(() => {
    const source = headerName || headerSecondary || headerSubtitle || chat?.id || "?";
    return source.slice(0, 2).toUpperCase();
  }, [headerName, headerSecondary, headerSubtitle, chat?.id]);

  // Status efetivo considera a prop currentStatus (vinda do pai) antes do chat.status
  const effectiveStatus = useMemo(() => {
    const raw = (currentStatus ?? chat?.status ?? "").toString();
    return raw.toUpperCase();
  }, [currentStatus, chat?.status]);

  const assignedTags = useMemo(() => {
    if (!selectedTagIds.length) return [] as Tag[];
    const map = new Map(tags.map((tag) => [tag.id, tag]));
    return selectedTagIds.map((id) => {
      const tag = map.get(id);
      return tag ?? { id, name: id, color: "#6B7280" };
    });
  }, [tags, selectedTagIds]);

  const tagsTrackCount = assignedTags.length;
  const menuOpen = overlayMode === "menu";

  const clampOffset = useCallback((value: number) => {
    return Math.max(minOffsetRef.current, Math.min(0, value));
  }, []);

  const recomputeBounds = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) {
      minOffsetRef.current = 0;
      setOffset(0);
      return;
    }
    const min = Math.min(0, container.clientWidth - track.scrollWidth);
    minOffsetRef.current = min;
    setOffset((prev) => clampOffset(prev));
  }, [clampOffset]);

  // [KANBAN-STAGE] Estados para painel de etapas/nota
  const [etapasOpen, setEtapasOpen] = useState(false);
  const [stageDraft, setStageDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [savingEtapas, setSavingEtapas] = useState(false);
  const [etapasError, setEtapasError] = useState<string | null>(null);
  // BoardId efetivo: usa a prop se vier; senão busca do backend
  const [boardId, setBoardId] = useState<string | null>(propKanbanBoardId);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [changingAgent, setChangingAgent] = useState(false);

  // Busca /kanban/my-board se não vier por prop
  useEffect(() => {
  if (boardId) return;
  let alive = true;
  (async () => {
    try {
      const res = await fetch(`${apiBase}/kanban/my-board`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (alive) setBoardId(data?.id ?? null);
    } catch {}
  })();
  return () => { alive = false; };
}, [apiBase, boardId]);

  // Busca agentes de IA disponíveis
  useEffect(() => {
    if (!chat || effectiveStatus !== "AI") {
      setAvailableAgents([]);
      return;
    }
    
    let alive = true;
    setLoadingAgents(true);
    
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/agents?active=true`, {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        // Some proxies may return 304 when ETag matches; treat it as empty update rather than error
        if (!res.ok && res.status !== 304) throw new Error("Failed to load agents");
        const data = res.status === 304 ? [] : await res.json();
        if (alive) {
          // Filtrar apenas agentes com integração OpenAI configurada e status ACTIVE
          const validAgents = Array.isArray(data)
            ? data.filter((a: any) => {
                const isActive = (a && typeof a.is_active === "boolean")
                  ? a.is_active
                  : String(a?.status || "").toUpperCase() === "ACTIVE";
                const hasOpenAI = a?.integration_openai_id != null;
                return isActive && hasOpenAI;
              })
            : [];
          setAvailableAgents(validAgents);
        }
      } catch (error) {
        console.error("Failed to load AI agents:", error);
        if (alive) setAvailableAgents([]);
      } finally {
        if (alive) setLoadingAgents(false);
      }
    })();
    
    return () => { alive = false; };
  }, [apiBase, chat?.id, effectiveStatus]);

  const handleChangeAgent = useCallback(async (agentId: string | null) => {
    if (!chat) return;
    
    // Validar se agente selecionado está na lista de disponíveis
    if (agentId) {
      const agent = availableAgents.find(a => a.id === agentId);
      if (!agent) {
        alert("Agente selecionado não está disponível ou ativo");
        return;
      }
      if (!agent.integration_openai_id) {
        alert("Agente selecionado não possui integração OpenAI configurada");
        return;
      }
    }
    
    setChangingAgent(true);
    try {
      const res = await fetch(`${apiBase}/livechat/chats/${chat.id}/ai-agent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change agent");
      }
      
      const updated = await res.json();
      
      // Atualizar o chat local (será sobrescrito pelo socket)
      (chat as any).ai_agent_id = updated.ai_agent_id;
      (chat as any).ai_agent_name = updated.ai_agent_name;
      
    } catch (error) {
      console.error("Failed to change AI agent:", error);
      alert(error instanceof Error ? error.message : "Falha ao trocar agente");
    } finally {
      setChangingAgent(false);
    }
  }, [apiBase, chat, availableAgents]);



  const effectiveStageId = useMemo(
    () => currentStageId ?? chat?.stage_id ?? null,
    [currentStageId, chat?.stage_id, chat?.id],
  );
  const effectiveNote = useMemo(() => {
    if (typeof currentNote === "string") return currentNote;
    return chat?.note ?? "";
  }, [currentNote, chat?.note, chat?.id]);

  useEffect(() => {
    setStageDraft(effectiveStageId);
  }, [effectiveStageId]);

  useEffect(() => {
    setNoteDraft(effectiveNote);
  }, [effectiveNote]);

  const normalizedStageDraft = stageDraft || null;
  const stageChanged =
    normalizedStageDraft !== null && normalizedStageDraft !== effectiveStageId;
  const noteChanged = noteDraft !== effectiveNote;

  const canEditStage =
    Array.isArray(funnelStages) && funnelStages.length > 0 &&
    typeof onChangeStage === "function";
  const canEditNote = typeof onUpdateNote === "function";
  const canUpdateStage = stageChanged && canEditStage;
  const canUpdateNote = noteChanged && canEditNote;
  const etapasDisabled = !canEditStage && !canEditNote;

  const closeOverlay = useCallback(() => {
    setOverlayMode(null);
    setAgentsOpen(false);
    setAssignError(null);
    setAssigningUserId(null);
    setEtapasOpen(false);
    setEtapasError(null);
    setSavingEtapas(false);
    setStageDraft(effectiveStageId);
    setNoteDraft(effectiveNote);
  }, [effectiveStageId, effectiveNote]);

  useEffect(() => {
    if (!tagsOpen) return;
    const frame = requestAnimationFrame(() => recomputeBounds());
    return () => cancelAnimationFrame(frame);
  }, [tagsOpen, assignedTags, recomputeBounds]);

  useEffect(() => {
    if (!tagsOpen) return;
    const handleResize = () => recomputeBounds();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [tagsOpen, recomputeBounds]);

  useEffect(() => {
    setOverlayMode(null);
    setTagsOpen(false);
    setAgentsOpen(false);
    setOffset(0);
    setAgents([]);
    setAssignError(null);
    setAssigningUserId(null);
    setEtapasOpen(false);
    setSavingEtapas(false);
    setEtapasError(null);
    setStageDraft((currentStageId ?? chat?.stage_id ?? null) || null); // <- se você tiver stage no chat
  }, [chat?.id]);

  useEffect(() => {
    if (!effectiveInboxId) {
      setAgentsOpen(false);
      setAgents([]);
    }
  }, [effectiveInboxId]);


  useEffect(() => {
    if (!agentsOpen) {
      setAssignError(null);
      setAssigningUserId(null);
    }
  }, [agentsOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeOverlay]);

  useEffect(() => {
    if (!agentsOpen || !effectiveInboxId) return;
    let cancelled = false;
    setAgentsLoading(true);
    setAgentsError(null);
    fetch(`${apiBase}/livechat/inboxes/${effectiveInboxId}/agents`, {
      credentials: "include",
    })
      .then(async (res) => {
        let json: any = null;
        try {
          json = await res.json();
        } catch (_) {
          json = null;
        }
        if (!res.ok) {
          const message =
            (json && typeof json.error === "string" && json.error) ||
            res.statusText ||
            "Falha ao carregar agentes";
          throw new Error(message);
        }
        const rawList = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];
        const mapped: InboxAgent[] = rawList
          .map((entry: any, index: number) => {
            const userId = entry?.user_id || entry?.userId || entry?.id || entry?.authuser_id || null;
            if (!userId) return null;
            const rawName =
              entry?.name ||
              entry?.full_name ||
              entry?.display_name ||
              entry?.user_name ||
              entry?.user?.name ||
              entry?.user_id ||
              entry?.id ||
              null;
            const name = rawName ? String(rawName) : String(userId);
            const role = entry?.role ?? entry?.user_role ?? null;
            const avatarUrl = entry?.avatarUrl ?? entry?.avatar_url ?? entry?.avatar ?? null;
            return {
              id: String(entry?.id ?? entry?.user_id ?? index),
              user_id: String(userId),
              name,
              role: role ? String(role) : null,
              avatarUrl: avatarUrl ? String(avatarUrl) : null,
            } as InboxAgent;
          })
          .filter(Boolean) as InboxAgent[];
        return mapped;
      })
      .then((items) => {
        if (!cancelled) setAgents(items);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setAgents([]);
        setAgentsError(
          typeof error?.message === "string" ? error.message : "Falha ao carregar agentes",
        );
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentsOpen, effectiveInboxId, apiBase]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tagsOpen || !tagsTrackCount) return;
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: offset,
    };
    setIsDragging(true);
    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    setOffset(clampOffset(drag.startOffset + dx));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const container = containerRef.current;
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
    setOffset((prev) => clampOffset(prev));
  };

  const handleMenuToggle = () => {
    setOverlayMode((prev) => {
      if (prev === "menu") {
        setTagsOpen(false);
        setAgentsOpen(false);
        setAssignError(null);
        setAssigningUserId(null);
        return null;
      }
      return "menu";
    });
  };

  const toggleTagsPanel = () => {
    setOverlayMode("menu");
    setAgentsOpen(false);
    setAssignError(null);
    setTagsOpen((prev) => !prev);
  };

  const toggleAgentsPanel = () => {
    if (!effectiveInboxId || !onAssignAgent) return;
    setOverlayMode("menu");
    setTagsOpen(false);
    setAssignError(null);
    setAgentsOpen((prev) => {
      const next = !prev;
      if (!prev) {
        setAgentsError(null);
      }
      return next;
    });
  };

  const handleToggleTag = (tagId: string) => {
    onToggleTag?.(tagId);
  };

  // [KANBAN-STAGE] Abre/fecha painel de Etapas
  const toggleEtapasPanel = () => {
    setOverlayMode("menu");
    setTagsOpen(false);
    setAgentsOpen(false);
    setAssignError(null);
    setEtapasError(null);
    setEtapasOpen((prev) => !prev);
    setStageDraft(effectiveStageId);
    setNoteDraft(effectiveNote);
  };

    // [KANBAN-STAGE] Garante card e move etapa (ou cria se não existir)
  async function ensureCardAndMoveStage(stageId: string, note?: string) {
    if (!apiBase) throw new Error("apiBase não configurado");
    if (!stageId) throw new Error("Etapa (stageId) inválida");
    if (!chat) throw new Error("Chat não selecionado");
    if (!propKanbanBoardId) throw new Error("kanbanBoardId ausente");

    // Tenta extrair lead_id de várias fontes
    const chatLeadIdFromChat = (chat as any).lead_id || (chat as any).leadId;
    const leadIdToUse = chatLeadId || chatLeadIdFromChat || chat.customer_id;

    console.log('[ChatHeader] ensureCardAndMoveStage', {
      stageId,
      chatLeadId,
      chatLeadIdFromChat,
      customer_id: chat.customer_id,
      leadIdToUse,
      customerPhone,
    });

    const payload = {
      boardId: propKanbanBoardId,
      columnId: stageId,
      // fontes para identificar ou criar card:
      leadId: leadIdToUse,
      // props explícitas têm prioridade
      explicitLeadId: undefined as string | undefined,
      phone: (typeof customerPhone === "string" ? customerPhone : (chat as any)?.customer_phone) || undefined,
      // título de fallback
      title:
        (typeof computedFallbackCardTitle === "string" && computedFallbackCardTitle) ||
        chat.customer_name ||
        chat.customer_phone ||
        chat.customer_id ||
        "Oportunidade",
      // Anotação/observação opcional
      note: typeof note === "string" ? note : undefined,
    };

    // se o prop chatLeadId veio, usa como preferencial
    if (typeof chatLeadId === "string") payload.explicitLeadId = chatLeadId;

    // tira undefineds do payload pra não sujar o backend
    const clean: any = {};
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") clean[k] = v;
    });

    console.log('[ChatHeader] Payload enviado:', clean);

    const res = await fetch(`${apiBase}/kanban/cards/ensure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(clean),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || res.statusText || "Falha ao garantir/mover card");
    }
    // opcional: json retorna { cardId, created: boolean, updated: boolean }
    return json;
  }

  // === Constantes que você usa no restante do componente ===
const customerPhone = getCustomerPhone(chat);
const chatLeadId = getChatLeadId(chat);


  // [KANBAN-STAGE] Salvar alterações (etapa + nota)
    // [KANBAN-STAGE] Salvar alterações (etapa + nota)
  const handleSaveEtapas = async () => {
    if (savingEtapas) return;
    setEtapasError(null);

    const shouldUpdateStage = canUpdateStage;
    const shouldUpdateNote = canUpdateNote;

    if (!shouldUpdateStage && !shouldUpdateNote) {
      setEtapasOpen(false);
      closeOverlay();
      return;
    }

    setSavingEtapas(true);
    try {
      // 1) Se mudou etapa:
      if (shouldUpdateStage && normalizedStageDraft) {
        if (typeof onChangeStage === "function") {
          // Componente pai cuida (compat retro)
          await onChangeStage(normalizedStageDraft);
        } else {
          // Default: garante card e move no Kanban
          await ensureCardAndMoveStage(normalizedStageDraft, noteDraft);
        }
      }

      // 2) Se mudou observação:
      if (shouldUpdateNote) {
        if (typeof onUpdateNote === "function") {
          await onUpdateNote(noteDraft);
        } else {
          // opcional: se não tiver callback, salva nota no chat (se tua API tiver)
          try {
            if (chat?.id) {
              await fetch(`${apiBase}/livechat/chats/${chat.id}/note`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ note: noteDraft }),
              });
            }
          } catch {
            /* Ignora silent */
          }
        }
      }

      setEtapasOpen(false);
      closeOverlay();
    } catch (err: any) {
      setEtapasError(
        typeof err?.message === "string" ? err.message : "Falha ao salvar etapa/observacao",
      );
    } finally {
      setSavingEtapas(false);
    }
  };



  const handleSelectAgent = async (userId: string | null) => {
    if (!onAssignAgent) return;
    setAssignError(null);
    setAssigningUserId(userId ?? "__none__");
    try {
      await onAssignAgent(userId);
      setAgentsOpen(false);
      closeOverlay();
    } catch (error: any) {
      setAssignError(
        typeof error?.message === "string" ? error.message : "Falha ao atualizar responsável",
      );
    } finally {
      setAssigningUserId(null);
    }
  };

  const tagsVisible = tagsOpen && tagsTrackCount > 0;
  const tagIndicatorVisible = !tagsVisible && tagsTrackCount > 0;
  const tagsContainerClasses = `flex items-center justify-end overflow-hidden transition-all duration-200 ease-out select-none ${tagsVisible ? "pointer-events-auto max-w-[400px] opacity-100 pr-2 ml-2" : "pointer-events-none max-w-0 opacity-0 pr-0 ml-0"
    }`;

  const effectiveAssigneeId = assigneeUserId ?? chat?.assigned_agent_user_id ?? null;
  const currentAssigneeName = assigneeName ?? chat?.assigned_agent_name ?? null;

  const actionButtons = [
    {
      id: "tags",
      label: tagsOpen ? "Ocultar tags" : "Mostrar tags",
      icon: FiTag,
      onClick: toggleTagsPanel,
      active: tagsOpen,
      disabled: tags.length === 0 && selectedTagIds.length === 0,
    },
    {
      id: "assignees",
      label: agentsOpen ? "Ocultar responsáveis" : "Responsáveis da inbox",
      icon: FiUsers,
      onClick: toggleAgentsPanel,
      active: agentsOpen,
      disabled: !effectiveInboxId || !onAssignAgent,
    },
    {
      id: "stages",
      label: etapasOpen ? "Ocultar etapas" : "Etapas do funil",
      icon: FiCheckSquare, // [KANBAN-STAGE]
      onClick: toggleEtapasPanel, // [KANBAN-STAGE]
      active: etapasOpen,         // [KANBAN-STAGE]
      disabled: etapasDisabled, // [KANBAN-STAGE]
    },
  ];

  

  return (
    <div className="relative flex flex-col gap-2 mb-3">
      {(overlayMode || agentsOpen || etapasOpen) && (
        <button
          type="button"
          aria-label="Fechar menu"
          className={`fixed inset-0 z-40 transition-opacity duration-200 ${(overlayMode || agentsOpen || tagsOpen || etapasOpen) ? "opacity-100" : "opacity-0"
            }`}
          onClick={closeOverlay}
        >
          <span
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "var(--color-overlay)" }}
          />
        </button>
      )}

      <div className="flex items-center gap-3 relative z-50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {chat ? (
            <>
              {headerAvatarUrl ? (
                <img
                  src={headerAvatarUrl}
                  alt={headerName || "Avatar"}
                  className="h-9 w-9 rounded-full object-cover"
                  onLoad={(e) => {
                    console.debug("[UI][Header] avatar loaded", { chatId: chat?.id, url: headerAvatarUrl });
                  }}
                  onError={(event) => {
                    console.warn("[UI][Header] avatar failed", { chatId: chat?.id, url: headerAvatarUrl });
                    (event.currentTarget as HTMLImageElement).src = "";
                  }}
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {headerInitials}
                </div>
              )}
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  style={{ color: "var(--color-heading)" }}
                >
                  {headerName || "Desconhecido"}
                </div>
                {headerSecondary && (
                  <div
                    className="text-xs truncate"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {headerSecondary}
                  </div>
                )}
                {currentAssigneeName && (
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Responsável: <span className="font-medium" style={{ color: "var(--color-text)" }}>{currentAssigneeName}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              className="font-semibold"
              style={{ color: "var(--color-heading)" }}
            >
              Selecione um chat
            </div>
          )}
        </div>

        {chat && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2">
              {tagIndicatorVisible && (
                <div className="flex items-center gap-1">
                  {assignedTags.map((tag) => (
                    <span
                      key={`indicator-${tag.id}`}
                      className="h-6 w-1 rounded-full"
                      style={{ backgroundColor: tag.color || "#6B7280" }}
                    />
                  ))}
                </div>
              )}

              {/* AI agent selector/pill */}
              {chat && effectiveStatus === "AI" && (
                <div className="flex items-center gap-2">
                  <label
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Agente IA
                  </label>
                  <select
                    className="rounded-lg border px-2 py-1.5 text-xs font-medium outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{
                      borderColor: "var(--color-primary)",
                      backgroundColor: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
                      color: "var(--color-primary)",
                    }}
                    value={(chat as any).ai_agent_id || ""}
                    onChange={(e) => handleChangeAgent(e.target.value || null)}
                    disabled={changingAgent || loadingAgents}
                  >
                    {loadingAgents ? (
                      <option value="">Carregando...</option>
                    ) : availableAgents.length === 0 ? (
                      <option value="">Nenhum agente disponível</option>
                    ) : (chat as any).ai_agent_id ? (
                      <option value="">Sem agente</option>
                    ) : (
                      <option value="" disabled>
                        Selecione um agente
                      </option>
                    )}
                    {availableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  {changingAgent && (
                    <FiRefreshCw
                      className="h-3 w-3 animate-spin"
                      style={{ color: "var(--color-primary)" }}
                    />
                  )}
                </div>
              )}

              {/* AI agent pill (inactive) */}
              {chat && effectiveStatus !== "AI" && (chat as any).ai_agent_name && (
                <button
                  type="button"
                  onClick={() => {
                    if (onChangeStatus) {
                      onChangeStatus("AI");
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border opacity-50 cursor-pointer hover:opacity-70 transition-all text-xs"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
                    color: "var(--color-text)",
                  }}
                  title="Clique para ativar o agente IA"
                >
                  <FiCpu className="h-3.5 w-3.5" />
                  <span className="font-medium">{(chat as any).ai_agent_name}</span>
                </button>
              )}

              {/* Status selector */}
              {chat && statusOptions && statusOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <label
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Status
                  </label>
                  <select
                    className="rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors hover:opacity-90"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                    value={(currentStatus || chat.status || "").toString().toUpperCase()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && onChangeStatus) onChangeStatus(v);
                    }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                ref={containerRef}
                className={tagsContainerClasses}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
              >
                <div
                  ref={trackRef}
                  className="flex items-center gap-2 whitespace-nowrap"
                  style={{
                    transform: `translateX(${offset}px)`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out",
                    willChange: "transform",
                  }}
                >
                  {assignedTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 rounded-full text-xs font-medium border backdrop-blur"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
                        borderColor: tag.color || "#6B7280",
                        color: tag.color || "#065F46",
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {assignedTags.length === 0 && (
                    <span
                      className="text-[11px] pr-1"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Nenhuma tag vinculada
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="relative">
              {agentsOpen && (
                <div
                  className="absolute right-[calc(100%+0.75rem)] top-0 z-40 w-60 max-h-72 overflow-y-auto rounded-xl p-3 shadow-xl flex flex-col gap-2"
                  style={{ backgroundColor: "var(--color-surface)" }}
                >
                  {agentsLoading ? (
                    <div
                      className="py-6 text-center text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Carregando agentes...
                    </div>
                  ) : agentsError ? (
                    <div className="py-2 text-xs text-red-500">{agentsError}</div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm border transition-all ${assigningUserId === "__none__" ? "opacity-60" : "hover:opacity-90"}`}
                        style={
                          !effectiveAssigneeId
                            ? {
                                borderColor: "color-mix(in srgb, var(--color-highlight) 60%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--color-highlight) 18%, transparent)",
                                color: "var(--color-highlight)",
                              }
                            : {
                                borderColor: "transparent",
                                backgroundColor: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
                                color: "var(--color-text)",
                              }
                        }
                        onClick={() => handleSelectAgent(null)}
                        disabled={assigningUserId !== null || !onAssignAgent}
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <FiUserMinus className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-left">
                          Nenhum responsável
                        </span>
                        {assigningUserId === "__none__" ? <Spinner /> : !effectiveAssigneeId && <FiCheck className="h-4 w-4" />}
                      </button>

                      {agents.length === 0 && (
                        <div
                          className="py-4 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Nenhum agente vinculado à inbox.
                        </div>
                      )}

                      {agents.map((agent) => {
                        const isSelected = effectiveAssigneeId === agent.user_id;
                        const isAssigning = assigningUserId === agent.user_id;
                        return (
                          <button
                            key={agent.id || agent.user_id}
                            type="button"
                            className={`flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm border transition-all ${isAssigning ? "opacity-60" : "hover:opacity-90"}`}
                            style={
                              isSelected
                                ? {
                                    borderColor: "color-mix(in srgb, var(--color-highlight) 60%, transparent)",
                                    backgroundColor: "color-mix(in srgb, var(--color-highlight) 18%, transparent)",
                                    color: "var(--color-highlight)",
                                  }
                                : {
                                    borderColor: "transparent",
                                    backgroundColor: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
                                    color: "var(--color-text)",
                                  }
                            }
                            onClick={() => handleSelectAgent(agent.user_id)}
                            disabled={assigningUserId !== null || !onAssignAgent}
                          >
                            {agent.avatarUrl ? (
                              <img
                                src={agent.avatarUrl}
                                alt={agent.name ?? "Agente"}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: "color-mix(in srgb, var(--color-highlight) 15%, white 85%)",
                                  color: "var(--color-highlight)",
                                }}
                              >
                                {initialsFrom(agent.name)}
                              </span>
                            )}
                            <span className="flex-1 text-left">
                              <span className="block truncate">{agent.name}</span>
                              {agent.role && (
                                <span
                                  className="block text-[11px]"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {agent.role}
                                </span>
                              )}
                            </span>
                            {isAssigning ? <Spinner /> : isSelected && <FiCheck className="h-4 w-4" />}
                          </button>
                        );
                      })}

                      {assignError && (
                        <div className="text-[11px] text-red-500">{assignError}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {etapasOpen && (
                <div
                  className="absolute right-[calc(100%+0.75rem)] top-0 z-40 w-[320px] max-h-[75vh] overflow-y-auto rounded-xl p-3 shadow-xl flex flex-col gap-3"
                  style={{ backgroundColor: "var(--color-surface)" }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    Etapas do funil
                  </div>

                  {/* SELECT de etapa */}
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Etapa (coluna do Kanban)
                    </label>
                    <select
                      className="rounded-lg border px-2 py-2 text-sm outline-none focus:border-[color:color-mix(in srgb,var(--color-highlight) 55%,transparent)]"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
                      }}
                      value={stageDraft ?? ""}
                      onChange={(e) => setStageDraft(e.target.value || null)}
                      disabled={!canEditStage}
                    >
                      <option value="">Selecione uma etapa</option>
                      {(funnelStages || []).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Textarea de observação */}
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Observação
                    </label>
                    <textarea
                      className="min-h-[100px] resize-y rounded-lg border px-2 py-2 text-sm outline-none focus:border-[color:color-mix(in srgb,var(--color-highlight) 55%,transparent)]"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
                      }}
                      placeholder="Adicione uma observação..."
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      disabled={!canEditNote}
                    />
                  </div>

                  {etapasError && <div className="text-[11px] text-[color:color-mix(in srgb,crimson 70%,white 30%)]">{etapasError}</div>}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 text-sm rounded-lg border hover:opacity-85"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
                      }}
                      onClick={() => {
                        setEtapasOpen(false);
                        setStageDraft(effectiveStageId);
                        setNoteDraft(effectiveNote);
                        setEtapasError(null);
                      }}
                      disabled={savingEtapas}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 text-sm rounded-lg border hover:opacity-90 disabled:opacity-60"
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-highlight) 60%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--color-highlight) 18%, transparent)",
                        color: "var(--color-highlight)",
                      }}
                      onClick={handleSaveEtapas}
                      disabled={savingEtapas || (!canUpdateStage && !canUpdateNote)}
                    >
                      {savingEtapas ? "Salvando..." : "Salvar"}
                    </button>
                  </div>

                  {/* [KANBAN-STAGE] TODOs para backend:
        - onChangeStage(stageDraft!): atualiza a coluna no Kanban (mover card)
        - onUpdateNote(noteDraft): persiste a observação do chat
        - Opcional: retornar dados atualizados do chat e refletir no estado global
    */}
                </div>
              )}


              <div
                className={`absolute right-0 top-full mt-2 flex flex-col gap-2 transition-all duration-200 ${menuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
              >
                {actionButtons.map((action, index) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-end gap-2"
                    style={{ transitionDelay: menuOpen ? `${index * 60}ms` : "0ms" }}
                  >
                    <span
                      className="text-xs font-medium backdrop-blur px-2 py-1 rounded-lg shadow"
                      style={{
                        color: "var(--color-text)",
                        backgroundColor: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
                      }}
                    >
                      {action.label}
                    </span>
                    <button
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-full border transition-all disabled:opacity-40 hover:opacity-90"
                      style={
                        action.active
                          ? {
                              backgroundColor: "color-mix(in srgb, var(--color-highlight) 18%, transparent)",
                              borderColor: "color-mix(in srgb, var(--color-highlight) 45%, transparent)",
                              color: "var(--color-highlight)",
                            }
                          : {
                              backgroundColor: "var(--color-surface)",
                              borderColor: "var(--color-border)",
                              color: "var(--color-text-muted)",
                            }
                      }
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      <action.icon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
        className="h-9 w-9 flex items-center justify-center rounded-full border transition-all hover:opacity-95"
        style={
          menuOpen
            ? {
                backgroundColor: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }
            : {
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }
        }
                onClick={handleMenuToggle}
                aria-expanded={menuOpen}
                aria-label="Mais ações"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {tagsOpen && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {tags.length === 0 ? (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nenhuma tag disponível para esta empresa.
              </span>
            ) : (
              tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                const baseColor = tag.color || "#6B7280";
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className="px-3 py-1.5 rounded-full text-xs border transition-all hover:opacity-90"
                    style={
                      selected
                        ? {
                            backgroundColor: baseColor,
                            borderColor: baseColor,
                            color: "var(--color-heading)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                          }
                        : {
                            backgroundColor: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                            borderColor: baseColor,
                            color: "var(--color-text)",
                          }
                    }
                  >
                    {tag.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

