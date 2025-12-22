import { TeamsManager } from "../../componets/admin/TeamsManager";

export default function TimesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Times</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gerencie equipes, escalas e horários de atendimento para otimizar a distribuição de chats.
        </p>
      </div>
      
      <TeamsManager />
    </div>
  );
}
