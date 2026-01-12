import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  value: number;
  onChange: (days: number) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const options = [
    { label: 'Hoje', value: 1 },
    { label: 'Ontem', value: 2 },
    { label: 'Últimos 7 dias', value: 7 },
    { label: 'Últimos 30 dias', value: 30 },
    { label: 'Este mês', value: 0 }, // 0 can represent current month
  ];

  const currentLabel = options.find(opt => opt.value === value)?.label || 'Personalizado';

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block text-left group">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{currentLabel}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
        
        <div className="absolute right-0 mt-1 w-48 origin-top-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`w-full text-left px-4 py-2 text-sm ${
                  value === option.value 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
