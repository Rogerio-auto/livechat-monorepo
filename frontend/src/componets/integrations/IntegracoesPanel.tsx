import OpenAIIntegrationCard from "./OpenAIIntegrationCard";

export default function IntegracoesPanel() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6">
        <OpenAIIntegrationCard />
      </div>
    </div>
  );
}
