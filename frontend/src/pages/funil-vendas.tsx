import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { FaPlus, FaTimes, FaUser, FaEnvelope, FaPhoneAlt, FaTag, FaEdit, FaCamera } from "react-icons/fa";
import { NewColumnForm } from "../componets/funil/NewColumnForm";
import type { Column, Card, LeadListItem } from "./funil/types";
import { LeadPicker } from "../componets/funil/LeadPicker";
import { ClienteForm } from "../componets/clientes/ClienteForm";
import { LoadingOverlay } from "../componets/ui/LoadingOverlay";
import { CardImageCapture } from "../componets/funil/CardImageCapture";
import { CardImageGallery } from "../componets/funil/CardImageGallery";
import { useImageUpload, type UploadedPhoto } from "../hooks/useImageUpload";
import { useNavigate } from "react-router-dom";
import { KanbanSetupModal } from "../componets/funil/KanbanSetupModal";
import { TaskModal } from "../components/tasks/TaskModal";
import { LeadTaskBadge } from "../components/tasks/LeadTaskBadge";
import type { CreateTaskInput, UpdateTaskInput } from "../types/tasks";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

// util
const currency = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const parseNumericInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

type UserRole = "MANAGER" | "ADMIN" | "AGENT" | "TECHNICIAN" | "SUPERVISOR";

interface User {
  id: string;
  name: string;
  role: UserRole;
  roleLabel?: string;
}

type CardFormState = {
  value: string;
  source: string;
  notes: string;
};

const EMPTY_CARD_FORM: CardFormState = {
  value: "",
  source: "",
  notes: "",
};

export function SalesFunnel() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selected, setSelected] = useState<Card | null>(null);
  const selectedRef = useRef<Card | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const [showAddColumn, setShowAddColumn] = useState(false);
  const [leadFor, setLeadFor] = useState<string | null>(null);
  const [leadModeNew, setLeadModeNew] = useState(false);

  // Deixa UserOption alinhado ao UserRole

  type ProposalOption = { id: string; number: string; title: string; description: string | null; totalValue: number };

  const [users, setUsers] = useState<User[]>([]);
  const [editColModal, setEditColModal] = useState<null | { id: string }>(null);
  const [colDraft, setColDraft] = useState<{ title: string; color: string; position: number } | null>(null);

  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [draggingCard, setDraggingCard] = useState<null | { id: string; fromColumnId: string }>(null);
  const [cardDropIndicator, setCardDropIndicator] = useState<
    null | { columnId: string; cardId: string | null; position: "before" | "after" | "end" }
  >(null);

  const [leadProposals, setLeadProposals] = useState<ProposalOption[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Estados para fotos
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [cardPhotos, setCardPhotos] = useState<UploadedPhoto[]>([]);

  // Estados para tarefas
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForLeadId, setTaskForLeadId] = useState<string | null>(null);

  const onColumnCreated = useCallback((col: Column) => {
    setColumns((prev) => [...prev, col].sort((a, b) => a.position - b.position));
    setShowAddColumn(false);
  }, []);

  const socketRef = useRef<Socket | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const [cardForm, setCardForm] = useState<CardFormState>(EMPTY_CARD_FORM);
  const pendingCardPatchRef = useRef<{ cardId: string | null; patch: Partial<Card> }>({ cardId: null, patch: {} });
  const cardSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await window.fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const ROLE_LABELS: Record<UserRole, string> = {
    MANAGER: "Gestor",
    ADMIN: "Administrador",
    AGENT: "Atendente",
    TECHNICIAN: "T�cnico",
    SUPERVISOR: "Supervisor",
  };

  // 1) board do usu�rio
  useEffect(() => {
    (async () => {
      try {
        setLoadingBoard(true);
        try {
          await fetchJson(`${API}/auth/me`);
        } catch {
          navigate("/login");
          return;
        }
        
        const response = await fetchJson<{ id?: string; name?: string; needs_setup?: boolean }>(`${API}/kanban/my-board`);
        
        // Verificar se precisa configurar board
        if (response.needs_setup) {
          console.log("[Funil] Board não encontrado, mostrando modal de configuração");
          setNeedsSetup(true);
          return;
        }
        
        // Board existe
        if (response.id) {
          console.log("[Funil] Board encontrado:", response);
          setBoardId(response.id);
          setNeedsSetup(false);
        }
      } catch (e: any) {
        console.error("[Funil] Erro ao obter board:", e);
        // Fallback: se houver erro inesperado, mostrar modal
        setNeedsSetup(true);
      } finally {
        setLoadingBoard(false);
      }
    })();
  }, []);

  // Handler para criar o board
  const handleCreateBoard = async (boardName: string, columns: any[]) => {
    try {
      setIsCreatingBoard(true);
      const result = await fetchJson<{ board: { id: string; name: string }, columns: Column[] }>(
        `${API}/kanban/initialize-board`,
        {
          method: "POST",
          body: JSON.stringify({ boardName, columns }),
        }
      );
      
      console.log("[KanbanSetup] Board criado:", result.board.id);
      setBoardId(result.board.id);
      setColumns(result.columns);
      setNeedsSetup(false);
    } catch (error: any) {
      console.error("[KanbanSetup] Erro ao criar board:", error);
      alert(`Erro ao criar pipeline: ${error.message}`);
    } finally {
      setIsCreatingBoard(false);
    }
  };

  // 2) colunas + cards
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        setLoadingData(true);
        const [cols, crds] = await Promise.all([
          fetchJson<Column[]>(`${API}/kanban/boards/${boardId}/columns`),
          fetchJson<Card[]>(`${API}/kanban/boards/${boardId}/cards`),
        ]);
        setColumns(cols.sort((a: Column, b: Column) => a.position - b.position));
        setCards(crds.map(mapApiCard));
      } catch (e) {
        console.error("Falha ao obter dados do funil:", e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [boardId]);

  // 2.1) socket
  useEffect(() => {
    const s = io(API, { withCredentials: true });
    socketRef.current = s;

    const onCardUpdated = (payload: any) => {
      if (selectedRef.current?.id === payload.id) return;
      setCards((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = mapApiCard({ ...prev[idx], ...payload });
        return next;
      });
    };

    const onColumnReordered = (payload: any) => {
      const columnId = payload?.columnId as string | undefined;
      if (!columnId) return;
      const incoming = Array.isArray(payload?.cards) ? payload.cards : [];
      const mappedIncoming = incoming.map(mapApiCard).sort((a: Card, b: Card) => a.position - b.position);
      setCards((prev) => {
        const others = prev.filter((card) => card.stage !== columnId);
        return [...others, ...mappedIncoming];
      });
    };

    s.on("kanban:card:updated", onCardUpdated);
    s.on("kanban:column:reordered", onColumnReordered);
    s.on("connect_error", () => { });

    return () => {
      s.off("kanban:card:updated", onCardUpdated);
      s.off("kanban:column:reordered", onColumnReordered);
      s.disconnect();
    };
  }, []);

  // 3) usu�rios
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        const list = await fetchJson<Array<{ id: string; name: string; role: UserRole }>>(
          `${API}/users/agents-supervisors`
        );
        setUsers(
          list.map((u): User => ({
            id: u.id,
            name: u.name,
            role: u.role,
            roleLabel: ROLE_LABELS[u.role] ?? u.role,
          }))
        );
      } catch (e) {
        console.error("Falha ao carregar usu�rios:", e);
      } finally {
        // se quiser um loadingUsers, adiciona aqui
      }
    })();
  }, [boardId]);


  const mapApiCard = (c: any): Card => {
    const rawPosition = c.position ?? c.position_numeric ?? c.posicao ?? c.order ?? 0;
    const numericPosition = typeof rawPosition === "number" ? rawPosition : Number(rawPosition ?? 0);
    return {
      id: c.id,
      title: c.title,
      value: Number(c.value ?? c.value_numeric ?? 0),
      stage: c.stage ?? c.kanban_column_id ?? "",
      owner: c.owner ?? c.owner_user_id ?? null,
      source: c.source ?? null,
      notes: c.notes ?? null,
      email: c.email ?? null,
      contact: c.contact ?? null,
      leadId: c.leadId ?? c.lead_id ?? null,
      position: Number.isFinite(numericPosition) ? numericPosition : 0,
    };
  };

  const cardsByColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    columns.forEach((c) => {
      map[c.id] = [];
    });
    cards.forEach((card) => {
      const bucket = map[card.stage] ?? (map[card.stage] = []);
      bucket.push(card);
    });
    Object.values(map).forEach((bucket) => {
      bucket.sort((a, b) => a.position - b.position);
    });
    return map;
  }, [columns, cards]);

  const addCardFromLead = async (
    columnId: string,
    lead: { id?: string; name: string; email?: string | null; contact?: string | null },
  ) => {
    if (!boardId) return;
    try {
      const created = await fetchJson<any>(`${API}/kanban/cards`, {
        method: "POST",
        body: JSON.stringify({
          boardId,
          columnId,
          title: lead.name,
          value: 0,
          source: "Lead",
          email: lead.email ?? null,
          contact: lead.contact ?? null,
          leadId: lead.id ?? null,
        }),
      });
      setCards((prev) => [mapApiCard(created), ...prev]);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar card");
    }
  };

  const updateCard = useCallback(async (id: string, patch: Partial<Card>): Promise<Card | null> => {
    try {
      const payload: Record<string, unknown> = { ...patch };
      if (payload.owner !== undefined) payload.owner = payload.owner ? String(payload.owner) : null;
      const updated = await fetchJson<any>(`${API}/kanban/cards/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const mapped = mapApiCard(updated);
      setCards((prev) => prev.map((c) => (c.id === id ? mapped : c)));
      return mapped;
    } catch (e) {
      console.error("Falha ao atualizar card:", e);
      return null;
    }
  }, []);

  const flushCardDraft = useCallback(async () => {
    if (cardSaveTimerRef.current) {
      clearTimeout(cardSaveTimerRef.current);
      cardSaveTimerRef.current = null;
    }
    const { cardId, patch } = pendingCardPatchRef.current;
    if (!cardId || !patch || Object.keys(patch).length === 0) return;
    pendingCardPatchRef.current = { cardId: null, patch: {} };
    try {
      await updateCard(cardId, patch);
    } catch (error) {
      console.error("Falha ao salvar rascunho do card:", error);
    }
  }, [updateCard]);

  const scheduleCardDraft = useCallback(
    (draft: Partial<CardFormState>, patch: Partial<Card>) => {
      setCardForm((prev) => ({ ...prev, ...draft }));
      if (!selected) return;
      pendingCardPatchRef.current = {
        cardId: selected.id,
        patch: { ...pendingCardPatchRef.current.patch, ...patch },
      };
      if (cardSaveTimerRef.current) {
        clearTimeout(cardSaveTimerRef.current);
      }
      cardSaveTimerRef.current = setTimeout(() => {
        void flushCardDraft();
      }, 400);
    },
    [selected, flushCardDraft],
  );

  // LINHAS 324�370 (substitui o effect inteiro)
  useEffect(() => {
    const previousId = lastSelectedIdRef.current;
    const currentId = selected?.id ?? null;

    // se trocou de card e havia patch pendente do anterior, salva
    if (
      previousId &&
      previousId !== currentId &&
      pendingCardPatchRef.current.cardId === previousId &&
      pendingCardPatchRef.current.patch &&
      Object.keys(pendingCardPatchRef.current.patch).length > 0
    ) {
      void flushCardDraft();
    }

    lastSelectedIdRef.current = currentId;

    if (selected) {
      const next = {
        value: String(selected.value ?? 0),
        source: selected.source || "",
        notes: selected.notes || "",
      };
      setCardForm((prev) =>
        prev.value === next.value && prev.source === next.source && prev.notes === next.notes
          ? prev
          : next
      );
    } else {
      setCardForm((prev) =>
        prev.value === "" && prev.source === "" && prev.notes === "" ? prev : { ...EMPTY_CARD_FORM }
      );
    }

    return () => {
      if (cardSaveTimerRef.current) {
        clearTimeout(cardSaveTimerRef.current);
        cardSaveTimerRef.current = null;
      }
      if (
        pendingCardPatchRef.current.cardId &&
        pendingCardPatchRef.current.patch &&
        Object.keys(pendingCardPatchRef.current.patch).length > 0
      ) {
        void flushCardDraft();
      }
    };
  }, [selected?.id, flushCardDraft]); // <- deps certas


  useEffect(() => {
    return () => {
      if (cardSaveTimerRef.current) {
        clearTimeout(cardSaveTimerRef.current);
        cardSaveTimerRef.current = null;
      }
      if (
        pendingCardPatchRef.current.cardId &&
        pendingCardPatchRef.current.patch &&
        Object.keys(pendingCardPatchRef.current.patch).length > 0
      ) {
        void flushCardDraft();
      }
    };
  }, [flushCardDraft]);

  const openEditColumn = (c: Column) => {
    setEditColModal({ id: c.id });
    setColDraft({ title: c.title, color: c.color, position: c.position });
  };
  const closeEditColumn = () => {
    setEditColModal(null);
    setColDraft(null);
  };
  const saveColumn = async (id: string) => {
    if (!colDraft) return;
    try {
      const updated = await fetchJson<Column>(`${API}/kanban/columns/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: colDraft.title, color: colDraft.color }),
      });
      setColumns((prev) => prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.position - b.position));
      closeEditColumn();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar coluna");
    }
  };

  // persistir ordem de colunas (j� sem badge de posi��o na UI)
  const persistColumnOrder = (orderedColumns: Column[], fallbackColumns: Column[]) => {
    if (!boardId) return;
    fetchJson<Column[]>(`${API}/kanban/boards/${boardId}/columns/reorder`, {
      method: "PUT",
      body: JSON.stringify({ columnIds: orderedColumns.map((col) => col.id) }),
    })
      .then((serverColumns) => {
        if (!Array.isArray(serverColumns)) return;
        setColumns(serverColumns.sort((a, b) => a.position - b.position));
      })
      .catch((error) => {
        console.error("Falha ao salvar nova ordem das colunas:", error);
        alert("Erro ao salvar nova ordem das colunas");
        setColumns(fallbackColumns);
      });
  };

  const moveColumn = (fromId: string, toId: string) => {
    if (!boardId) return;
    setColumns((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((c) => c.id === fromId);
      const toIdx = arr.findIndex((c) => c.id === toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const snapshot = prev.map((c) => ({ ...c }));
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      const reindexed = arr.map((c, i) => ({ ...c, position: i + 1 }));
      persistColumnOrder(reindexed, snapshot);
      return reindexed;
    });
  };

  const clearCardDragState = () => {
    setDraggingCard(null);
    setCardDropIndicator(null);
  };

  const handleCardDrop = async (toColumnId: string, targetCardId: string | null, placeAfter: boolean) => {
    if (!draggingCard) return;
    const cardId = draggingCard.id;
    const snapshot = cards.map((c) => ({ ...c }));
    const movingCard = cards.find((c) => c.id === cardId);
    if (!movingCard) {
      clearCardDragState();
      return;
    }

    const fromColumnId = movingCard.stage;
    const targetColumnCards = cards.filter((c) => c.stage === toColumnId).slice().sort((a, b) => a.position - b.position);
    if (targetCardId === cardId) {
      clearCardDragState();
      return;
    }

    const workingList = targetColumnCards.filter((c) => c.id !== cardId);

    let insertIndex: number;
    if (targetCardId) {
      const baseIndex = workingList.findIndex((c) => c.id === targetCardId);
      insertIndex = baseIndex === -1 ? workingList.length : placeAfter ? baseIndex + 1 : baseIndex;
    } else {
      insertIndex = workingList.length;
    }
    insertIndex = Math.max(0, Math.min(workingList.length, insertIndex));

    const updatedTargetList = [...workingList];
    const movedCardWithStage: Card = { ...movingCard, stage: toColumnId };
    updatedTargetList.splice(insertIndex, 0, movedCardWithStage);
    const reindexedTarget = updatedTargetList.map((c, idx) => ({ ...c, position: idx + 1 }));
    const reindexedTargetMap = new Map(reindexedTarget.map((c) => [c.id, c]));

    let reindexedSourceMap: Map<string, Card> | undefined;
    if (fromColumnId !== toColumnId) {
      const sourceList = cards
        .filter((c) => c.stage === fromColumnId && c.id !== cardId)
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((c, idx) => ({ ...c, position: idx + 1 }));
      reindexedSourceMap = new Map(sourceList.map((c) => [c.id, c]));
    }

    const nextCards = cards.map((c) => {
      if (c.id === cardId) return reindexedTargetMap.get(c.id)!;
      if (c.stage === toColumnId) return reindexedTargetMap.get(c.id) ?? c;
      if (fromColumnId !== toColumnId && c.stage === fromColumnId) return reindexedSourceMap?.get(c.id) ?? c;
      return c;
    });

    const newPosition = reindexedTargetMap.get(cardId)?.position ?? movingCard.position;

    setCards(nextCards);
    clearCardDragState();

    const payload: Partial<Card> = { position: newPosition };
    if (fromColumnId !== toColumnId) payload.stage = toColumnId;
    const result = await updateCard(cardId, payload);
    if (!result) setCards(snapshot);
  };

  const autoScrollIfNeeded = (clientX: number) => {
    if (!draggingCard) return;
    const container = boardScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const threshold = Math.min(160, rect.width * 0.25);
    if (clientX < rect.left + threshold) {
      container.scrollLeft -= 24;
    } else if (clientX > rect.right - threshold) {
      container.scrollLeft += 24;
    }
  };

  // propostas vinculadas (mesmo comportamento anterior)
  useEffect(() => {
    if (!selected?.leadId) {
      setLeadProposals([]);
      setSelectedProposalId(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        setLoadingProposals(true);
        const list = await fetchJson<
          { id: string; number: string; title: string; description: string | null; total_value: number }[]
        >(`${API}/proposals?leadId=${selected.leadId}`);
        if (!active) return;
        const mapped = (list || []).map((p) => ({
          id: p.id,
          number: p.number,
          title: p.title,
          description: p.description ?? null,
          totalValue: Number(p.total_value || 0),
        }));
        setLeadProposals(mapped);
        setSelectedProposalId((prev) => {
          if (prev && mapped.some((p) => p.id === prev)) return prev;
          return mapped[0]?.id ?? null;
        });
      } catch (error) {
        console.error("Falha ao carregar propostas do lead:", error);
        if (active) {
          setLeadProposals([]);
          setSelectedProposalId(null);
        }
      } finally {
        if (active) setLoadingProposals(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected?.leadId]);

  // Carregar fotos quando um card é selecionado
  const { fetchPhotos, deletePhoto } = useImageUpload(selected?.id || "");
  
  useEffect(() => {
    if (!selected?.id) {
      setCardPhotos([]);
      return;
    }
    
    let active = true;
    (async () => {
      try {
        const photos = await fetchPhotos();
        if (active) {
          setCardPhotos(photos);
        }
      } catch (error) {
        console.error("Falha ao carregar fotos:", error);
        if (active) {
          setCardPhotos([]);
        }
      }
    })();
    
    return () => {
      active = false;
    };
  }, [selected?.id, fetchPhotos]);

  const handleDeletePhoto = async (photoId: string) => {
    const success = await deletePhoto(photoId);
    if (success) {
      setCardPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  const handlePhotoUploaded = async () => {
    // Recarrega a lista de fotos após upload
    const photos = await fetchPhotos();
    setCardPhotos(photos);
  };

  const handleCreateTaskForLead = (leadId: string) => {
    setTaskForLeadId(leadId);
    setShowTaskModal(true);
  };

  const handleTaskSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    try {
      await fetchJson(`${API}/api/tasks`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          related_lead_id: taskForLeadId,
        }),
      });
      setShowTaskModal(false);
      setTaskForLeadId(null);
    } catch (error) {
      console.error("Falha ao criar tarefa:", error);
      throw error;
    }
  };

  const selectedProposal = useMemo(() => {
    if (!selectedProposalId) return null;
    return leadProposals.find((p) => p.id === selectedProposalId) || null;
  }, [leadProposals, selectedProposalId]);

  if (loadingBoard) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  
  // Se precisa configurar, mostrar apenas o modal (sem verificar boardId)
  if (needsSetup) {
    return (
        <KanbanSetupModal 
          onComplete={handleCreateBoard}
          isLoading={isCreatingBoard}
        />
    );
  }
  
  // Se não tem board e não precisa configurar, algo deu errado
  if (!boardId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Erro: Board não encontrado</p>
      </div>
    );
  }

  // ===== RENDER =====
  return (
      
      <div
        className="relative ml-16 min-h-screen flex-1 transition-colors"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in srgb, var(--color-bg) 96%, transparent) 0%, color-mix(in srgb, var(--color-surface) 88%, transparent) 45%, color-mix(in srgb, var(--color-surface-muted) 82%, transparent) 100%)",
        }}
      >
        {loadingData && (
          <LoadingOverlay
            text="Sincronizando funil de vendas"
            subtext="Buscando colunas e cards atualizados"
            fullscreen={false}
          />
        )}
        <div
          ref={boardScrollRef}
          className="flex flex-1 min-h-screen gap-6 overflow-x-auto overflow-y-hidden px-8 pb-10 pt-14 snap-x snap-mandatory [scrollbar-width:thin]"
        >
          <div className="w-72 shrink-0 snap-start">
            {showAddColumn ? (
              <NewColumnForm apiBase={API} boardId={boardId} onCreated={(c) => onColumnCreated(c)} onCancel={() => setShowAddColumn(false)} />
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 transition-all duration-150 shadow-sm hover:shadow-md"
                style={{
                  borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)",
                  background: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
                  color: "var(--color-text-muted)",
                }}
              >
                <FaPlus /> Nova coluna
              </button>
            )}
          </div>

          {columns.map((col) => {
            const list = cardsByColumn[col.id] || [];
            return (
              <div
                key={col.id}
                className="flex w-80 flex-col shrink-0 snap-start md:w-96"
                onDragOver={(e) => {
                  if (!draggingColId || draggingColId === col.id) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggingColId || draggingColId === col.id) return;
                  moveColumn(draggingColId, col.id);
                  setDraggingColId(null);
                }}
              >
                {/* Cabecalho da coluna (sem mostrar posicao) */}
                <div
                  className="rounded-2xl border px-4 py-3 shadow-sm cursor-grab active:cursor-grabbing transition-colors"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggingColId(col.id);
                    if (e.dataTransfer) {
                      e.dataTransfer.effectAllowed = "move";
                      const canvas = document.createElement("canvas");
                      canvas.width = 1;
                      canvas.height = 1;
                      const ctx = canvas.getContext("2d");
                      ctx?.clearRect(0, 0, 1, 1);
                      e.dataTransfer.setDragImage(canvas, 0, 0);
                    }
                  }}
                  onDragEnd={() => setDraggingColId(null)}
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${col.color} 22%, var(--color-surface)) 0%, color-mix(in srgb, ${col.color} 8%, var(--color-surface)) 100%)`,
                    borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)",
                    color: "var(--color-heading)",
                    boxShadow: "0 18px 36px -24px var(--color-card-shadow)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold tracking-wide" style={{ color: "var(--color-heading)" }}>
                      {col.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-full px-2 py-0.5 text-sm"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {list.length}
                      </div>
                      <button
                        onClick={() => openEditColumn(col)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${col.color} 14%, transparent)`,
                          color: "var(--color-heading)",
                        }}
                        title="Editar coluna"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="mt-3 flex-1 overflow-y-auto pr-1">
                  <div
                    className="space-y-3 min-h-16"
                    onDragOver={(e) => {
                      if (!draggingCard) return;
                      e.preventDefault();
                      autoScrollIfNeeded(e.clientX);
                      if (e.target !== e.currentTarget) return;
                      setCardDropIndicator((current) =>
                        current && current.columnId === col.id && current.cardId === null && current.position === "end"
                          ? current
                          : { columnId: col.id, cardId: null, position: "end" },
                      );
                    }}
                    onDrop={(e) => {
                      if (!draggingCard) return;
                      e.preventDefault();
                      if (e.target !== e.currentTarget) return;
                      const indicator = cardDropIndicator;
                      if (indicator && indicator.columnId === col.id) {
                        const targetId = indicator.cardId;
                        const placeAfter = indicator.position === "after" || indicator.position === "end";
                        handleCardDrop(col.id, targetId, placeAfter);
                      } else {
                        handleCardDrop(col.id, null, true);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!draggingCard) return;
                      const related = e.relatedTarget as Node | null;
                      if (!related || !e.currentTarget.contains(related)) {
                        if (e.target !== e.currentTarget) return;
                        setCardDropIndicator((current) =>
                          current && current.columnId === col.id && current.cardId === null ? null : current,
                        );
                      }
                    }}
                  >
                    {list.map((lead) => {
                      const isDraggingThisCard = draggingCard?.id === lead.id;
                      const indicator = cardDropIndicator;
                      const showBefore = indicator && indicator.columnId === col.id && indicator.cardId === lead.id && indicator.position === "before";
                      const showAfter = indicator && indicator.columnId === col.id && indicator.cardId === lead.id && indicator.position === "after";

                      return (
                        <div key={lead.id} className="flex flex-col gap-2">
                          {showBefore && <div className="h-2 rounded-lg bg-emerald-400/70 shadow-[0_0_0_2px_rgba(16,185,129,0.4)]" />}

                          <button
                            onClick={() => {
                              void flushCardDraft();
                              setSelected(lead);
                            }}
                            className={`group w-full rounded-2xl border p-3 text-left shadow-sm transition hover:shadow-md ${
                              isDraggingThisCard ? "opacity-50" : ""
                            }`}
                            style={{
                              background: "color-mix(in srgb, var(--color-surface) 86%, transparent)",
                              borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)",
                              color: "var(--color-text)",
                            }}
                            draggable
                            onDragStart={(e) => {
                              setDraggingCard({ id: lead.id, fromColumnId: col.id });
                              setCardDropIndicator(null);
                              e.dataTransfer.effectAllowed = "move";
                              try {
                                e.dataTransfer.setData("text/plain", lead.id);
                              } catch { }
                            }}
                            onDragEnd={() => {
                              clearCardDragState();
                            }}
                            onDragOver={(e) => {
                              if (!draggingCard || draggingCard.id === lead.id) return;
                              e.preventDefault();
                              autoScrollIfNeeded(e.clientX);
                              const rect = e.currentTarget.getBoundingClientRect();
                              const shouldPlaceAfter = e.clientY >= rect.top + rect.height / 2;
                              setCardDropIndicator({
                                columnId: col.id,
                                cardId: lead.id,
                                position: shouldPlaceAfter ? "after" : "before",
                              });
                            }}
                            onDrop={(e) => {
                              if (!draggingCard || draggingCard.id === lead.id) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const shouldPlaceAfter = e.clientY >= rect.top + rect.height / 2;
                              handleCardDrop(col.id, lead.id, shouldPlaceAfter);
                            }}
                            onDragLeave={(e) => {
                              if (!draggingCard) return;
                              const related = e.relatedTarget as Node | null;
                              if (!related || !e.currentTarget.contains(related)) {
                                setCardDropIndicator((current) => (current && current.cardId === lead.id ? null : current));
                              }
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: "var(--color-primary)" }}
                                />
                                <span className="font-semibold leading-tight" style={{ color: "var(--color-heading)" }}>
                                  {lead.title}
                                </span>
                              </div>
                              <span
                                className="text-xs font-semibold rounded-full px-2 py-1"
                                style={{
                                  backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                                  color: "var(--color-primary)",
                                }}
                              >
                                {currency(lead.value || 0)}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                              <span className="inline-flex items-center gap-1">
                                <FaTag className="opacity-70" />
                                {lead.source || "-"}
                              </span>
                              <span className="opacity-30">•</span>
                              <span className="inline-flex items-center gap-1">
                                <FaUser className="opacity-70" />
                                {users.find((u) => u.id === lead.owner)?.name || lead.owner || "-"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                              {lead.email && (
                                <span className="inline-flex items-center gap-1">
                                  <FaEnvelope className="opacity-70" />
                                  {lead.email}
                                </span>
                              )}
                              {lead.contact && (
                                <span className="inline-flex items-center gap-1">
                                  <FaPhoneAlt className="opacity-70" />
                                  {lead.contact}
                                </span>
                              )}
                            </div>

                            {/* Badge de Tarefas */}
                            {lead.leadId && (
                              <div className="mt-2">
                                <LeadTaskBadge
                                  leadId={lead.leadId}
                                  onCreateTask={() => handleCreateTaskForLead(lead.leadId!)}
                                />
                              </div>
                            )}
                          </button>

                          {showAfter && <div className="h-2 rounded-lg bg-emerald-400/70 shadow-[0_0_0_2px_rgba(16,185,129,0.4)]" />}
                        </div>
                      );
                    })}
                    {cardDropIndicator?.columnId === col.id && cardDropIndicator.cardId === null && draggingCard && (
                      <div className="h-2 rounded-lg bg-emerald-400/70 shadow-[0_0_0_2px_rgba(16,185,129,0.4)]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Painel lateral (exibi��o + ajustes de oportunidade) */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800"
                onClick={() => {
                  void flushCardDraft();
                  setSelected(null);
                  setLeadProposals([]);
                  setSelectedProposalId(null);
                }}
                title="Fechar"
              >
                <FaTimes size={20} />
              </button>

              <h2 className="text-xl font-semibold text-[#1d2b22] pr-10">{selected.title}</h2>
              <p className="pr-10 text-sm text-zinc-600">
                {currency(parseNumericInput(cardForm.value))} - {columns.find((c) => c.id === selected.stage)?.title}
              </p>

              <div className="mt-6 space-y-6 pr-6">
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Contato (somente leitura)</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-zinc-50 text-zinc-700"
                      value={selected.email || ""}
                      placeholder="E-mail"
                      readOnly
                    />
                    <input
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-zinc-50 text-zinc-700"
                      value={selected.contact || ""}
                      placeholder="Telefone / Celular"
                      readOnly
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Oportunidade</h3>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                      value={cardForm.value}
                      placeholder="Valor"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        scheduleCardDraft({ value: digits }, { value: parseNumericInput(digits) });
                      }}
                      onBlur={() => { void flushCardDraft(); }}
                    />

                    <select
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                      value={selected.stage}
                      onChange={(e) => {
                        void flushCardDraft();
                        updateCard(selected.id, { stage: e.target.value });
                      }}
                    >
                      {columns.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                      value={selected.owner || ""}
                      onChange={(e) => {
                        void flushCardDraft();
                        updateCard(selected.id, { owner: e.target.value });
                      }}
                    >
                      <option value="">Selecionar responsavel</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.roleLabel})
                        </option>
                      ))}
                    </select>

                    <input
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                      value={cardForm.source}
                      placeholder="Origem"
                      autoComplete="off"
                      onChange={(e) => {
                        const raw = e.target.value;
                        scheduleCardDraft({ source: raw }, { source: raw });
                      }}
                      onBlur={() => { void flushCardDraft(); }}
                    />
                  </div>

                  <textarea
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none resize-y min-h-24"
                    placeholder="Notas / proximo passo."
                    value={cardForm.notes}
                    onChange={(e) => {
                      const raw = e.target.value;
                      scheduleCardDraft({ notes: raw }, { notes: raw });
                    }}
                    onBlur={() => { void flushCardDraft(); }}
                    rows={4}
                  />
                </section>


                <section>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Propostas vinculadas</h3>
                  {selected.leadId ? (
                    <div className="mt-2 space-y-3">
                      {loadingProposals ? (
                        <div className="text-sm text-zinc-500">Carregando propostas...</div>
                      ) : leadProposals.length === 0 ? (
                        <div className="text-sm text-zinc-500">Nenhuma proposta vinculada a este lead.</div>
                      ) : (
                        <>
                          <select
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                            value={selectedProposalId || ""}
                            onChange={(e) => setSelectedProposalId(e.target.value || null)}
                          >
                            {leadProposals.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.number} - {p.title}
                              </option>
                            ))}
                          </select>
                          {selectedProposal && (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                              <div className="font-semibold text-[#1d2b22]">
                                Valor: {currency(selectedProposal.totalValue)}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap">
                                {selectedProposal.description?.trim() || "Sem descricao do produto."}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-500">Nenhum lead vinculado a este card.</div>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-zinc-500">Fotos anexadas</h3>
                    <button
                      onClick={() => setShowPhotoCapture(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                      <FaCamera />
                      Adicionar Foto
                    </button>
                  </div>
                  <CardImageGallery photos={cardPhotos} onDelete={handleDeletePhoto} />
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Modal de captura/upload de foto */}
        {showPhotoCapture && selected && (
          <CardImageCapture
            cardId={selected.id}
            onClose={() => setShowPhotoCapture(false)}
            onPhotoUploaded={handlePhotoUploaded}
          />
        )}

        {/* Modal: escolher/cadastrar lead para criar card */}
        {leadFor && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-zinc-800">{leadModeNew ? "Cadastrar novo lead" : "Selecionar lead"}</h3>
                <button
                  className="text-zinc-500 hover:text-zinc-800"
                  onClick={() => {
                    setLeadFor(null);
                    setLeadModeNew(false);
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              {leadModeNew ? (
                <ClienteForm
                  onSubmit={async (payload: any) => {
                    try {
                      const res = await fetch(`${API}/leads`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err?.error || `HTTP ${res.status}`);
                      }
                      const data = await res.json();
                      const contact = data?.cellphone || data?.telephone || null;
                      await addCardFromLead(leadFor!, {
                        id: data?.id,
                        name: data?.name || payload?.nome,
                        email: data?.email || null,
                        contact,
                      });
                      setLeadFor(null);
                      setLeadModeNew(false);
                    } catch (e: any) {
                      alert(e?.message || "Erro ao salvar lead");
                    }
                  }}
                />
              ) : (
                <LeadPicker
                  apiBase={API}
                  onSelect={(l: LeadListItem) => {
                    const contact = l.celular || l.telefone || l.celularAlternativo || l.telefoneAlternativo || null;
                    addCardFromLead(leadFor!, { id: l.id, name: l.name, email: l.email ?? null, contact });
                    setLeadFor(null);
                    setLeadModeNew(false);
                  }}
                  onCreateNew={() => setLeadModeNew(true)}
                />
              )}
            </div>
          </div>
        )}

        {/* Editar coluna */}
        {editColModal && colDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1d2b22]">Editar coluna</h3>
                <button className="text-zinc-500 hover:text-zinc-800" onClick={closeEditColumn}>
                  <FaTimes />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500">Nome</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                    value={colDraft.title}
                    onChange={(e) => setColDraft((d) => ({ ...(d as any), title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-500">Cor</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-16 rounded border border-zinc-200 bg-white"
                      value={colDraft.color}
                      onChange={(e) => setColDraft((d) => ({ ...(d as any), color: e.target.value }))}
                    />
                    <input
                      className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                      value={colDraft.color}
                      onChange={(e) => setColDraft((d) => ({ ...(d as any), color: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={closeEditColumn} className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800">
                  Cancelar
                </button>
                <button
                  onClick={() => saveColumn(editColModal.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Modal */}
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setTaskForLeadId(null);
          }}
          onSubmit={handleTaskSubmit}
          prefilledData={taskForLeadId ? { related_lead_id: taskForLeadId } : undefined}
        />
      </div>
  );

}



