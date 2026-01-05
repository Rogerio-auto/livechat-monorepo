import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiPlay, FiPause, FiTrash2, FiEdit2, FiActivity } from "react-icons/fi";

import { getAccessToken } from "../../utils/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import FlowBuilder from "./FlowBuilder";

type Flow = {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  updated_at: string;
};

type Props = {
  apiBase: string;
  initialFlowId?: string;
};

export default function FlowsPanel({ apiBase, initialFlowId }: Props) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFlowId, setEditingFlowId] = useState<string | undefined>(initialFlowId);
  const [showBuilder, setShowBuilder] = useState(!!initialFlowId);

  const navigate = useNavigate();


  const fetchWithAuth = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers, credentials: "include" });
  };

  const loadFlows = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/api/livechat/flows`);
      if (res.ok) {
        const data = await res.json();
        setFlows(data);
      }
    } catch (error) {
      console.error("Failed to load flows", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const handleCreate = () => {
    setEditingFlowId(undefined);
    setShowBuilder(true);
    navigate("/livechat/flows/new");
  };

  const handleEdit = (flow: Flow) => {
    setEditingFlowId(flow.id);
    setShowBuilder(true);
    navigate(`/livechat/flows/${flow.id}`);
  };


  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este fluxo?")) return;
    try {
      const res = await fetchWithAuth(`${apiBase}/api/livechat/flows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFlows(flows.filter(f => f.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete flow", error);
    }
  };

  const handleToggleStatus = async (flow: Flow) => {
    const newStatus = flow.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetchWithAuth(`${apiBase}/api/livechat/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        loadFlows();
      }
    } catch (error) {
      console.error("Failed to update flow status", error);
    }
  };

  if (showBuilder) {
    return (
      <div className="relative h-full w-full">
        <FlowBuilder 
          apiBase={apiBase} 
          flowId={editingFlowId === 'new' ? undefined : editingFlowId} 
          onClose={() => {
            setShowBuilder(false);
            navigate("/livechat/flows");
            loadFlows();
          }} 
        />
      </div>
    );
  }



  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-(--color-heading)">Fluxos de Automação</h2>
          <p className="text-(--color-text-muted)">Crie jornadas automatizadas para seus contatos.</p>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <FiPlus /> Novo Fluxo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-primary)"></div>
        </div>
      ) : flows.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-(--color-primary-muted) rounded-full flex items-center justify-center">
            <FiActivity className="text-2xl text-(--color-primary)" />
          </div>
          <h3 className="text-lg font-medium">Nenhum fluxo criado</h3>
          <p className="text-(--color-text-muted) max-w-md mx-auto">
            Comece criando seu primeiro fluxo para automatizar o atendimento e vendas.
          </p>
          <Button variant="outline" onClick={handleCreate}>Criar meu primeiro fluxo</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(flow => (
            <Card key={flow.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg">{flow.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    flow.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                    flow.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {flow.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleToggleStatus(flow)} className="p-2 hover:bg-gray-100 rounded-lg" title={flow.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}>
                    {flow.status === 'ACTIVE' ? <FiPause /> : <FiPlay />}
                  </button>
                  <button onClick={() => handleEdit(flow)} className="p-2 hover:bg-gray-100 rounded-lg" title="Editar">
                    <FiEdit2 />
                  </button>
                  <button onClick={() => handleDelete(flow.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" title="Excluir">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              <p className="text-sm text-(--color-text-muted) line-clamp-2 mb-4">
                {flow.description || "Sem descrição"}
              </p>
              <div className="text-xs text-(--color-text-muted)">
                Atualizado em: {new Date(flow.updated_at).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
