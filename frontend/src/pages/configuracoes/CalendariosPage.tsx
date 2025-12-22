import { Calendar, Plus, Trash2, Edit2, Check } from "lucide-react";
import { useCalendarsSettings } from "../../hooks/useCalendarsSettings";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const Field = ({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </label>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

export default function CalendariosPage() {
  const {
    calendars,
    loading,
    error,
    newCalendar,
    setNewCalendar,
    handleCreateCalendar,
    handleDeleteCalendar,
  } = useCalendarsSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calendários</h2>
        <p className="text-gray-500 dark:text-gray-400">Gerencie seus calendários e organize seus eventos.</p>
      </div>

      <div className="space-y-12">
        {/* Seção de Criação */}
        <section className="overflow-hidden">
          <div className="py-6 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={20} className="text-blue-500" />
              Novo Calendário
            </h3>
          </div>
          <div className="">
            <Field 
              label="Identificação" 
              description="Dê um nome claro para o seu calendário."
            >
              <Input
                placeholder="Ex: Reuniões Comerciais"
                value={newCalendar.name}
                onChange={(e) => setNewCalendar({ ...newCalendar, name: e.target.value })}
              />
            </Field>

            <Field 
              label="Configurações" 
              description="Defina o tipo e a cor de exibição."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tipo</label>
                  <select
                    value={newCalendar.type}
                    onChange={(e) => setNewCalendar({ ...newCalendar, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="COMPANY">Empresa</option>
                    <option value="PERSONAL">Pessoal</option>
                    <option value="TEAM">Equipe</option>
                    <option value="PROJECT">Projeto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cor</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={newCalendar.color}
                      onChange={(e) => setNewCalendar({ ...newCalendar, color: e.target.value })}
                      className="h-9 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer p-1"
                    />
                  </div>
                </div>
              </div>
            </Field>
          </div>
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
            <Button variant="primary" onClick={handleCreateCalendar} className="flex items-center gap-2">
              <Plus size={18} />
              Criar Calendário
            </Button>
          </div>
        </section>

        {/* Lista de Calendários */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Calendários Ativos</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium">
              {calendars.length} total
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {calendars.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                <Calendar size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum calendário configurado.</p>
              </div>
            ) : (
              calendars.map((cal) => (
                <div
                  key={cal.id}
                  className="group flex items-center justify-between p-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-blue-500/50 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: `${cal.color}20`, color: cal.color }}
                    >
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">{cal.name}</h4>
                        {cal.is_default && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                            <Check size={10} />
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold mt-0.5">
                        {cal.type || "COMPANY"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => alert("Função de editar calendário ainda não implementada")}>
                      <Edit2 size={16} />
                    </Button>
                    {!cal.is_default && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteCalendar(cal.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
