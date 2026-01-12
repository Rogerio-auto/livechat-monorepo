import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { FaPlus, FaTimes, FaUser, FaEnvelope, FaPhoneAlt, FaTag, FaEdit, FaCamera, FaFilter, FaArrowLeft, FaWhatsapp, FaCommentDots, FaTrash } from "react-icons/fa";
import { 
  DndContext, 
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  UniqueIdentifier,
  DragCancelEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NewColumnForm } from "../components/funil/NewColumnForm";
import type { Column, Card, LeadListItem } from "./funil/types";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { CardImageCapture } from "../components/funil/CardImageCapture";
import { CardImageGallery } from "../components/funil/CardImageGallery";
import { useImageUpload, type UploadedPhoto } from "../hooks/useImageUpload";
import { useRecentChats } from "../hooks/useDashboard";
import { useNavigate } from "react-router-dom";
import { showToast } from "../hooks/useToast";
import { KanbanSetupModal } from "../components/funil/KanbanSetupModal";
import { TaskModal } from "../components/tasks/TaskModal";
import { LeadTaskBadge } from "../components/tasks/LeadTaskBadge";
import { CreateTaskInput, UpdateTaskInput } from "@livechat/shared";

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

// --- Sortable Components ---

interface SortableCardProps {
  card: Card;
  users: User[];
  onClick: () => void;
}

function SortableCard({ card, users, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card.id, data: { type: 'Card', card } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md cursor-pointer relative overflow-hidden ${
        isDragging ? "z-50" : ""
      }`}
    >
      {/* Linha de destaque lateral */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-500 transition-colors" />

      <div className="flex items-start justify-between gap-2 pl-1">
        <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
          {card.title}
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
          {currency(card.value || 0)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 pl-1">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
            <FaTag className="opacity-70" size={10} />
            {card.source || "Direto"}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
            <FaUser className="opacity-70" size={10} />
            {users.find((u) => u.id === card.owner)?.name?.split(' ')[0] || card.owner || "Sem dono"}
          </span>
        </div>

        {(card.email || card.contact) && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pl-1">
            {card.email && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px] hover:text-emerald-600 transition-colors">
                <FaEnvelope size={10} className="text-slate-400" />
                {card.email}
              </span>
            )}
            {card.contact && (
              <span className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors">
                <FaPhoneAlt size={10} className="text-slate-400" />
                {card.contact}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between pl-1">
        <LeadTaskBadge leadId={card.leadId || ""} />
      </div>
    </div>
  );
}

interface SortableColumnProps {
  column: Column;
  children: React.ReactNode;
  onEdit: () => void;
  count: number;
}

function SortableColumn({ column, children, onEdit, count }: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id, data: { type: 'Column', column } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-80 flex-col shrink-0 snap-start md:w-96 h-full bg-slate-200/80 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200/60 dark:border-slate-800/50"
    >
      {/* Cabeçalho da coluna */}
      <div
        {...attributes}
        {...listeners}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm cursor-grab active:cursor-grabbing transition-all hover:border-slate-300 dark:hover:border-slate-700 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="h-2.5 w-2.5 rounded-full shadow-sm" 
              style={{ backgroundColor: column.color || '#10b981' }}
            />
            <div className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest text-[10px]">
              {column.title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
              {count}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
              title="Editar coluna"
            >
              <FaEdit size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[150px]">
        <div className="space-y-3 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function LeadCreationView({ onBack, onSelectChat }: { onBack: () => void, onSelectChat: (chat: any) => void }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: chats, loading } = useRecentChats(50, debouncedSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Filtrar apenas chats que ainda não são leads
  const filteredChats = chats.filter(c => !c.is_lead);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="h-16 shrink-0 flex items-center px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
            <FaArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Criar Lead de Conversa</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecione uma conversa ativa para converter em lead</p>
          </div>
        </div>
        <div className="w-64">
          <input 
            type="text" 
            placeholder="Buscar por nome ou número..." 
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Buscando conversas...</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <FaCommentDots size={48} className="mb-4 opacity-20" />
            <p className="font-medium">Nenhuma conversa encontrada</p>
            <p className="text-xs">Tente buscar por outro nome ou número de telefone.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-500 transition-colors" />
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <FaWhatsapp size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">{chat.customer_name || "Sem nome"}</h4>
                      <p className="text-xs text-slate-500">{chat.customer_phone}</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {chat.status}
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                  "{chat.last_message || "Sem mensagens"}"
                </p>
                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">
                    {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString() : "N/A"}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Selecionar →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState<'board' | 'create-lead'>('board');

  // Deixa UserOption alinhado ao UserRole

  type ProposalOption = { id: string; number: string; title: string; description: string | null; totalValue: number };

  const [users, setUsers] = useState<User[]>([]);
  const [editColModal, setEditColModal] = useState<null | { id: string }>(null);
  const [colDraft, setColDraft] = useState<{ title: string; color: string; position: number } | null>(null);

  // dnd-kit state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    if (!boardId || boardId === "undefined") return;
    (async () => {
      try {
        setLoadingData(true);
        console.log("[Funil] Buscando colunas e cards para o board:", boardId);
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

    const onColumnsReordered = (payload: any) => {
      if (payload?.boardId === boardId && Array.isArray(payload?.columns)) {
        setColumns(payload.columns.sort((a: any, b: any) => a.position - b.position));
      }
    };

    const onCardDeleted = (payload: any) => {
      setCards((prev) => prev.filter((c) => c.id !== payload.id));
      if (selectedRef.current?.id === payload.id) {
        setSelected(null);
      }
    };

    const onColumnDeleted = (payload: any) => {
      setColumns((prev) => prev.filter((c) => c.id !== payload.id));
    };

    s.on("kanban:card:updated", onCardUpdated);
    s.on("kanban:column:reordered", onColumnReordered);
    s.on("kanban:columns:reordered", onColumnsReordered);
    s.on("kanban:card:deleted", onCardDeleted);
    s.on("kanban:column:deleted", onColumnDeleted);
    s.on("connect_error", () => { });

    return () => {
      s.off("kanban:card:updated", onCardUpdated);
      s.off("kanban:column:reordered", onColumnReordered);
      s.off("kanban:columns:reordered", onColumnsReordered);
      s.off("kanban:card:deleted", onCardDeleted);
      s.off("kanban:column:deleted", onColumnDeleted);
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
      
      // Atualizar o card selecionado para refletir a mudança na UI imediatamente
      if (selectedRef.current?.id === id) {
        setSelected(mapped);
      }
      
      return mapped;
    } catch (e) {
      console.error("Falha ao atualizar card:", e);
      return null;
    }
  }, []);

  const deleteCard = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este card?")) return;
    try {
      await fetchJson(`${API}/kanban/cards/${id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== id));
      setSelected(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir card");
    }
  };

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

  const deleteColumn = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta coluna? Todos os cards serão apagados permanentemente.")) return;
    try {
      await fetchJson(`${API}/kanban/columns/${id}?force=true`, { method: "DELETE" });
      setColumns((prev) => prev.filter((c) => c.id !== id));
      setCards((prev) => prev.filter((c) => c.stage !== id));
      closeEditColumn();
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir coluna");
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

  const clearCardDragState = () => {
    setActiveId(null);
    setActiveCard(null);
    setActiveColumn(null);
  };

  const findContainer = (id: UniqueIdentifier) => {
    if (columns.some(c => c.id === id)) return id;
    return cards.find(c => c.id === id)?.stage;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id;
    setActiveId(id);

    const card = cards.find(c => c.id === id);
    if (card) {
      setActiveCard(card);
      return;
    }

    const column = columns.find(c => c.id === id);
    if (column) {
      setActiveColumn(column);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const id = active.id;
    const overId = over?.id;

    if (!overId || id === overId) return;

    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Moving card between columns
    setCards((prev) => {
      const activeCard = prev.find(c => c.id === id);
      if (!activeCard) return prev;

      const overItems = prev.filter(c => c.stage === overContainer);
      const overIndex = overItems.findIndex(c => c.id === overId);

      let newIndex;
      if (columns.some(c => c.id === overId)) {
        newIndex = overItems.length;
      } else {
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      const otherCards = prev.filter(c => c.id !== id);
      const updatedCard = { ...activeCard, stage: overContainer as string };
      
      // Re-insert at new position
      const targetColumnCards = otherCards.filter(c => c.stage === overContainer);
      const otherColumnCards = otherCards.filter(c => c.stage !== overContainer);
      
      const newTargetColumnCards = [
        ...targetColumnCards.slice(0, newIndex),
        updatedCard,
        ...targetColumnCards.slice(newIndex)
      ];

      return [...otherColumnCards, ...newTargetColumnCards];
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const id = active.id;
    const overId = over?.id;

    if (!overId) {
      clearCardDragState();
      return;
    }

    if (activeColumn) {
      // Column reordering
      if (id !== overId) {
        setColumns((prev) => {
          const oldIndex = prev.findIndex(c => c.id === id);
          const newIndex = prev.findIndex(c => c.id === overId);
          const newColumns = arrayMove(prev, oldIndex, newIndex);
          const reindexed = newColumns.map((c, i) => ({ ...c, position: i + 1 }));
          persistColumnOrder(reindexed, prev);
          return reindexed;
        });
      }
      clearCardDragState();
      return;
    }

    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) {
      clearCardDragState();
      return;
    }

    const activeItems = cards.filter(c => c.stage === activeContainer);
    const overItems = cards.filter(c => c.stage === overContainer);

    const activeIndex = activeItems.findIndex(c => c.id === id);
    const overIndex = overItems.findIndex(c => c.id === overId);

    if (activeContainer !== overContainer || activeIndex !== overIndex) {
      const movingCard = cards.find(c => c.id === id);
      if (!movingCard) return;

      // Update local state for immediate feedback
      setCards((prev) => {
        const activeCard = prev.find(c => c.id === id)!;
        const otherCards = prev.filter(c => c.id !== id);
        
        const targetColumnCards = otherCards.filter(c => c.stage === overContainer);
        const otherColumnCards = otherCards.filter(c => c.stage !== overContainer);
        
        const finalIndex = overIndex >= 0 ? overIndex : targetColumnCards.length;
        
        const newTargetColumnCards = [
          ...targetColumnCards.slice(0, finalIndex),
          { ...activeCard, stage: overContainer as string },
          ...targetColumnCards.slice(finalIndex)
        ];

        // Re-index positions
        const reindexedTarget = newTargetColumnCards.map((c, i) => ({ ...c, position: i + 1 }));
        
        return [...otherColumnCards, ...reindexedTarget];
      });

      // Persist to API
      const finalPosition = overIndex >= 0 ? overIndex + 1 : overItems.length + 1;
      const payload: Partial<Card> = { position: finalPosition };
      if (activeContainer !== overContainer) payload.stage = overContainer as string;
      
      await updateCard(id as string, payload);
    }

    clearCardDragState();
  };

  const handleDragCancel = () => {
    clearCardDragState();
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

  const handleSelectChat = async (chat: any) => {
    try {
      // Extrair telefone de forma robusta (fallback para remote_id ou external_id)
      const phone = chat.customer_phone || 
                    chat.remote_id?.split('@')[0] || 
                    chat.external_id?.split('@')[0] || 
                    "";

      // 1. Criar o lead no backend
      const res = await fetch(`${API}/leads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: chat.customer_name || chat.display_name || "Lead de Chat",
          celular: phone,
          telefone: phone,
          origem: "Chat",
          chat_id: chat.id,
          customer_id: chat.customer_id,
          kanban_board_id: boardId
        }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      // 2. Adicionar o card no funil
      await addCardFromLead(leadFor!, {
        id: data?.id,
        name: data?.name || chat.customer_name || chat.display_name,
        email: data?.email || null,
        contact: phone,
      });
      
      // 3. Voltar para o board
      setViewMode('board');
      setLeadFor(null);
    } catch (e: any) {
      alert(e?.message || "Erro ao converter conversa em lead");
    }
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
  if (viewMode === 'create-lead') {
    return (
      <LeadCreationView 
        onBack={() => {
          setViewMode('board');
          setLeadFor(null);
        }}
        onSelectChat={handleSelectChat}
      />
    );
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {loadingData && (
        <LoadingOverlay
          text="Sincronizando funil de vendas"
          subtext="Buscando colunas e cards atualizados"
          fullscreen={false}
        />
      )}

      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <FaFilter size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Funil de Vendas
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Gerencie seus leads e oportunidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setViewMode('create-lead');
              setLeadFor(columns[0]?.id || null);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:shadow-emerald-500/40 active:scale-95"
          >
            <FaPlus />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={boardScrollRef}
          className="flex-1 flex gap-6 overflow-x-auto overflow-y-hidden px-8 pb-10 pt-8 [scrollbar-width:thin] custom-scrollbar"
        >
          <div className="w-80 md:w-96 shrink-0 snap-start">
            {showAddColumn ? (
              <NewColumnForm 
                apiBase={API} 
                boardId={boardId} 
                onCreated={(c) => onColumnCreated(c)} 
                onCancel={() => setShowAddColumn(false)} 
              />
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-900/40 text-slate-400 transition-all hover:border-emerald-500/50 hover:bg-white dark:hover:bg-slate-900 hover:text-emerald-600 dark:hover:text-emerald-400 group"
              >
                <FaPlus className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs uppercase tracking-widest">Nova coluna</span>
              </button>
            )}
          </div>

          <SortableContext
            items={columns.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((col) => {
              const list = cardsByColumn[col.id] || [];
              return (
                <SortableColumn
                  key={col.id}
                  column={col}
                  count={list.length}
                  onEdit={() => openEditColumn(col)}
                >
                  <SortableContext
                    items={list.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {list.map((lead) => (
                      <SortableCard
                        key={lead.id}
                        card={lead}
                        users={users}
                        onClick={() => {
                          void flushCardDraft();
                          setSelected(lead);
                        }}
                      />
                    ))}
                  </SortableContext>
                  
                  <button
                    onClick={() => {
                      setViewMode('create-lead');
                      setLeadFor(col.id);
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mt-2 group"
                  >
                    <FaPlus className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                    Adicionar Lead
                  </button>
                </SortableColumn>
              );
            })}
          </SortableContext>
        </div>

        <DragOverlay dropAnimation={defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }) as any}>
          {activeCard ? (
            <div className="transform rotate-2 cursor-grabbing w-80 md:w-96">
              <SortableCard card={activeCard} users={users} onClick={() => {}} />
            </div>
          ) : activeColumn ? (
            <div className="transform rotate-1 cursor-grabbing opacity-80">
              <SortableColumn 
                column={activeColumn} 
                count={cardsByColumn[activeColumn.id]?.length || 0} 
                onEdit={() => {}}
              >
                {cardsByColumn[activeColumn.id]?.map(lead => (
                  <SortableCard key={lead.id} card={lead} users={users} onClick={() => {}} />
                ))}
              </SortableColumn>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

        {/* Painel lateral (exibi��o + ajustes de oportunidade) */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
            <div className="relative w-full max-w-3xl rounded-xl bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
              <div className="absolute top-6 right-6 flex items-center gap-4">
                <button
                  className="text-slate-300 hover:text-red-600 transition-colors p-1"
                  onClick={() => deleteCard(selected.id)}
                  title="Excluir Card"
                >
                  <FaTrash size={18} />
                </button>
                <button
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
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
              </div>

              <h2 className="text-2xl font-bold text-slate-800 pr-20">{selected.title}</h2>
              <p className="pr-10 text-sm font-medium text-slate-500 mt-1">
                {currency(parseNumericInput(cardForm.value))} • {columns.find((c) => c.id === selected.stage)?.title}
              </p>

              <div className="mt-8 space-y-8">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Contato (somente leitura)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">E-mail</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
                        value={selected.email || ""}
                        placeholder="E-mail"
                        readOnly
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Telefone / Celular</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
                        value={selected.contact || ""}
                        placeholder="Telefone / Celular"
                        readOnly
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Oportunidade</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Valor</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Etapa</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-white"
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Responsável</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-white"
                        value={selected.owner || ""}
                        onChange={(e) => {
                          void flushCardDraft();
                          updateCard(selected.id, { owner: e.target.value });
                        }}
                      >
                        <option value="">Selecionar responsável</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.roleLabel})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Origem</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
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
                  </div>

                  <div className="mt-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Notas / Próximo Passo</label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-y min-h-24"
                      placeholder="Notas / próximo passo..."
                      value={cardForm.notes}
                      onChange={(e) => {
                        const raw = e.target.value;
                        scheduleCardDraft({ notes: raw }, { notes: raw });
                      }}
                      onBlur={() => { void flushCardDraft(); }}
                      rows={4}
                    />
                  </div>
                </section>


                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Propostas vinculadas</h3>
                  {selected.leadId ? (
                    <div className="space-y-4">
                      {loadingProposals ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500 italic">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          Carregando propostas...
                        </div>
                      ) : leadProposals.length === 0 ? (
                        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                          Nenhuma proposta vinculada a este lead.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Selecionar Proposta</label>
                            <select
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-white"
                              value={selectedProposalId || ""}
                              onChange={(e) => setSelectedProposalId(e.target.value || null)}
                            >
                              <option value="">Selecione uma proposta</option>
                              {leadProposals.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.number} - {p.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          {selectedProposal && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <div className="text-lg font-bold text-emerald-700">
                                  {currency(selectedProposal.totalValue)}
                                </div>
                                <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                                  Proposta Ativa
                                </span>
                              </div>
                              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {selectedProposal.description?.trim() || "Sem descrição do produto."}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                      Nenhum lead vinculado a este card.
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Fotos anexadas</h3>
                    <button
                      onClick={() => setShowPhotoCapture(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                      <FaCamera />
                      Adicionar Foto
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <CardImageGallery photos={cardPhotos} onDelete={handleDeletePhoto} />
                  </div>
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

        {/* Editar coluna */}
        {editColModal && colDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-md">
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
                <div className="col-span-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500">Cor</label>
                  <div className="flex flex-wrap gap-2 mt-1.5 mb-3">
                    {[
                      "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", 
                      "#EF4444", "#F59E0B", "#EAB308", "#64748B", "#6B7280"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColDraft((d) => ({ ...(d as any), color: c }))}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${colDraft.color === c ? "border-slate-900 scale-110" : "border-transparent hover:scale-110"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
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
              <div className="mt-5 flex justify-between items-center">
                <button
                  onClick={() => deleteColumn(editColModal.id)}
                  className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <FaTrash size={14} />
                  Excluir Coluna
                </button>
                <div className="flex gap-2">
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




