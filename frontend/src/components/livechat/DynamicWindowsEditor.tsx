import React from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

type Props = {
  weekdaysState: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
};

const WEEKDAYS: { k: string; label: string }[] = [
  { k: "1", label: "Segunda" },
  { k: "2", label: "Terça" },
  { k: "3", label: "Quarta" },
  { k: "4", label: "Quinta" },
  { k: "5", label: "Sexta" },
  { k: "6", label: "Sábado" },
  { k: "0", label: "Domingo" },
];

export default function DynamicWindowsEditor({ weekdaysState, onChange }: Props) {
  const [selectedDays, setSelectedDays] = React.useState<string[]>(
    Object.keys(weekdaysState).filter((k) => (weekdaysState[k] || "").trim().length > 0)
  );

  function toggleDay(k: string) {
    setSelectedDays((prev) =>
      prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]
    );
  }

  function updateDay(k: string, value: string) {
    onChange({ ...weekdaysState, [k]: value });
  }

  return (
    <div className="space-y-3">
      {/* Selecionar dias */}
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map(({ k, label }) => {
          const active = selectedDays.includes(k);
          return (
            <button
              type="button"
              key={k}
              onClick={() => toggleDay(k)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all border ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Inputs apenas para dias selecionados */}
      <div className="space-y-2">
        {WEEKDAYS.filter(({ k }) => selectedDays.includes(k)).map(({ k, label }) => (
          <div key={k} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label} — Faixas (HH:MM-HH:MM, separadas por vírgula)
            </label>
            <Input
              value={weekdaysState[k] || ""}
              onChange={(e) => updateDay(k, e.target.value)}
              placeholder="Ex: 09:00-12:00, 14:00-18:00"
            />
          </div>
        ))}
        {selectedDays.length === 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Selecione um ou mais dias para adicionar faixas.
          </p>
        )}
      </div>
    </div>
  );
}
