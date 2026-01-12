// SimplifiedAgentPanel.tsx
// Painel principal simplificado para gerenciamento de agentes

import { useNavigate } from "react-router-dom";
import { SimplifiedAgentList } from "./SimplifiedAgentList";

export function SimplifiedAgentPanel() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <SimplifiedAgentList 
        onNewAgent={() => navigate("/configuracoes/ia/novo")} 
        onEditAgent={(id) => navigate(`/configuracoes/ia/${id}`)} 
      />
    </div>
  );
}
