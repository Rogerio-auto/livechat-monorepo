import React, { useState, useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { getAccessToken } from "../../utils/api";

type KanbanColumn = {
  id: string;
  title: string;
  color?: string;
};

type Props = {
  apiBase: string;
  selectedStages: string[];
  onChange: (stages: string[]) => void;
};

export default function FunnelStageSelector({ apiBase, selectedStages, onChange }: Props) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredColumns, setFilteredColumns] = useState<KanbanColumn[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carregar colunas do kanban
  useEffect(() => {
    (async () => {
      try {
        const token = getAccessToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const boardRes = await fetch(`${apiBase}/kanban/my-board`, {
          headers,
          credentials: "include",
        });
        if (!boardRes.ok) return;
        
        const board = await boardRes.json();
        if (!board?.id) return;

        const colsRes = await fetch(`${apiBase}/kanban/boards/${board.id}/columns`, {
          headers,
          credentials: "include",
        });
        if (!colsRes.ok) return;
        
        const cols = await colsRes.json();
        setColumns(Array.isArray(cols) ? cols : []);
      } catch (e) {
        console.warn("Falha ao carregar colunas do kanban", e);
      }
    })();
  }, [apiBase]);

  // Filtrar colunas conforme o usuário digita
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredColumns(columns.filter(col => !selectedStages.includes(col.id)));
      return;
    }

    const query = inputValue.toLowerCase();
    const filtered = columns.filter(
      (col) =>
        !selectedStages.includes(col.id) &&
        col.title.toLowerCase().includes(query)
    );
    setFilteredColumns(filtered);
  }, [inputValue, columns, selectedStages]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStage = (columnId: string) => {
    if (!selectedStages.includes(columnId)) {
      onChange([...selectedStages, columnId]);
    }
    setInputValue("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveStage = (columnId: string) => {
    onChange(selectedStages.filter((id) => id !== columnId));
  };

  const getColumnById = (id: string) => columns.find((col) => col.id === id);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Etapas de funil
      </label>
      
      {/* Tags selecionadas */}
      {selectedStages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedStages.map((stageId) => {
            const col = getColumnById(stageId);
            if (!col) return null;
            return (
              <div
                key={stageId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: col.color || "#6B7280" }}
                />
                <span>{col.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveStage(stageId)}
                  className="ml-1 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                  aria-label={`Remover ${col.title}`}
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input com autocomplete */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={
            selectedStages.length === 0
              ? "Digite para buscar etapas..."
              : "Adicionar mais etapas..."
          }
          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
        />

        {/* Dropdown de sugestões */}
        {showDropdown && filteredColumns.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-auto"
          >
            {filteredColumns.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => handleSelectStage(col.id)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || "#6B7280" }}
                />
                <span className="text-gray-900 dark:text-white">{col.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mensagem quando não há resultados */}
        {showDropdown && inputValue.trim() && filteredColumns.length === 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Nenhuma etapa encontrada
            </p>
          </div>
        )}
      </div>

      {columns.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nenhuma coluna de funil disponível
        </p>
      )}
    </div>
  );
}
