import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { Chat } from "./types";
type Agent = {
  id: string;
  user_id?: string;
  name: string;
  role?: string | null;
};
type Tag = {
  id: string;
  name: string;
  color?: string | null;
};
type Participant = {
  id: string;
  name: string;
  role?: string | null;
  is_current?: boolean;
};
type Column = {
  id: string;
  title: string;
};
type Calendar = {
  id: string;
  name: string;
};
type EventForm = {
  calendar_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  event_type: "MEETING" | "CALL" | "TECHNICAL_VISIT" | "FOLLOW_UP" | "OTHER";
};
const DEFAULT_EVENT_FORM: EventForm = {
  calendar_id: "",
  title: "",
  start_time: "",
  end_time: "",
  location: "",
  description: "",
  event_type: "MEETING",
};
const SECTION_DEFAULT_STATE: Record<string, boolean> = {
  actions: true,
  macros: false,
  info: true,
  participants: true,
  pipeline: true,
  meeting: false,
};
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
export function ConversationPanel({
  apiBase,
  chat,
  onAssigneeChange,
  onTagsChange,
  tags,
  setTags,
}: {
  apiBase: string;
  chat: Chat | null;
  onAssigneeChange?: (
    linkId: string | null,
    name?: string | null,
    userId?: string | null,
  ) => void;
  onTagsChange?: (tags: string[]) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
}) {
  const chatId = chat?.id ?? null;
  // Painel opera apenas com chamadas REST; sockets intencionalmente nao utilizados aqui.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => ({
      ...SECTION_DEFAULT_STATE,
    }),
  );
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentAssigneeLinkId, setCurrentAssigneeLinkId] = useState<
    string | null
  >(null);
  const [currentAssigneeUserId, setCurrentAssigneeUserId] = useState<
    string | null
  >(null);
  const [currentAssigneeName, setCurrentAssigneeName] = useState<string | null>(
    null,
  );
  const [leadId, setLeadId] = useState<string | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cardIdForLead, setCardIdForLead] = useState<string | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [movingStage, setMovingStage] = useState(false);
  const [cardOwnerId, setCardOwnerId] = useState<string | null>(null);
  const [cardPosition, setCardPosition] = useState<number | null>(null);
  const [cardDescription, setCardDescription] = useState("");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [eventForm, setEventForm] = useState<EventForm>(() => ({
    ...DEFAULT_EVENT_FORM,
  }));
  const [lastCreatedEvent, setLastCreatedEvent] = useState<any | null>(null);
  const [contactEvents, setContactEvents] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventEdit, setEventEdit] = useState<Record<string, any>>({});
  const refreshParticipants = useCallback(async () => {
    if (!chatId) {
      setParticipants([]);
      return;
    }
    try {
      const list =
        (await requestJson<Participant[]>(`${apiBase}
/livechat/chats/${chatId}
/participants`)) || [];
      if (!isMountedRef.current) return;
      setParticipants(Array.isArray(list) ? list : []);
    } catch {
      if (isMountedRef.current) setParticipants([]);
    }
  }, [apiBase, chatId]);
  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);
  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const data = await requestJson<Tag[]>(`${apiBase}
/livechat/tags`);
        if (!cancelled && isMountedRef.current)
          setAllTags(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled && isMountedRef.current) setAllTags([]);
      }
    };
    loadTags();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);
  useEffect(() => {
    if (!chatId) {
      setSelectedTags([]);
      return;
    }
    setSelectedTags(tags || []);
  }, [chatId, tags]);
  // Load current chat's selected tags when chat changes (REST only)
  useEffect(() => {
    let cancelled = false;
    const loadSelectedForChat = async () => {
      if (!chatId) return;
      try {
        const data = await requestJson<string[]>(`${apiBase}
/livechat/chats/${chatId}
/tags`);
        if (!cancelled && Array.isArray(data)) {
          setSelectedTags(data);
          setTags(data);
          onTagsChange?.(data);
        }
      } catch {}
    };
    loadSelectedForChat();
    return () => {
      cancelled = true;
    };
  }, [apiBase, chatId, onTagsChange, setTags]);
  useEffect(() => {
    if (!chatId) {
      setCurrentAssigneeLinkId(null);
      setCurrentAssigneeUserId(null);
      setCurrentAssigneeName(null);
      return;
    }
    setCurrentAssigneeLinkId(chat?.assigned_agent_id ?? null);
    setCurrentAssigneeName(chat?.assigned_agent_name ?? null);
    setCurrentAssigneeUserId(chat?.assigned_agent_user_id ?? null);
  }, [
    chatId,
    chat?.assigned_agent_id,
    chat?.assigned_agent_name,
    chat?.assigned_agent_user_id,
  ]);
  useEffect(() => {
    let cancelled = false;
    const loadAgents = async () => {
      if (!chatId || !chat?.inbox_id) {
        setAgents([]);
        setCurrentAssigneeUserId(null);
        return;
      }
      let rows: Agent[] = [];
      try {
        rows =
          (await requestJson<Agent[]>(`${apiBase}
/livechat/inboxes/${chat.inbox_id}
/agents`)) || [];
      } catch {
        rows = [];
      }
      if (!cancelled && isMountedRef.current) setAgents(rows);
    };
    loadAgents();
    return () => {
      cancelled = true;
    };
  }, [apiBase, chatId, chat?.inbox_id]);
  useEffect(() => {
    if (!currentAssigneeLinkId) {
      setCurrentAssigneeUserId(null);
      return;
    }
    const found = agents.find(
      (agent) =>
        agent.id === currentAssigneeLinkId ||
        agent.user_id === currentAssigneeLinkId,
    );
    if (found?.user_id) {
      setCurrentAssigneeUserId(found.user_id);
    }
  }, [agents, currentAssigneeLinkId]);
  useEffect(() => {
    if (!currentAssigneeLinkId) return;
    setAgents((prev) => {
      if (prev.some((agent) => agent.id === currentAssigneeLinkId)) return prev;
      return [
        ...prev,
        {
          id: currentAssigneeLinkId,
          user_id: currentAssigneeUserId ?? undefined,
          name: currentAssigneeName || currentAssigneeLinkId,
        },
      ];
    });
  }, [currentAssigneeLinkId, currentAssigneeName, currentAssigneeUserId]);
  useEffect(() => {
    if (!currentAssigneeLinkId || !currentAssigneeUserId) return;
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === currentAssigneeLinkId
          ? {
              ...agent,
              user_id: currentAssigneeUserId,
            }
          : agent,
      ),
    );
  }, [currentAssigneeLinkId, currentAssigneeUserId]);
  useEffect(() => {
    setLeadId(null);
    setBoardId(null);
    setColumns([]);
    setCardIdForLead(null);
    setCurrentStageId(null);
    setCardOwnerId(null);
    setCardPosition(null);
    setCardDescription("");
    let cancelled = false;
    const fetchLeadByCustomer = async (
      customerId: string,
    ): Promise<any | null> => {
      try {
        const res = await fetch(
          `${apiBase}
/leads/by-customer/${customerId}
`,
          {
            credentials: "include",
          },
        );
        if (res.status === 404) return null;
        if (!res.ok) {
          const textResp = await res.text();
          throw new Error(textResp || res.statusText);
        }
        return (await res.json()) as any;
      } catch {
        return null;
      }
    };
    const loadLead = async () => {
      if (!chat?.customer_id || cancelled) return;
      let resolvedLeadId: string | null = chat.customer_id;
      let leadStage: string | null = null;
      const leadInfo = await fetchLeadByCustomer(chat.customer_id);
      if (leadInfo?.id) {
        resolvedLeadId = leadInfo.id;
        leadStage = leadInfo.kanban_column_id ?? null;
      }
      if (cancelled || !isMountedRef.current) return;
      let boardIdValue: string | null = null;
      try {
        const board = await requestJson<{
          id: string;
        }>(`${apiBase}
/kanban/my-board`);
        boardIdValue = board?.id ?? null;
      } catch {
        boardIdValue = null;
      }
      if (cancelled || !isMountedRef.current) return;
      setBoardId(boardIdValue);
      let columnsList: Column[] = [];
      if (boardIdValue) {
        try {
          const rawColumns =
            (await requestJson<
              Array<{
                id: string;
                name?: string;
                title?: string;
              }>
            >(`${apiBase}
/kanban/boards/${boardIdValue}
/columns`)) || [];
          columnsList = rawColumns.map((col) => ({
            id: col.id,
            title: col.name || col.title || col.id,
          }));
        } catch {
          columnsList = [];
        }
      }
      if (!cancelled && isMountedRef.current) {
        setColumns(columnsList);
      }
      let cards: any[] = [];
      if (boardIdValue) {
        try {
          cards =
            (await requestJson<any[]>(`${apiBase}
/kanban/boards/${boardIdValue}
/cards`)) || [];
        } catch {
          cards = [];
        }
      }
      const findCardByLead = (leadId: string | null) =>
        leadId ? cards.find((card: any) => card.leadId === leadId) : null;
      let cardMatch = findCardByLead(resolvedLeadId);
      if (
        !cardMatch &&
        boardIdValue &&
        leadInfo?.id &&
        leadInfo.id !== resolvedLeadId
      ) {
        cardMatch = findCardByLead(leadInfo.id);
      }
      if (cancelled || !isMountedRef.current) return;
      setLeadId(resolvedLeadId);
      if (cardMatch) {
        setCardIdForLead(cardMatch.id || null);
        setCurrentStageId(cardMatch.stage || leadStage || null);
        setCardOwnerId(cardMatch.owner || null);
        setCardPosition(
          typeof cardMatch.position === "number" &&
            !Number.isNaN(cardMatch.position)
            ? cardMatch.position
            : null,
        );
        setCardDescription(cardMatch.description || "");
      } else {
        setCardIdForLead(null);
        setCardOwnerId(null);
        setCardPosition(null);
        setCardDescription("");
        setCurrentStageId(leadStage);
      }
    };
    loadLead();
    return () => {
      cancelled = true;
    };
  }, [apiBase, chat?.customer_id]);
  useEffect(() => {
    let cancelled = false;
    const loadCalendars = async () => {
      try {
        const data =
          (await requestJson<
            Array<{
              id: string;
              name: string;
              is_default?: boolean;
            }>
          >(`${apiBase}
/calendar/calendars`)) || [];
        if (cancelled || !isMountedRef.current) return;
        setCalendars(data);
        const preferred =
          data.find((c) => (c as any).is_default) || data[0] || null;
        if (preferred && !eventForm.calendar_id) {
          setEventForm((prev) => ({
            ...prev,
            calendar_id: preferred.id,
          }));
        }
      } catch {
        if (!cancelled && isMountedRef.current) setCalendars([]);
      }
    };
    loadCalendars();
    return () => {
      cancelled = true;
    };
  }, [apiBase, eventForm.calendar_id]);
  useEffect(() => {
    let cancelled = false;
    setContactEvents([]);
    setExpandedEventId(null);
    setEventEdit({});
    const loadEvents = async () => {
      if (!chat?.customer_id) return;
      try {
        const now = new Date();
        const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
        const qs = new URLSearchParams({
          start: past.toISOString(),
          end: future.toISOString(),
        }).toString();
        const resp = await requestJson<{
          items: any[];
        }>(`${apiBase}
/calendar/events?${qs}
`);
        if (cancelled || !isMountedRef.current) return;
        const rows = (resp?.items || []).filter(
          (item: any) => (item.raw || {}).customer_id === chat.customer_id,
        );
        setContactEvents(rows);
      } catch {
        if (!cancelled && isMountedRef.current) setContactEvents([]);
      }
    };
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [apiBase, chat?.customer_id]);
  const moveLeadToStage = useCallback(
    async (stageId: string) => {
      if (!leadId) return;
      setMovingStage(true);
      try {
        if (cardIdForLead) {
          await requestJson(
            `${apiBase}
/kanban/cards/${cardIdForLead}
`,
            {
              method: "PUT",
              body: JSON.stringify({
                stage: stageId,
              }),
            },
          );
        } else {
          await requestJson(
            `${apiBase}
/leads/${leadId}
`,
            {
              method: "PUT",
              body: JSON.stringify({
                kanban_column_id: stageId,
              }),
            },
          );
        }
        setCurrentStageId(stageId);
      } catch {
        alert("Falha ao mover lead de coluna");
      } finally {
        setMovingStage(false);
      }
    },
    [apiBase, cardIdForLead, leadId],
  );
  const saveCardConfig = useCallback(async () => {
    if (!cardIdForLead) return;
    try {
      const body: Record<string, unknown> = {
        description: cardDescription,
        owner: cardOwnerId || null,
      };
      if (currentStageId) body.stage = currentStageId;
      if (typeof cardPosition === "number" && !Number.isNaN(cardPosition)) {
        body.position = cardPosition;
      }
      await requestJson(
        `${apiBase}
/kanban/cards/${cardIdForLead}
`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
      alert("Card atualizado");
    } catch (error: any) {
      alert(
        typeof error?.message === "string"
          ? error.message
          : "Falha ao atualizar card",
      );
    }
  }, [
    apiBase,
    cardDescription,
    cardIdForLead,
    cardOwnerId,
    cardPosition,
    currentStageId,
  ]);
  const createMeeting = useCallback(async () => {
    if (
      !eventForm.title ||
      !eventForm.calendar_id ||
      !eventForm.start_time ||
      !eventForm.end_time
    ) {
      alert("Preencha titulo, calendario, inicio e fim");
      return;
    }
    try {
      const payload = {
        ...eventForm,
        customer_id: chat?.customer_id || null,
      };
      const created = await requestJson<any>(
        `${apiBase}
/calendar/events`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setLastCreatedEvent(created);
      alert("Reuniao criada");
    } catch (error: any) {
      alert(
        typeof error?.message === "string"
          ? error.message
          : "Falha ao criar reuniao",
      );
    }
  }, [apiBase, chat?.customer_id, eventForm]);
  const updateMeeting = useCallback(
    async (patch: any) => {
      if (!lastCreatedEvent?.id) return;
      try {
        const updated = await requestJson<any>(
          `${apiBase}
/calendar/events/${lastCreatedEvent.id}
`,
          {
            method: "PUT",
            body: JSON.stringify(patch),
          },
        );
        setLastCreatedEvent(updated);
        alert("Reuniao atualizada");
      } catch (error: any) {
        alert(
          typeof error?.message === "string"
            ? error.message
            : "Falha ao atualizar reuniao",
        );
      }
    },
    [apiBase, lastCreatedEvent?.id],
  );
  const applyAssignee = useCallback(
    async (userId: string | null) => {
      if (!chatId) return;
      try {
        const resp = await requestJson<{
          assigned_agent_id: string | null;
          assigned_agent_name: string | null;
        }>(
          `${apiBase}
/livechat/chats/${chatId}
/assignee`,
          {
            method: "PUT",
            body: JSON.stringify({
              userId,
            }),
          },
        );
        const nextLinkId: string | null = resp?.assigned_agent_id ?? null;
        const nextName: string | null = resp?.assigned_agent_name ?? null;
        setCurrentAssigneeLinkId(nextLinkId);
        setCurrentAssigneeName(nextName);
        setCurrentAssigneeUserId(userId);
        onAssigneeChange?.(nextLinkId, nextName, userId);
        void refreshParticipants();
      } catch (error: any) {
        alert(
          typeof error?.message === "string"
            ? error.message
            : "Falha ao atualizar responsavel",
        );
      }
    },
    [apiBase, chatId, onAssigneeChange, refreshParticipants],
  );
  const persistTags = useCallback(
    async (ids: string[]) => {
      if (!chatId) return;
      try {
        await requestJson(
          `${apiBase}
/livechat/chats/${chatId}
/tags`,
          {
            method: "PUT",
            body: JSON.stringify({
              tags: ids,
            }),
          },
        );
      } catch (error) {
        console.error("Falha ao salvar tags", error);
      }
    },
    [apiBase, chatId],
  );
  const toggleTag = useCallback(
    (id: string) => {
      setSelectedTags((prev) => {
        const exists = prev.includes(id);
        const next = exists
          ? prev.filter((tagId) => tagId !== id)
          : [...prev, id];
        void persistTags(next);
        onTagsChange?.(next);
        setTags(next);
        return next;
      });
    },
    [onTagsChange, persistTags, setTags],
  );
  const fmtLocal = (iso?: string | null) => {
    if (!iso) return "";
    try {
      const date = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}
-${pad(date.getMonth() + 1)}
-${pad(date.getDate())}
T${pad(date.getHours())}
:${pad(date.getMinutes())}
`;
    } catch {
      return "";
    }
  };
  const Section = ({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: ReactNode;
  }) => (
    <div className="border rounded-xl overflow-hidden">
      {" "}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-[color-mix(in_srgb,var(--color-text)_4%,var(--color-surface))] hover:bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-surface))]"
        onClick={() =>
          setOpenSections((prev) => ({
            ...prev,
            [id]: !prev[id],
          }))
        }
      >
        {" "}
        <span className="font-medium text-(--color-text)">{title}</span>{" "}
        <span className="text-(--color-text-muted)">
          {openSections[id] ? "-" : "+"}
        </span>{" "}
      </button>{" "}
      {openSections[id] && <div className="p-3 bg-(--color-surface)">{children}</div>}
    </div>
  );
  const assignedSelectValue = currentAssigneeUserId ?? "";
  return (
  <div className="bg-(--color-surface) rounded-2xl shadow p-3 flex flex-col gap-1">
      {" "}
      {chat ? (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border-b border-emerald-100">
          {" "}
          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold shadow-sm ring-1 ring-emerald-200">
            {" "}
            {(chat.customer_name || chat.customer_phone || chat.customer_id || "?")
              .slice(0, 1)
              .toUpperCase()}
          </div>{" "}
          <div className="min-w-0">
            {" "}
            <div className="text-sm font-semibold text-(--color-text) truncate">
              {" "}
              {chat.customer_name || "Desconhecido"}
            </div>{" "}
            <div className="text-xs text-(--color-text-muted) truncate">
              {chat.customer_phone || chat.customer_id.slice(0, 8)}
            </div>{" "}
          </div>{" "}
        </div>
      ) : (
        <div className="text-sm text-(--color-text-muted)">Nenhum chat selecionado</div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 bg-(--color-surface)">
        {" "}
        <Section id="actions" title="Acoes da conversa">
          {" "}
          <div className="space-y-3">
            {" "}
            <div>
              {" "}
              <label className="block text-xs text-(--color-text-muted) mb-1">
                {" "}
                Agente atribuido{" "}
                {currentAssigneeName && (
                  <span className="text-(--color-text) font-medium">
                    ({currentAssigneeName})
                  </span>
                )}
              </label>{" "}
              <select
                className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                value={assignedSelectValue}
                onChange={(e) =>
                  applyAssignee(e.target.value ? e.target.value : null)
                }
                disabled={!chat}
              >
                {" "}
                <option value="">Nenhum</option>{" "}
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.user_id ?? agent.id}>
                    {" "}
                    {agent.name}
                  </option>
                ))}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-xs text-(--color-text-muted) mb-1">
                Marcador da conversa
              </label>{" "}
              <div className="flex flex-wrap gap-2">
                {" "}
                {allTags.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  const color = tag.color || "#6B7280";
                  const buttonStyle: CSSProperties = selected
                    ? {
                        backgroundColor: color,
                        borderColor: color,
                        color: "#ffffff",
                      }
                    : {
                        borderColor: color,
                        color,
                      };
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`px-2 py-1 rounded-full text-xs border ${
                        selected ? "shadow-sm" : "bg-(--color-surface)"
                      }
`}
                      style={buttonStyle}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {" "}
                      <span className="inline-flex items-center gap-1">
                        {" "}
                        <span
                          className="h-2 w-2 rounded-full inline-block"
                          style={{
                            backgroundColor: color,
                          }}
                        />{" "}
                        {tag.name}
                      </span>{" "}
                    </button>
                  );
                })}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </Section>{" "}
        <Section id="macros" title="Macros">
          {" "}
          <div className="text-xs text-(--color-text-muted)">
            Sem macros configuradas.
          </div>{" "}
        </Section>{" "}
        <Section id="info" title="Informacoes da conversa">
          {" "}
          {chat ? (
            <div className="text-sm text-(--color-text) space-y-1">
              {" "}
              <div>
                {" "}
                <span className="text-(--color-text-muted)">Status:</span> {chat.status}
              </div>{" "}
              <div>
                {" "}
                <span className="text-(--color-text-muted)">Ultima mensagem:</span>{" "}
                {chat.last_message || "�"}
              </div>{" "}
            </div>
          ) : (
            <div className="text-xs text-(--color-text-muted)">Selecione um chat.</div>
          )}
        </Section>{" "}
        <Section id="participants" title="Participantes da conversa">
          {" "}
          <div className="space-y-1">
            {" "}
            {participants.length === 0 && (
              <div className="text-xs text-(--color-text-muted)">Nenhum participante.</div>
            )}
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between text-sm"
              >
                {" "}
                <div className="truncate">
                  {" "}
                  <span className="font-medium text-(--color-text)">
                    {participant.name}
                  </span>{" "}
                  {participant.role && (
                    <span className="ml-1 text-xs text-(--color-text-muted)">
                      ({participant.role})
                    </span>
                  )}
                </div>{" "}
                {participant.is_current && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {" "}
                    Voce{" "}
                  </span>
                )}
              </div>
            ))}
          </div>{" "}
        </Section>{" "}
        <Section id="pipeline" title="Etapa no funil">
          {" "}
          {leadId ? (
            <div className="space-y-3 text-sm">
              {" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Coluna
                </label>{" "}
                <select
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={currentStageId || ""}
                  onChange={(e) => setCurrentStageId(e.target.value || null)}
                  disabled={movingStage || !columns.length}
                >
                  {" "}
                  <option value="">Selecionar coluna...</option>{" "}
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {" "}
                      {column.title}
                    </option>
                  ))}
                </select>{" "}
              </div>{" "}
              {cardIdForLead ? (
                <>
                  {" "}
                  <div>
                    {" "}
                    <label className="block text-xs text-(--color-text-muted) mb-1">
                      Responsavel
                    </label>{" "}
                    <select
                      className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                      value={cardOwnerId || ""}
                      onChange={(e) => setCardOwnerId(e.target.value || null)}
                    >
                      {" "}
                      <option value="">Nenhum</option>{" "}
                      {agents.map((agent) => (
                        <option
                          key={agent.id}
                          value={agent.user_id ?? agent.id}
                        >
                          {" "}
                          {agent.name}
                        </option>
                      ))}
                    </select>{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <label className="block text-xs text-(--color-text-muted) mb-1">
                      Descricao
                    </label>{" "}
                    <textarea
                      className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                      rows={3}
                      value={cardDescription}
                      onChange={(e) => setCardDescription(e.target.value)}
                    />{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <label className="block text-xs text-(--color-text-muted) mb-1">
                      Posicao na coluna
                    </label>{" "}
                    <input
                      type="number"
                      className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                      value={cardPosition ?? ""}
                      onChange={(e) =>
                        setCardPosition(
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />{" "}
                    <div className="text-[11px] text-(--color-text-muted) mt-1">
                      {" "}
                      Posicoes iguais na mesma coluna nao sao permitidas.{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="pt-1 flex gap-2">
                    {" "}
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-800"
                      onClick={saveCardConfig}
                    >
                      {" "}
                      Salvar{" "}
                    </button>{" "}
                  </div>{" "}
                </>
              ) : (
                <div className="pt-1">
                  {" "}
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-800"
                    onClick={() =>
                      currentStageId && moveLeadToStage(currentStageId)
                    }
                    disabled={!currentStageId || movingStage}
                  >
                    {" "}
                    Salvar{" "}
                  </button>{" "}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-(--color-text-muted)">
              Lead nao identificado para este contato.
            </div>
          )}
        </Section>{" "}
        <Section id="meeting" title="Reuniao / Agenda">
          {" "}
          <div className="space-y-2 text-sm">
            {" "}
            {contactEvents.length > 0 ? (
              <div className="mb-2">
                {" "}
                <div className="text-xs text-(--color-text-muted) mb-1">
                  Eventos do contato
                </div>{" "}
                <div className="flex flex-wrap gap-2">
                  {" "}
                  {contactEvents.map((event: any) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`px-2 py-1 rounded-full text-xs border ${
                        expandedEventId === event.id
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                          : "bg-(--color-surface) border-(--color-border) text-(--color-text)"
                      }
`}
                      onClick={() => {
                        const next =
                          expandedEventId === event.id ? null : event.id;
                        setExpandedEventId(next);
                        if (next) {
                          setEventEdit((prev) => ({
                            ...prev,
                            [event.id]: {
                              title: event.title || "",
                              description:
                                event.extendedProps?.description || "",
                              location: event.extendedProps?.location || "",
                              event_type:
                                event.extendedProps?.event_type || "OTHER",
                              status:
                                event.extendedProps?.status || "SCHEDULED",
                              start_time: fmtLocal(event.start),
                              end_time: fmtLocal(event.end),
                            },
                          }));
                        }
                      }}
                    >
                      {" "}
                      {event.title || "Sem titulo"}
                    </button>
                  ))}
                </div>{" "}
                {expandedEventId && (
                  <div className="mt-2 p-2 border rounded-lg bg-[color-mix(in_srgb,var(--color-text)_4%,var(--color-surface))]">
                    {" "}
                    {(() => {
                      const edit = eventEdit[expandedEventId] || {};
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          {" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Titulo
                            </label>{" "}
                            <input
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.title || ""}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    title: e.target.value,
                                  },
                                }))
                              }
                            />{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Local
                            </label>{" "}
                            <input
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.location || ""}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    location: e.target.value,
                                  },
                                }))
                              }
                            />{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Inicio
                            </label>{" "}
                            <input
                              type="datetime-local"
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.start_time || ""}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    start_time: e.target.value,
                                  },
                                }))
                              }
                            />{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Fim
                            </label>{" "}
                            <input
                              type="datetime-local"
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.end_time || ""}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    end_time: e.target.value,
                                  },
                                }))
                              }
                            />{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Tipo
                            </label>{" "}
                            <select
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.event_type || "OTHER"}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    event_type: e.target.value,
                                  },
                                }))
                              }
                            >
                              {" "}
                              {[
                                "MEETING",
                                "CALL",
                                "TECHNICAL_VISIT",
                                "FOLLOW_UP",
                                "OTHER",
                              ].map((type) => (
                                <option key={type} value={type}>
                                  {" "}
                                  {type}
                                </option>
                              ))}
                            </select>{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Status
                            </label>{" "}
                            <select
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              value={edit.status || "SCHEDULED"}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    status: e.target.value,
                                  },
                                }))
                              }
                            >
                              {" "}
                              {["SCHEDULED", "COMPLETED", "CANCELLED"].map(
                                (status) => (
                                  <option key={status} value={status}>
                                    {" "}
                                    {status}
                                  </option>
                                ),
                              )}
                            </select>{" "}
                          </div>{" "}
                          <div className="col-span-2">
                            {" "}
                            <label className="block text-xs text-(--color-text-muted) mb-1">
                              Descricao
                            </label>{" "}
                            <textarea
                              className="w-full bg-(--color-surface) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text)"
                              rows={3}
                              value={edit.description || ""}
                              onChange={(e) =>
                                setEventEdit((prev) => ({
                                  ...prev,
                                  [expandedEventId]: {
                                    ...prev[expandedEventId],
                                    description: e.target.value,
                                  },
                                }))
                              }
                            />{" "}
                          </div>{" "}
                          <div className="col-span-2 flex gap-2">
                            {" "}
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg bg-(--color-surface-muted) text-(--color-text) text-sm hover:bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-surface-muted))]"
                              onClick={() => setExpandedEventId(null)}
                            >
                              {" "}
                              Fechar{" "}
                            </button>{" "}
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-800"
                              onClick={async () => {
                                try {
                                  const patch = {
                                    ...eventEdit[expandedEventId],
                                  };
                                  const updated = await requestJson<any>(
                                    `${apiBase}
/calendar/events/${expandedEventId}
`,
                                    {
                                      method: "PUT",
                                      body: JSON.stringify(patch),
                                    },
                                  );
                                  setContactEvents((prev) =>
                                    prev.map((item) =>
                                      item.id === expandedEventId
                                        ? {
                                            ...item,
                                            title: updated.title,
                                            start: updated.start_time,
                                            end: updated.end_time,
                                            extendedProps: {
                                              ...item.extendedProps,
                                              description: updated.description,
                                              location: updated.location,
                                              event_type: updated.event_type,
                                              status: updated.status,
                                            },
                                          }
                                        : item,
                                    ),
                                  );
                                  setExpandedEventId(null);
                                } catch (error: any) {
                                  alert(
                                    typeof error?.message === "string"
                                      ? error.message
                                      : "Falha ao atualizar evento",
                                  );
                                }
                              }}
                            >
                              {" "}
                              Salvar{" "}
                            </button>{" "}
                          </div>{" "}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-(--color-text-muted)">
                {" "}
                Nenhum evento para este contato no periodo selecionado.{" "}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Calendario
                </label>{" "}
                <select
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.calendar_id}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      calendar_id: e.target.value,
                    }))
                  }
                >
                  {" "}
                  <option value="">Selecione...</option>{" "}
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {" "}
                      {calendar.name}
                    </option>
                  ))}
                </select>{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Tipo
                </label>{" "}
                <select
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.event_type}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      event_type: e.target.value as EventForm["event_type"],
                    }))
                  }
                >
                  {" "}
                  {[
                    "MEETING",
                    "CALL",
                    "TECHNICAL_VISIT",
                    "FOLLOW_UP",
                    "OTHER",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {" "}
                      {type}
                    </option>
                  ))}
                </select>{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Titulo
                </label>{" "}
                <input
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Local
                </label>{" "}
                <input
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.location}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                />{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Inicio
                </label>{" "}
                <input
                  type="datetime-local"
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.start_time}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      start_time: e.target.value,
                    }))
                  }
                />{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Fim
                </label>{" "}
                <input
                  type="datetime-local"
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  value={eventForm.end_time}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      end_time: e.target.value,
                    }))
                  }
                />{" "}
              </div>{" "}
              <div className="col-span-2">
                {" "}
                <label className="block text-xs text-(--color-text-muted) mb-1">
                  Descricao
                </label>{" "}
                <textarea
                  className="w-full bg-(--color-surface-muted) rounded-lg px-3 py-2 text-sm text-(--color-text) border border-(--color-border)"
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />{" "}
              </div>{" "}
            </div>{" "}
            <div className="flex gap-2">
              {" "}
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-800"
                onClick={createMeeting}
              >
                {" "}
                Criar{" "}
              </button>{" "}
              {lastCreatedEvent?.id && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-(--color-surface-muted) text-(--color-text) text-sm hover:bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-surface-muted))]"
                    onClick={() =>
                      updateMeeting({
                        title: eventForm.title,
                        description: eventForm.description,
                        location: eventForm.location,
                        event_type: eventForm.event_type,
                        start_time: eventForm.start_time,
                        end_time: eventForm.end_time,
                      })
                    }
                  >
                    {" "}
                    Atualizar{" "}
                  </button>{" "}
                  <span className="text-xs text-(--color-text-muted) self-center">
                    {" "}
                    Evento criado: {lastCreatedEvent.title}
                  </span>{" "}
                </>
              )}
            </div>{" "}
          </div>{" "}
        </Section>{" "}
      </div>{" "}
    </div>
  );
}



