import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaPlus, FaTimes, FaPalette } from "react-icons/fa";

interface Column {
  name: string;
  color: string;
  position: number;
}

interface KanbanSetupModalProps {
  onComplete: (boardName: string, columns: Column[]) => void;
  isLoading?: boolean;
}

const DEFAULT_COLUMNS: Column[] = [
  { name: "Novo Lead", color: "#3B82F6", position: 1 },
  { name: "Contato Inicial", color: "#8B5CF6", position: 2 },
  { name: "Proposta Enviada", color: "#F59E0B", position: 3 },
  { name: "Negociação", color: "#10B981", position: 4 },
  { name: "Fechado", color: "#22C55E", position: 5 }
];

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#10B981", // emerald
  "#22C55E", // green
  "#EF4444", // red
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#6B7280"  // gray
];

export function KanbanSetupModal({ onComplete, isLoading = false }: KanbanSetupModalProps) {
  useEffect(() => {
    console.log("[KanbanSetupModal] Componente montado!");
    return () => console.log("[KanbanSetupModal] Componente desmontado!");
  }, []);

  const [boardName, setBoardName] = useState("Pipeline de Vendas");
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);

  const addColumn = () => {
    const newPosition = columns.length + 1;
    setColumns([
      ...columns,
      { name: `Coluna ${newPosition}`, color: "#6B7280", position: newPosition }
    ]);
  };

  const removeColumn = (position: number) => {
    if (columns.length <= 1) {
      alert("Você precisa ter pelo menos uma coluna!");
      return;
    }
    const filtered = columns.filter(c => c.position !== position);
    // Reordenar positions
    setColumns(filtered.map((col, idx) => ({ ...col, position: idx + 1 })));
  };

  const updateColumn = (position: number, field: "name" | "color", value: string) => {
    setColumns(columns.map(col => 
      col.position === position ? { ...col, [field]: value } : col
    ));
  };

  const handleSubmit = () => {
    // Validação
    if (!boardName.trim()) {
      alert("Digite um nome para o board!");
      return;
    }

    const emptyNames = columns.filter(c => !c.name.trim());
    if (emptyNames.length > 0) {
      alert("Todas as colunas precisam ter um nome!");
      return;
    }

    onComplete(boardName, columns);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            🎯 Configurar Funil de Vendas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Configure seu pipeline e defina as etapas do seu processo comercial
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          {/* Nome do Board */}
          <div className="mb-8">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Nome do Pipeline
            </label>
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="w-full px-5 py-3 border border-slate-200 dark:border-slate-700 rounded-xl 
                       bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium
                       focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
              placeholder="Ex: Pipeline de Vendas, Funil Comercial..."
              disabled={isLoading}
            />
          </div>

          {/* Colunas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                Etapas do Pipeline ({columns.length})
              </label>
              <button
                onClick={addColumn}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl
                         hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all shadow-md shadow-emerald-200 dark:shadow-none"
              >
                <FaPlus className="w-3 h-3" />
                Adicionar Etapa
              </button>
            </div>

            <div className="space-y-3">
              {columns.map((col, idx) => (
                <div
                  key={col.position}
                  className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:border-emerald-500/30"
                >
                  {/* Posição */}
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-slate-100 shadow-sm">
                    {idx + 1}
                  </div>

                  {/* Nome */}
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(col.position, "name", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome da etapa..."
                    disabled={isLoading}
                  />

                  {/* Color Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === col.position ? null : col.position)}
                      disabled={isLoading}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 
                               hover:border-gray-400 dark:hover:border-gray-500 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      style={{ backgroundColor: col.color }}
                      title="Escolher cor"
                    >
                      <FaPalette className="w-4 h-4 text-white drop-shadow" />
                    </button>

                    {showColorPicker === col.position && (
                      <div className="absolute right-0 top-12 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3">
                        <div className="grid grid-cols-5 gap-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => {
                                updateColumn(col.position, "color", color);
                                setShowColorPicker(null);
                              }}
                              className="w-8 h-8 rounded-xl border-2 hover:border-emerald-500 transition-all"
                              style={{
                                backgroundColor: color,
                                borderColor: col.color === color ? "var(--color-emerald-500)" : "transparent"
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remover */}
                  <button
                    onClick={() => removeColumn(col.position)}
                    disabled={isLoading || columns.length <= 1}
                    className="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 
                             rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remover coluna"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Dica: Organize as etapas na ordem do seu processo de vendas. Você pode adicionar, remover e renomear as colunas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold
                     hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Criando...
              </>
            ) : (
              "Finalizar Configuração"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar usando Portal para garantir que aparece no topo
  return createPortal(modalContent, document.body);
}
