import OpenAIBillingPanel from "../../componets/billing/OpenAIBillingPanel";

export default function BillingPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Faturamento & Uso</h2>
        <p className="text-gray-500 dark:text-gray-400">Acompanhe o consumo de IA e gerencie suas faturas.</p>
      </div>
      <OpenAIBillingPanel />
    </div>
  );
}
