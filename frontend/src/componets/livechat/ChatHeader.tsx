import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
	FiAlertCircle,
	FiCheck,
	FiCheckSquare,
	FiCpu,
	FiEdit3,
	FiGrid,
	FiLoader,
	FiPhone,
	FiTag,
	FiUser,
	FiUserMinus,
	FiUsers,
	FiHash,
} from "react-icons/fi";
import type { Chat, Tag } from "./types";

type InboxAgent = {
	id: string;
	user_id: string;
	name: string | null;
	role: string | null;
	avatarUrl: string | null;
};

type AIAgent = {
	id: string;
	name: string;
	status: string;
	description?: string | null;
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
	funnelStages?: FunnelStage[];
	currentStageId?: string | null;
	currentStageName?: string | null;
	currentNote?: string | null;
	onChangeStage?: (stageId: string) => Promise<void> | void;
	onUpdateNote?: (note: string) => Promise<void> | void;
	chatLeadId?: string | null;
	customerEmail?: string | null;
	customerPhone?: string | null;
	fallbackCardTitle?: string | null;
	currentStatus?: string | null;
	statusOptions?: Array<{ value: string; label: string }>;
	onChangeStatus?: (nextStatus: string) => Promise<void> | void;
	departments?: Array<{ id: string; name: string; color?: string | null; icon?: string | null }>;
	departmentsLoading?: boolean;
	selectedDepartmentId?: string | null;
	onChangeDepartment?: (departmentId: string | null) => Promise<void> | void;
	isDepartmentChanging?: boolean;
	departmentError?: string | null;
	aiAgentId?: string | null;
	aiAgentName?: string | null;
	onAssignAIAgent?: (agentId: string | null) => Promise<void> | void;
  onToggleInfo?: () => void;
};

type Panel = "tags" | "agents" | "stage" | "status" | "department" | "ai-agents" | null;

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
	currentStageName,
	currentNote,
	onChangeStage,
	onUpdateNote,
	chatLeadId,
	customerEmail,
	customerPhone,
	fallbackCardTitle,
	currentStatus,
	statusOptions,
	onChangeStatus,
	departments,
	departmentsLoading,
  onToggleInfo,
	selectedDepartmentId,
	onChangeDepartment,
	isDepartmentChanging,
	departmentError,
	aiAgentId,
	aiAgentName,
	onAssignAIAgent,
}: ChatHeaderProps) {
	const [openPanel, setOpenPanel] = useState<Panel>(null);
	const [agents, setAgents] = useState<InboxAgent[]>([]);
	const [agentsLoading, setAgentsLoading] = useState(false);
	const [agentsError, setAgentsError] = useState<string | null>(null);
	const [assigningAgent, setAssigningAgent] = useState<string | null>(null);
	const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
	const [aiAgentsLoading, setAIAgentsLoading] = useState(false);
	const [aiAgentsError, setAIAgentsError] = useState<string | null>(null);
	const [assigningAIAgent, setAssigningAIAgent] = useState<string | null>(null);
	const [stageDraft, setStageDraft] = useState<string | null>(currentStageId ?? chat?.stage_id ?? null);
	const [noteDraft, setNoteDraft] = useState<string>(currentNote ?? chat?.note ?? "");
	const [stageError, setStageError] = useState<string | null>(null);
	const [savingStage, setSavingStage] = useState(false);

	const statusValue = useMemo(() => {
		const raw = (currentStatus ?? chat?.status ?? "")?.toString() ?? "";
		return raw.toUpperCase();
	}, [chat?.status, currentStatus]);

	const statusLabel = useMemo(() => {
		if (!statusValue) return null;
		const match = statusOptions?.find((option) => option.value.toUpperCase() === statusValue);
		return match?.label ?? statusValue;
	}, [statusOptions, statusValue]);

	const assignedTags = useMemo(() => {
		if (!tags?.length || !selectedTagIds?.length) return [] as Tag[];
		const map = new Map(tags.map((tag) => [tag.id, tag]));
		return selectedTagIds
			.map((id) => map.get(id))
			.filter(Boolean) as Tag[];
	}, [tags, selectedTagIds]);

	const assignedTagIds = useMemo(() => new Set(selectedTagIds ?? []), [selectedTagIds]);

	const currentAssigneeName = assigneeName ?? chat?.assigned_agent_name ?? null;

	const currentDepartment = useMemo(() => {
		if (!selectedDepartmentId && !chat?.department_id) return null;
		const targetId = selectedDepartmentId ?? chat?.department_id ?? null;
		if (!targetId) return null;
		return departments?.find((dept) => dept.id === targetId) ??
			(chat?.department_id === targetId
				? {
						id: targetId,
						name: chat?.department_name ?? "Departamento",
						color: chat?.department_color ?? undefined,
						icon: chat?.department_icon ?? undefined,
					}
				: null);
	}, [departments, selectedDepartmentId, chat?.department_id, chat?.department_name, chat?.department_color, chat?.department_icon]);

	const chatTitle = useMemo(() => {
		if (!chat) return fallbackCardTitle ?? "";
		return (
			chat.customer_name ??
			chat.display_name ??
			chat.group_name ??
			fallbackCardTitle ??
			chat.remote_id ??
			chat.external_id ??
			chat.id
		);
	}, [chat, fallbackCardTitle]);

	const leadLabel = chatLeadId ?? (chat as any)?.lead_id ?? (chat as any)?.leadId ?? null;
	const phoneLabel = customerPhone ?? chat?.customer_phone ?? chat?.display_phone ?? null;

	const stageLabel = useMemo(() => {
		return currentStageName ?? funnelStages?.find((stage) => stage.id === (currentStageId ?? chat?.stage_id))?.name ?? null;
	}, [currentStageName, funnelStages, currentStageId, chat?.stage_id]);

	const togglePanel = (panel: Panel) => {
		setOpenPanel((prev) => (prev === panel ? null : panel));
	};

	useEffect(() => {
		setOpenPanel(null);
		setStageDraft(currentStageId ?? chat?.stage_id ?? null);
		setNoteDraft(currentNote ?? chat?.note ?? "");
		setStageError(null);
	}, [chat?.id, currentStageId, currentNote, chat?.stage_id, chat?.note]);

	useEffect(() => {
		if (openPanel !== "agents" || !chat) {
			return;
		}

		let cancelled = false;
		const loadAgents = async () => {
			const effectiveInboxId = inboxId ?? chat.inbox_id;
			if (!effectiveInboxId) return;
			setAgentsLoading(true);
			setAgentsError(null);
			try {
				const response = await fetch(`${apiBase}/livechat/inboxes/${effectiveInboxId}/agents`, {
					credentials: "include",
				});
				if (!response.ok) {
					throw new Error(`Falha ao carregar agentes (${response.status})`);
				}
				const payload = await response.json();
				if (cancelled) return;
				const list = Array.isArray(payload)
					? payload
					: Array.isArray(payload?.data)
					? payload.data
					: [];
				const normalized: InboxAgent[] = list
					.map((item: any, index: number) => {
						const userId = item?.user_id ?? item?.userId ?? item?.id ?? item?.authuser_id;
						if (!userId) return null;
						return {
							id: String(item?.id ?? userId ?? index),
							user_id: String(userId),
							name:
								item?.name ??
								item?.full_name ??
								item?.display_name ??
								item?.user_name ??
								item?.user?.name ??
								null,
							role: item?.role ?? item?.user_role ?? null,
							avatarUrl: item?.avatarUrl ?? item?.avatar_url ?? item?.avatar ?? null,
						} as InboxAgent;
					})
					.filter(Boolean) as InboxAgent[];
				setAgents(normalized);
			} catch (error) {
				if (!cancelled) {
					console.error("[ChatHeader] Falha ao carregar agentes", error);
					setAgents([]);
					setAgentsError(error instanceof Error ? error.message : "Erro ao carregar agentes");
				}
			} finally {
				if (!cancelled) {
					setAgentsLoading(false);
				}
			}
		};

		loadAgents();

		return () => {
			cancelled = true;
		};
	}, [openPanel, chat, inboxId, apiBase]);

	// Load AI agents when panel opens
	useEffect(() => {
		if (openPanel !== "ai-agents") return;
		let cancelled = false;
		const loadAIAgents = async () => {
			setAIAgentsLoading(true);
			setAIAgentsError(null);
			try {
				const url = `${apiBase}/api/agents?active=true`;
				const response = await fetch(url, {
					method: "GET",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
				});
				if (!response.ok) {
					throw new Error(`Falha ao carregar agentes de IA: ${response.statusText}`);
				}
				const data = await response.json();
				if (!cancelled) {
					const normalized = (Array.isArray(data) ? data : [])
						.map((agent: any) => ({
							id: agent.id,
							name: agent.name || "Sem nome",
							status: agent.status || "ACTIVE",
							description: agent.description || null,
						}))
						.filter((a: AIAgent) => a.status === "ACTIVE");
					setAIAgents(normalized);
				}
			} catch (error) {
				if (!cancelled) {
					console.error("[ChatHeader] Falha ao carregar agentes de IA", error);
					setAIAgents([]);
					setAIAgentsError(error instanceof Error ? error.message : "Erro ao carregar agentes de IA");
				}
			} finally {
				if (!cancelled) {
					setAIAgentsLoading(false);
				}
			}
		};
		loadAIAgents();
		return () => {
			cancelled = true;
		};
	}, [openPanel, apiBase]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpenPanel(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleAssignAgent = async (userId: string | null) => {
		if (!onAssignAgent) return;
		setAssigningAgent(userId ?? "__none__");
		setAgentsError(null);
		try {
			await onAssignAgent(userId);
			setOpenPanel(null);
		} catch (error) {
			console.error("[ChatHeader] Falha ao atribuir agente", error);
			setAgentsError(error instanceof Error ? error.message : "Erro ao atribuir agente");
		} finally {
			setAssigningAgent(null);
		}
	};

	const handleAssignAIAgent = async (agentId: string | null) => {
		if (!onAssignAIAgent) return;
		setAssigningAIAgent(agentId ?? "__none__");
		setAIAgentsError(null);
		try {
			await onAssignAIAgent(agentId);
			setOpenPanel(null);
		} catch (error) {
			console.error("[ChatHeader] Falha ao atribuir agente de IA", error);
			setAIAgentsError(error instanceof Error ? error.message : "Erro ao atribuir agente de IA");
		} finally {
			setAssigningAIAgent(null);
		}
	};

	const handleSaveStage = async () => {
		if (!chat) return;
		const stageChanged = stageDraft && stageDraft !== (currentStageId ?? chat.stage_id ?? null);
		const noteChanged = noteDraft !== (currentNote ?? chat.note ?? "");
		if (!stageChanged && !noteChanged) {
			setOpenPanel(null);
			return;
		}

		setStageError(null);
		setSavingStage(true);
		try {
			if (stageChanged && stageDraft && onChangeStage) {
				await onChangeStage(stageDraft);
			}
			if (noteChanged && onUpdateNote) {
				await onUpdateNote(noteDraft);
			}
			setOpenPanel(null);
		} catch (error) {
			console.error("[ChatHeader] Falha ao salvar etapa/nota", error);
			setStageError(error instanceof Error ? error.message : "Erro ao salvar alterações");
		} finally {
			setSavingStage(false);
		}
	};

	const handleStatusChange = async (value: string) => {
		if (!onChangeStatus || value === statusValue) {
			setOpenPanel(null);
			return;
		}
		try {
			await onChangeStatus(value);
			setOpenPanel(null);
		} catch (error) {
			console.error("[ChatHeader] Falha ao alterar status", error);
		}
	};

	const handleDepartmentChange = async (departmentId: string | null) => {
		if (!onChangeDepartment) {
			setOpenPanel(null);
			return;
		}
		try {
			await onChangeDepartment(departmentId);
			setOpenPanel(null);
		} catch (error) {
			console.error("[ChatHeader] Falha ao alterar departamento", error);
		}
	};

	const renderPanel = () => {
		if (!chat) return null;

		switch (openPanel) {
			case "tags":
				return (
					<PanelCard title="Tags">
						{tags.length === 0 && <EmptyMessage>Nenhuma tag cadastrada.</EmptyMessage>}
						{tags.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{tags.map((tag) => {
									const active = assignedTagIds.has(tag.id);
									return (
										<button
											key={tag.id}
											type="button"
											onClick={() => onToggleTag?.(tag.id)}
											className={`rounded-full px-3 py-1 text-xs font-medium transition ${
												active
													? "text-white shadow" 
													: "border border-[color:var(--color-border)] text-[color:var(--color-text-muted)]"
											}`}
											style={
												active
													? {
															backgroundColor: tag.color ?? "var(--color-primary)",
														}
													: undefined
											}
										>
											{tag.name}
										</button>
									);
								})}
							</div>
						)}
					</PanelCard>
				);
			case "agents":
				return (
					<PanelCard title="Responsáveis">
						{agentsLoading && (
							<PanelRow>
								<Spinner /> Carregando agentes...
							</PanelRow>
						)}
					{agentsError && (
						<PanelRow className="text-(--color-danger,#dc2626)">
							<FiAlertCircle className="mr-2" />
								{agentsError}
							</PanelRow>
						)}
						{!agentsLoading && agents.length === 0 && !agentsError && (
							<EmptyMessage>Nenhum agente disponível.</EmptyMessage>
						)}

						<div className="flex flex-col gap-2">
							<AgentButton
								label="Sem responsável"
								annotation="Remover atribuição"
								active={!assigneeUserId && !chat.assigned_agent_user_id}
								loading={assigningAgent === "__none__"}
								onClick={() => handleAssignAgent(null)}
							/>

							{agents.map((agent) => {
								const active = (assigneeUserId ?? chat.assigned_agent_user_id ?? null) === agent.user_id;
								const loading = assigningAgent === agent.user_id;
								return (
									<AgentButton
										key={agent.user_id}
										label={agent.name ?? agent.user_id}
										annotation={agent.role ?? undefined}
										active={active}
										loading={loading}
										onClick={() => handleAssignAgent(agent.user_id)}
									/>
								);
							})}
						</div>
					</PanelCard>
				);
			case "stage":
				return (
					<PanelCard title="Etapa do funil">
						{funnelStages && funnelStages.length > 0 ? (
						<div className="flex flex-col gap-2">
							<label className="text-xs font-medium text-(--color-text-muted)">
								Selecionar etapa
							</label>
							<select
								className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
									value={stageDraft ?? ""}
									onChange={(event) => setStageDraft(event.target.value || null)}
								>
									<option value="">Selecionar...</option>
									{funnelStages.map((stage) => (
										<option key={stage.id} value={stage.id}>
											{stage.name}
										</option>
									))}
								</select>
							</div>
						) : (
							<EmptyMessage>Nenhuma etapa configurada.</EmptyMessage>
						)}

						<div className="flex flex-col gap-2">
							<label className="text-xs font-medium text-[color:var(--color-text-muted)]">
								Observações
							</label>
							<textarea
								className="min-h-[96px] w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
								placeholder="Adicionar nota sobre o cliente"
								value={noteDraft}
								onChange={(event) => setNoteDraft(event.target.value)}
							/>
						</div>

					{stageError && (
						<PanelRow className="text-(--color-danger,#dc2626)">
							<FiAlertCircle className="mr-2" />
						{stageError}
					</PanelRow>
				)}						<div className="flex justify-end gap-2">
						<button
							type="button"
							className="rounded-lg border border-(--color-border) px-4 py-2 text-sm"
							onClick={() => {
								setStageDraft(currentStageId ?? chat.stage_id ?? null);
								setNoteDraft(currentNote ?? chat.note ?? "");
									setOpenPanel(null);
								}}
								disabled={savingStage}
							>
								Cancelar
							</button>
							<button
								type="button"
								className="flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-on-primary,#ffffff)] shadow disabled:opacity-70"
								onClick={handleSaveStage}
								disabled={savingStage}
							>
								{savingStage && <Spinner />}Salvar
							</button>
						</div>
					</PanelCard>
				);
			case "status":
				return (
					<PanelCard title="Status">
						{!statusOptions?.length && <EmptyMessage>Nenhum status disponível.</EmptyMessage>}
						{statusOptions?.length && (
							<div className="flex flex-col gap-2">
								{statusOptions.map((option) => {
									const active = option.value.toUpperCase() === statusValue;
									return (
										<button
											key={option.value}
											type="button"
											className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
												active
													? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]"
													: "border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)]/60"
											}`}
											onClick={() => handleStatusChange(option.value)}
										>
											<span>{option.label}</span>
											{active && <FiCheck />}
										</button>
									);
								})}
							</div>
						)}
					</PanelCard>
				);
			case "ai-agents":
				return (
					<PanelCard title="Agente de IA">
						{aiAgentsLoading && (
							<PanelRow>
								<Spinner /> Carregando agentes...
							</PanelRow>
						)}
					{aiAgentsError && (
						<PanelRow className="text-(--color-danger,#dc2626)">
							<FiAlertCircle className="mr-2" />
								{aiAgentsError}
							</PanelRow>
						)}
						{!aiAgentsLoading && !aiAgentsError && (
							<>
								{aiAgents.length === 0 && <EmptyMessage>Nenhum agente de IA disponível.</EmptyMessage>}
								{aiAgents.length > 0 && (
									<div className="flex flex-col gap-2">
										<AgentButton
											label="Nenhum agente"
											annotation="Remover agente de IA"
											active={!aiAgentId}
											loading={assigningAIAgent === "__none__"}
											onClick={() => handleAssignAIAgent(null)}
										/>
										{aiAgents.map((agent) => {
											const active = aiAgentId === agent.id;
											const loading = assigningAIAgent === agent.id;
											return (
												<AgentButton
													key={agent.id}
													label={agent.name}
													annotation={agent.description ? agent.description.slice(0, 60) : undefined}
													active={active}
													loading={loading}
													onClick={() => handleAssignAIAgent(agent.id)}
												/>
											);
										})}
									</div>
								)}
							</>
						)}
					</PanelCard>
				);
			case "department":
				return (
					<PanelCard title="Departamentos">
						{departmentsLoading && (
							<PanelRow>
								<Spinner /> Carregando departamentos...
							</PanelRow>
						)}
						{!departmentsLoading && (!departments || departments.length === 0) && (
							<EmptyMessage>Nenhum departamento configurado.</EmptyMessage>
						)}
					{departmentError && (
						<PanelRow className="text-(--color-danger,#dc2626)">
							<FiAlertCircle className="mr-2" />
							{departmentError}
						</PanelRow>
					)}

					<div className="flex flex-col gap-2">
						<button
							type="button"
							className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
								!selectedDepartmentId && !chat.department_id
									? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
									: "border-(--color-border) text-(--color-text) hover:bg-(--color-surface-muted)/60"
							}`}
								onClick={() => handleDepartmentChange(null)}
								disabled={isDepartmentChanging}
							>
								<span>Sem departamento</span>
								{!selectedDepartmentId && !chat.department_id && <FiCheck />}
							</button>

							{departments?.map((department) => {
								const active = (selectedDepartmentId ?? chat.department_id ?? null) === department.id;
								return (
									<button
										key={department.id}
										type="button"
										className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
											active
												? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]"
												: "border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)]/60"
										}`}
										onClick={() => handleDepartmentChange(department.id)}
										disabled={isDepartmentChanging}
									>
										<span>{department.name}</span>
										{active && <FiCheck />}
									</button>
								);
							})}
						</div>
					</PanelCard>
				);
			default:
				return null;
		}
	};

	const panelContent = renderPanel();

	return (
		<div className="relative mb-4 mx-4 mt-4 p-4 rounded-xl bg-(--color-surface) border border-(--color-border) shadow-sm">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex flex-1 items-start gap-3">
					<AvatarCircle name={chatTitle} />
				<div className="flex flex-col gap-2 overflow-hidden">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="truncate text-base font-semibold text-(--color-heading)">
							{chat ? chatTitle : "Selecione um chat"}
						</h2>
						{statusLabel && (
							<span className="rounded-full border border-(--color-border) px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
								{statusLabel}
							</span>
						)}
            {onToggleInfo && (
              <button 
                onClick={onToggleInfo}
                className="ml-2 p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Ver informações do contato"
              >
                <FiUser size={16} />
              </button>
            )}
					</div>

					<div className="flex flex-wrap items-center gap-2 text-xs text-(--color-text-muted)">
							{leadLabel && (
								<InfoChip icon={<FiHash />} label={`Lead ${leadLabel}`} />
							)}
							{phoneLabel && (
								<InfoChip icon={<FiPhone />} label={phoneLabel} />
							)}
							{currentAssigneeName && (
								<InfoChip icon={<FiUser />} label={currentAssigneeName} />
							)}
							{currentDepartment && (
								<InfoChip icon={<FiGrid />} label={currentDepartment.name} />
							)}
							{stageLabel && (
								<InfoChip icon={<FiCheckSquare />} label={stageLabel} />
							)}
						</div>

						{assignedTags.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{assignedTags.map((tag) => (
									<span
										key={tag.id}
										className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
										style={{ backgroundColor: tag.color ?? "var(--color-primary)" }}
									>
										{tag.name}
									</span>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2 self-start lg:self-auto">
					<IconButton
						icon={<FiTag />}
						label="Gerenciar tags"
						active={openPanel === "tags"}
						disabled={!chat}
						onClick={() => togglePanel("tags")}
					/>
					<IconButton
						icon={<FiUsers />}
						label="Atribuir responsável"
						active={openPanel === "agents"}
						disabled={!chat || !onAssignAgent}
						onClick={() => togglePanel("agents")}
					/>
					<IconButton
						icon={<FiCheckSquare />}
						label="Alterar status"
						active={openPanel === "status"}
						disabled={!chat || !statusOptions?.length}
						onClick={() => togglePanel("status")}
					/>
					<IconButton
						icon={<FiGrid />}
						label="Etapa e nota"
						active={openPanel === "stage"}
						disabled={!chat}
						onClick={() => togglePanel("stage")}
					/>
					<IconButton
						icon={<FiEdit3 />}
						label="Departamentos"
						active={openPanel === "department"}
						disabled={!chat}
						onClick={() => togglePanel("department")}
					/>
					<IconButton
						icon={<FiCpu />}
						label="Agente de IA"
						active={openPanel === "ai-agents"}
						disabled={!chat || !onAssignAIAgent}
						onClick={() => togglePanel("ai-agents")}
					/>
				</div>
			</div>
			{panelContent && (
				<div className="pointer-events-none absolute right-0 top-full z-40 mt-3 w-full max-w-88 md:max-w-104">
					<div className="pointer-events-auto">
						{panelContent}
					</div>
				</div>
			)}
		</div>
	);
}

function AvatarCircle({ name }: { name: string }) {
	const initials = useMemo(() => {
		if (!name) return "?";
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return name.slice(0, 2).toUpperCase();
		if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
		return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
	}, [name]);

	return (
		<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-(--color-surface-muted) text-sm font-semibold text-(--color-text-muted)">
			{initials}
		</div>
	);
}

function IconButton({ icon, label, active, disabled, onClick }: { icon: ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			className={`flex h-10 w-10 items-center justify-center rounded-full border text-(--color-text-muted) transition ${
				active
					? "border-(--color-primary) text-(--color-primary) shadow"
					: "border-(--color-border) hover:bg-(--color-surface-muted)/60"
			}`}
			onClick={onClick}
			title={label}
			aria-label={label}
			disabled={disabled}
		>
			{icon}
		</button>
	);
}

function PanelCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-2xl">
			<div className="mb-3 text-sm font-semibold text-(--color-heading)">{title}</div>
			<div className="flex flex-col gap-3 text-sm text-(--color-text)">{children}</div>
		</div>
	);
}

function PanelRow({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={`flex items-center text-sm ${className ?? "text-(--color-text-muted)"}`}>{children}</div>;
}

function EmptyMessage({ children }: { children: ReactNode }) {
	return <div className="text-sm text-(--color-text-muted)">{children}</div>;
}

function Spinner() {
	return <FiLoader className="h-4 w-4 animate-spin" />;
}

function InfoChip({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<span className="flex items-center gap-1 rounded-full border border-(--color-border) px-2 py-0.5">
			{icon}
			<span>{label}</span>
		</span>
	);
}

function AgentButton({
	label,
	annotation,
	active,
	loading,
	onClick,
}: {
	label: string;
	annotation?: string;
	active?: boolean;
	loading?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
				active
					? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
					: "border-(--color-border) text-(--color-text) hover:bg-(--color-surface-muted)/60"
			}`}
			onClick={onClick}
		>
			<div className="flex flex-col text-left">
				<span className="font-medium">{label}</span>
				{annotation && <span className="text-xs text-(--color-text-muted)">{annotation}</span>}
			</div>
			{loading ? <Spinner /> : active ? <FiCheck /> : <FiUserMinus className="opacity-40" />}
		</button>
	);
}

