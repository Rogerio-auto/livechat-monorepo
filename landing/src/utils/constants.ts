export type Stat = {
  label: string;
  value: string;
  detail: string;
};

export type Feature = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  badge?: string;
};

export type Plan = {
  id: "starter" | "growth" | "professional" | "business";
  name: string;
  price: number;
  description: string;
  cta: string;
  badge?: string;
  quota: string;
  features: string[];
  notIncluded?: string[];
};

export type FAQ = {
  question: string;
  answer: string;
};

export const NAV_LINKS = [
  { label: "Início", path: "/" },
  { label: "Recursos", path: "/#features" },
  { label: "Nichos", path: "/#niches" },
  { label: "Preços", path: "/precos" },
  { label: "Contato", path: "/contato" },
];

export const HERO_STATS: Stat[] = [
  { label: "Mensagens enviadas/mês", value: "+12M", detail: "Entregues com API oficial" },
  { label: "Tempo economizado", value: "38h", detail: "por time comercial" },
  { label: "Taxa de resposta", value: "78%", detail: "em campanhas segmentadas" },
];

export const FEATURES: Feature[] = [
  {
    id: "livechat",
    title: "Livechat Omnichannel",
    description: "Centralize WhatsApp, Instagram e Webchat em uma caixa única com handoff em 1 clique.",
    bullets: [
      "Routing inteligente por tags ou fila",
      "Macros e respostas sugeridas pela IA",
      "Alertas em tempo real via desktop e mobile",
    ],
    badge: "Ao vivo",
  },
  {
    id: "ai",
    title: "Agentes de IA com contexto",
    description: "Bots que entendem documentos, catálogos e históricos para responder com precisão em segundos.",
    bullets: [
      "Projects API da OpenAI pré-configurada",
      "Fallback automático para atendentes",
      "Suporte a ferramentas (CRM, estoque, boletos)",
    ],
    badge: "GPT-4o mini",
  },
  {
    id: "flow",
    title: "FlowBuilder visual",
    description: "Desenhe fluxos com drag-and-drop, condições e integrações sem código.",
    bullets: [
      "Gatilhos por horário, tags ou eventos",
      "Nós de IA, formulários e automações",
      "Execução em fila com monitoramento",
    ],
  },
  {
    id: "campaigns",
    title: "Campanhas transacionais",
    description: "Dispare milhões de mensagens aprovadas pela Meta com segmentação avançada.",
    bullets: [
      "Rate limiting automático",
      "Templates aprovados com um clique",
      "Métricas de entrega e respostas",
    ],
  },
  {
    id: "crm",
    title: "CRM conectado",
    description: "Pipeline de vendas, tarefas e calendário integrado ao WhatsApp.",
    bullets: [
      "Funil configurável por nicho",
      "Playbooks e lembretes automáticos",
      "Integração com Google Calendar",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Dashboards em tempo real mostram performance por agente, campanha e nicho.",
    bullets: [
      "KPIs personalizáveis",
      "Exportação em CSV/Sheets",
      "Alertas quando metas caem",
    ],
  },
];

export const NICHES = [
  { id: "solar", label: "Energia Solar", metric: "+150% em propostas" },
  { id: "education", label: "Educação", metric: "CPQ 32% menor" },
  { id: "health", label: "Saúde", metric: "Agendamentos +67%" },
  { id: "realestate", label: "Imobiliário", metric: "Follow-up automático" },
  { id: "events", label: "Eventos", metric: "Lotes esgotados 2x" },
  { id: "law", label: "Jurídico", metric: "Onboarding em 24h" },
  { id: "retail", label: "Varejo", metric: "Ticket médio +28%" },
];

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    description: "Para times iniciando automações e livechat.",
    cta: "Começar com Starter",
    quota: "3 usuários • 5.000 msgs",
    features: [
      "Livechat + CRM base",
      "3 campanhas simultâneas",
      "Catálogo + biblioteca de mídia",
      "Suporte por email",
    ],
    notIncluded: ["Agentes de IA", "API/Webhooks"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 197,
    description: "Mais automação, IA e volume para escalar o time.",
    cta: "Plano Growth",
    badge: "Mais popular",
    quota: "10 usuários • 15.000 msgs",
    features: [
      "Agentes de IA inclusos",
      "FlowBuilder completo",
      "10 campanhas simultâneas",
      "Suporte prioritário",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 247,
    description: "Para squads que precisam de integrações e analytics.",
    cta: "Plano Professional",
    quota: "25 usuários • 50.000 msgs",
    features: [
      "Campanhas ilimitadas",
      "API + Webhooks",
      "Projetos OpenAI",
      "Dashboards avançados",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 497,
    description: "Tudo liberado, com suporte dedicado e white-label.",
    cta: "Conversar sobre Business",
    badge: "Sob medida",
    quota: "Usuários e mensagens ilimitados",
    features: [
      "White-label + domínios custom",
      "Onboarding com especialista",
      "SLA 99.9%",
      "Gerente dedicado",
    ],
  },
];

export const FAQS: FAQ[] = [
  {
    question: "Preciso ter WhatsApp Business API?",
    answer: "Sim, todas as integrações usam API oficial com verificação Meta. Te ajudamos na ativação.",
  },
  {
    question: "O teste grátis exige cartão?",
    answer: "Não. Você ativa 30 dias sem cartão e só escolhe forma de pagamento ao final do período.",
  },
  {
    question: "Posso importar meus contatos?",
    answer: "Sim, basta subir CSV ou conectar via API. Validamos duplicados automaticamente.",
  },
  {
    question: "A IA substitui meu time?",
    answer: "Ela cuida do volume repetitivo e entrega handoff contextual para humanos finalizarem.",
  },
  {
    question: "Como funciona o suporte?",
    answer: "Email para todos os planos, chat prioritário a partir do Growth e gerente dedicado no Business.",
  },
];

export const TESTIMONIALS = [
  {
    company: "SolPrime",
    quote: "Reduzimos 42% do tempo de resposta e dobramos as instalações com fluxos automáticos.",
    author: "Larissa Menezes",
    role: "Head de Operações",
  },
  {
    company: "ClinLife",
    quote: "A IA da 7Sion agenda consultas e envia lembretes personalizados, foi game-changer.",
    author: "Dr. Vinicius Prado",
    role: "Diretor Clínico",
  },
  {
    company: "VivaEdu",
    quote: "Campanhas segmentadas triplicaram nossos leads qualificados no período de matrículas.",
    author: "Renata Diniz",
    role: "CMO",
  },
];

export const CONTACT_CHANNELS = [
  {
    label: "WhatsApp Prioritário",
    value: "+55 (69) 9967-0030",
    href: "https://wa.me/556999670030?text=Quero%20conhecer%20a%207Sion",
  },
  {
    label: "Email Comercial",
    value: "suporte@7sion.com",
    href: "mailto:suporte@7sion.com",
  },
  {
    label: "Endereço",
    value: "Rua Osvaldo de Andrade, 4075 - Ariquemes/RO",
  },
];
