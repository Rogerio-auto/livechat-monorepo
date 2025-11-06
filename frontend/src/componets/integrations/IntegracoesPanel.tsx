import OpenAIIntegrationCard from "./OpenAIIntegrationCard";
import { InfoCard } from "../../components/ui";

export default function IntegracoesPanel() {
  return (
    <div className="space-y-4">
      <InfoCard
        title="Integrações OpenAI"
        description="Conecte sua conta da OpenAI para liberar as funcionalidades de IA e habilitar os agentes inteligentes em seus canais."
        color="indigo"
        icon={
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9V3l-2 2m2-2l2 2" />
            <path d="M5 15a7 7 0 0114 0v3a2 2 0 01-2 2h-2a3 3 0 11-6 0H7a2 2 0 01-2-2v-3z" />
          </svg>
        }
      />
      <OpenAIIntegrationCard />
    </div>
  );
}
