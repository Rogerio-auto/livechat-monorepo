import OpenAIIntegrationCard from "./OpenAIIntegrationCard";

const INTRO_CARD_CLASS = "config-card rounded-2xl shadow-sm p-6 config-text-muted";

export default function IntegracoesPanel() {
  return (
    <div className="space-y-4">
      <section className={INTRO_CARD_CLASS}>
        <h3 className="text-lg font-semibold config-heading mb-2">Integrações OpenAI</h3>
        <p className="text-sm config-text-muted">
          Conecte sua conta da OpenAI para liberar as funcionalidades de IA e habilitar os agentes
          inteligentes em seus canais.
        </p>
      </section>
      <OpenAIIntegrationCard />
    </div>
  );
}
