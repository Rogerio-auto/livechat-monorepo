import { ReactNode, useEffect, useRef, useState } from "react";
import {
	FaGraduationCap,
	FaChartLine,
	FaHospital,
	FaSolarPanel,
	FaHardHat,
	FaHome,
	FaCalendarAlt,
	FaBalanceScale,
	FaArrowLeft,
	FaCheck,
	FaRobot,
	FaComments,
	FaBoxOpen,
	FaBolt,
	FaSpinner,
} from "react-icons/fa";
import type { Industry, IndustryConfig, OnboardingStep3Data } from "../../types/cadastro";
import { INDUSTRIES } from "../../types/cadastro";
import { useCadastro } from "../../hooks/useCadastro";

interface OnboardingModalProps {
	isOpen: boolean;
	onComplete: () => void;
}

const ICONS = {
	FaGraduationCap,
	FaChartLine,
	FaHospital,
	FaSolarPanel,
	FaHardHat,
	FaHome,
	FaCalendarAlt,
	FaBalanceScale,
};

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
	const [step, setStep] = useState(1);
	const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
	const [preferences, setPreferences] = useState<OnboardingStep3Data>({
		wants_ai_agent: true,
		wants_templates: true,
		wants_catalog: true,
	});
	const [industryConfig, setIndustryConfig] = useState<IndustryConfig | null>(null);
	const [configLoading, setConfigLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hydrated = useRef(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const { status, loading: requestLoading, saveStep1, saveStep3, complete, fetchIndustryConfig } = useCadastro();

	useEffect(() => {
		if (!status || hydrated.current) return;

		if (status.industry) {
			setSelectedIndustry(status.industry);
		}

		if (status.data?.preferences) {
			setPreferences((prev) => ({
				...prev,
				...status.data.preferences,
			}));
		}

		hydrated.current = true;
	}, [status]);

	useEffect(() => {
		if (!isOpen) return;

		setStep(1);
		setError(null);
		containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
	}, [isOpen]);

	useEffect(() => {
		if (step !== 2 || !selectedIndustry) return;
		if (industryConfig?.industry === selectedIndustry) return;

		setConfigLoading(true);
		fetchIndustryConfig(selectedIndustry)
			.then((config) => setIndustryConfig(config))
			.catch(() => setIndustryConfig(null))
			.finally(() => setConfigLoading(false));
	}, [step, selectedIndustry, industryConfig?.industry, fetchIndustryConfig]);

	const handleSubmitIndustry = async () => {
		if (!selectedIndustry) {
			setError("Selecione um nicho para continuar.");
			return;
		}

		try {
			setError(null);
			await saveStep1({ industry: selectedIndustry });
			setStep(2);
			containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Não foi possível salvar o nicho escolhido.";
			setError(message);
		}
	};

	const handleSubmitPreferences = async () => {
		try {
			setError(null);
			await saveStep3(preferences);
			await complete();
			onComplete();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Não foi possível salvar suas preferências.";
			setError(message);
		}
	};

	const handleBack = () => {
		setError(null);
		setStep((current) => Math.max(1, current - 1));
		containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	};

	const renderIndustryCards = () => (
		<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
			{INDUSTRIES.map((industry) => {
				const Icon = ICONS[industry.icon as keyof typeof ICONS];
				const isSelected = selectedIndustry === industry.id;

				return (
					<button
						key={industry.id}
						type="button"
						onClick={() => {
							setSelectedIndustry(industry.id);
							setError(null);
						}}
						className="rounded-xl border-2 px-5 py-5 text-left transition-all"
						style={{
							borderColor: isSelected
								? "color-mix(in srgb, var(--color-primary) 55%, transparent)"
								: "color-mix(in srgb, var(--color-border) 85%, transparent)",
							backgroundColor: isSelected
								? "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))"
								: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
							boxShadow: isSelected
								? "0 18px 32px -24px color-mix(in srgb, var(--color-primary) 55%, transparent)"
								: "none",
						}}
					>
						<div
							className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
							style={{ backgroundColor: `${industry.color}33`, color: industry.color }}
						>
							{Icon && <Icon />}
						</div>
						<h3 className="mb-2 text-lg font-semibold theme-heading">{industry.name}</h3>
						<p className="mb-3 text-sm theme-text-muted">{industry.description}</p>
						<ul className="space-y-1 text-xs theme-text-muted">
							{industry.features.map((feature, idx) => (
								<li key={idx} className="flex items-start gap-2">
									<span
										className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full"
										style={{
											backgroundColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
											color: "var(--color-primary)",
										}}
									>
										<FaCheck size={10} />
									</span>
									<span>{feature}</span>
								</li>
							))}
						</ul>
					</button>
				);
			})}
		</div>
	);

	const renderPreferencesContent = (config: IndustryConfig | null) => {
		const enabledModules = config?.enabled_modules ?? [];
		const templatesCount = config?.templates_count ?? 0;

		const modulesBadge = (() => {
			if (enabledModules.length === 0) return undefined;
			if (enabledModules.length === 1) return enabledModules[0];
			return `${enabledModules[0]} +${enabledModules.length - 1}`;
		})();

		return (
			<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
				<PreferenceCard
					title={config?.agent_name ? `Ativar o agente ${config.agent_name}` : "Quero um agente de IA"}
					description="Configura respostas inteligentes para acelerar o atendimento e qualificar clientes."
					icon={<FaRobot size={22} />}
					active={preferences.wants_ai_agent}
					onToggle={() =>
						setPreferences((prev) => ({
							...prev,
							wants_ai_agent: !prev.wants_ai_agent,
						}))
					}
					highlight={config?.agent_name ? "Pronto para instalar" : undefined}
				/>
				<PreferenceCard
					title="Ativar templates de mensagens"
					description={
						templatesCount > 0
							? `Disponibiliza ${templatesCount} templates recomendados para o seu nicho.`
							: "Sugestões de mensagens para responder mais rápido."
					}
					icon={<FaComments size={22} />}
					active={preferences.wants_templates}
					onToggle={() =>
						setPreferences((prev) => ({
							...prev,
							wants_templates: !prev.wants_templates,
						}))
					}
					highlight={templatesCount > 0 ? "Recomendado" : undefined}
				/>
				<PreferenceCard
					title="Usar catálogo de produtos/serviços"
					description={
						modulesBadge
							? `Habilita módulos como ${modulesBadge}.`
							: "Organize itens, preços e disponibilidade em um só lugar."
					}
					icon={<FaBoxOpen size={22} />}
					active={preferences.wants_catalog}
					onToggle={() =>
						setPreferences((prev) => ({
							...prev,
							wants_catalog: !prev.wants_catalog,
						}))
					}
					highlight={modulesBadge ? "Integra módulos" : undefined}
				/>
			</div>
		);
	};

	const renderStepContent = () => {
		switch (step) {
			case 1:
				return (
					<div className="space-y-6">
						<div className="space-y-1.5 text-center">
							<h1 className="text-2xl font-semibold theme-heading">Qual é o seu nicho?</h1>
							<p className="text-sm theme-text-muted">
								Usaremos essa informação para liberar agentes, fluxos e templates já configurados.
							</p>
						</div>
						{renderIndustryCards()}
						<button
							type="button"
							onClick={handleSubmitIndustry}
							disabled={!selectedIndustry || requestLoading}
							className="w-full rounded-lg py-2.5 text-sm font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60"
							style={{
								backgroundColor: "var(--color-primary)",
								color: "var(--color-on-primary)",
								boxShadow: "0 16px 32px -18px color-mix(in srgb, var(--color-primary) 55%, transparent)",
							}}
						>
							{requestLoading ? "Salvando..." : "Continuar"}
						</button>
					</div>
				);
			case 2:
				return (
					<div className="space-y-6">
						<div className="space-y-1.5">
							<h1 className="text-2xl font-semibold theme-heading">Personalize o que vamos ativar primeiro</h1>
							<p className="text-sm theme-text-muted">
								Ajuste os recursos iniciais. Você pode mudar tudo depois nas configurações.
							</p>
						</div>
						{configLoading ? (
							<div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-secondary)/60 px-4 py-16 text-sm font-medium theme-text-muted">
								<FaSpinner className="animate-spin" /> Carregando sugestões para o seu nicho...
							</div>
						) : (
							renderPreferencesContent(industryConfig)
						)}
						<div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
							<button
								type="button"
								onClick={handleBack}
								className="inline-flex items-center justify-center gap-2 rounded-lg border border-(--color-border) px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-all"
							>
								<FaArrowLeft size={14} /> Voltar
							</button>
							<button
								type="button"
								onClick={handleSubmitPreferences}
								className="inline-flex items-center justify-center gap-2 rounded-lg bg-(--color-primary) px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-(--color-on-primary) transition-all disabled:cursor-not-allowed disabled:opacity-60"
								disabled={requestLoading}
							>
								{requestLoading ? "Finalizando..." : "Finalizar onboarding"} <FaCheck size={14} />
							</button>
						</div>
					</div>
				);
			default:
				return null;
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-999 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
			<div className="relative w-full max-w-4xl overflow-hidden rounded-xl bg-(--color-surface) shadow-md">
				<div ref={containerRef} className="max-h-[90vh] overflow-y-auto p-6 md:p-8">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<span className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-primary)">
								Bem-vindo ao Weni
							</span>
							<h2 className="mt-2 text-2xl font-semibold theme-heading">Vamos deixar tudo pronto para você</h2>
						</div>
						<span className="rounded-full bg-(--color-surface-secondary) px-3 py-1 text-xs font-semibold uppercase tracking-wide theme-text-muted">
							Passo {step} de 2
						</span>
					</div>

					<div className="space-y-6">{renderStepContent()}</div>

					{error && (
						<div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
							{error}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface PreferenceCardProps {
	title: string;
	description: string;
	icon: ReactNode;
	active: boolean;
	onToggle: () => void;
	highlight?: string;
}

function PreferenceCard({ title, description, icon, active, onToggle, highlight }: PreferenceCardProps) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="group flex h-full flex-col rounded-xl border-2 p-5 text-left transition-all"
			style={{
				borderColor: active
					? "color-mix(in srgb, var(--color-primary) 55%, transparent)"
					: "color-mix(in srgb, var(--color-border) 80%, transparent)",
				backgroundColor: active
					? "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-secondary))"
					: "color-mix(in srgb, var(--color-surface) 94%, transparent)",
				boxShadow: active
					? "0 18px 32px -24px color-mix(in srgb, var(--color-primary) 45%, transparent)"
					: "none",
			}}
		>
			<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
				{icon}
			</div>
			<div className="mb-3 flex items-center justify-between gap-3">
				<h3 className="text-lg font-semibold theme-heading">{title}</h3>
				<span
					className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold"
					style={{
						backgroundColor: active
							? "var(--color-primary)"
							: "color-mix(in srgb, var(--color-border) 50%, transparent)",
						color: active ? "var(--color-on-primary)" : "var(--color-text-muted)",
						borderColor: active
							? "color-mix(in srgb, var(--color-primary) 70%, transparent)"
							: "color-mix(in srgb, var(--color-border) 70%, transparent)",
					}}
				>
					{active ? <FaCheck size={10} /> : ""}
				</span>
			</div>
			<p className="text-sm theme-text-muted">{description}</p>
			{highlight && (
				<div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">
					<FaBolt size={12} /> {highlight}
				</div>
			)}
		</button>
	);
}

