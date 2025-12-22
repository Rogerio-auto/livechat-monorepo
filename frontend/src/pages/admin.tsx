import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SettingsNav from "../componets/settings/SettingsNav";
import { ToolsAdminPanel } from "../componets/tools/ToolsAdminPanel";
import TemplatesAdminPanel from "../componets/agents/TemplatesAdminPanel";
import { AgentToolsManager } from "../componets/admin/AgentToolsManager";
import { CompaniesManager } from "../componets/admin/CompaniesManager";
import { AgentsAdminPanel } from "../componets/admin/AgentsAdminPanel";
import { API } from "../utils/api";
import { FiShield, FiTool, FiUsers, FiCpu, FiSettings, FiCrosshair } from "react-icons/fi";

type TabId = "tools" | "templates" | "agent-tools" | "agents" | "companies" | "system";

const SECTIONS = [
  { id: "tools", title: "Ferramentas", subtitle: "Catálogo de Tools", icon: FiTool },
  { id: "templates", title: "Templates", subtitle: "Templates de Agentes", icon: FiCpu },
  { id: "agent-tools", title: "Agentes & Tools", subtitle: "Gerenciar ferramentas", icon: FiSettings },
  { id: "agents", title: "Agentes IA", subtitle: "Editar prompts e configs", icon: FiCrosshair },
  { id: "companies", title: "Empresas", subtitle: "Gerenciar empresas", icon: FiUsers },
] as const;

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const search = location.search;
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const tab = (params.get("tab") || "tools") as TabId;

  const goTab = (id: TabId) => {
    const qs = new URLSearchParams(search);
    qs.set("tab", id);
    navigate({ search: `?${qs.toString()}` });
  };

  // Verificar se usuário é ADMIN
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
        const res = await fetch(`${API}/me/profile`, { credentials: "include" });
        if (!res.ok) {
          navigate("/login");
          return;
        }
        const data = await res.json();
        const role = String(data?.role || "").toUpperCase();
        
        if (role !== "ADMIN") {
          // Não é admin, redirecionar para dashboard
          navigate("/dashboard");
          return;
        }

        if (active) {
          setIsAdmin(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to verify admin:", err);
        if (active) {
          navigate("/dashboard");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="ml-16 min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="admin-page ml-16 min-h-screen bg-(--color-bg) text-(--color-text) transition-colors duration-300">
      
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-4rem)] p-6">
        {/* Sidebar de navegação */}
        <div className="col-span-12 md:col-span-2">
          <div className="rounded-xl p-4 border shadow-xl sticky top-6 transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
            <div className="flex items-center gap-2 mb-4 px-2">
              <FiShield className="text-(--color-highlight) text-xl" />
              <h1 className="text-lg font-bold text-(--color-heading)">Admin</h1>
            </div>
            <SettingsNav 
              sections={SECTIONS.map(s => ({ id: s.id, title: s.title, subtitle: s.subtitle }))} 
              current={tab} 
              onChange={(id) => goTab(id as TabId)} 
            />
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="col-span-12 md:col-span-10 overflow-auto">
          <div className="space-y-6">
            {tab === "tools" && (
              <div className="rounded-xl p-8 border shadow-md transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-(--color-heading) flex items-center gap-3">
                    <FiTool className="text-(--color-primary)" />
                    Catálogo de Ferramentas
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-2">
                    Gerencie todas as ferramentas disponíveis no sistema
                  </p>
                </div>
                <ToolsAdminPanel />
              </div>
            )}

            {tab === "templates" && (
              <div className="rounded-xl p-8 border shadow-md transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-(--color-heading) flex items-center gap-3">
                    <FiCpu className="text-(--color-highlight)" />
                    Templates de Agentes
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-2">
                    Crie e edite templates para criação rápida de agentes
                  </p>
                </div>
                <TemplatesAdminPanel />
              </div>
            )}

            {tab === "agent-tools" && (
              <div className="rounded-xl p-8 border shadow-md transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-(--color-heading) flex items-center gap-3">
                    <FiSettings className="text-(--color-highlight)" />
                    Gerenciar Ferramentas dos Agentes
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-2">
                    Configure quais ferramentas cada agente pode usar
                  </p>
                </div>
                <AgentToolsManager />
              </div>
            )}

            {tab === "companies" && (
              <div className="rounded-xl p-8 border shadow-md transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-(--color-heading) flex items-center gap-3">
                    <FiUsers className="text-(--color-highlight)" />
                    Empresas no Sistema
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-2">
                    Visualize e gerencie todas as empresas conectadas
                  </p>
                </div>
                <CompaniesManager />
              </div>
            )}

            {tab === "agents" && (
              <div className="rounded-xl p-8 border shadow-md transition-colors duration-300 bg-(--color-surface) text-(--color-text) border-(--color-border)">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-(--color-heading) flex items-center gap-3">
                    <FiCrosshair className="text-(--color-highlight)" />
                    Agentes de IA
                  </h2>
                  <p className="text-sm text-(--color-text-muted) mt-2">
                    Edite prompts, modelos e configurações dos agentes
                  </p>
                </div>
                <AgentsAdminPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

