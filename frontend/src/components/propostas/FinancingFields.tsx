/**
 * Componente de Campos de Financiamento Bancário
 * Permite preencher dados detalhados do financiamento quando aplicável
 */

import React from "react";

export interface FinancingData {
  bank?: string;
  installments?: number;
  installment_value?: number;
  interest_rate?: number;
  total_amount?: number;
  entry_value?: number;
  cet?: number;
  iof?: number;
  type?: string;
  first_due_date?: string;
}

interface FinancingFieldsProps {
  value: FinancingData;
  onChange: (value: FinancingData) => void;
  disabled?: boolean;
}

export function FinancingFields({ value, onChange, disabled }: FinancingFieldsProps) {
  const updateField = (field: keyof FinancingData, fieldValue: any) => {
    onChange({ ...value, [field]: fieldValue });
  };

  // Auto-calcular total quando campos mudarem
  React.useEffect(() => {
    const installments = value.installments || 0;
    const installmentValue = value.installment_value || 0;
    if (installments > 0 && installmentValue > 0) {
      const calculated = installments * installmentValue;
      if (calculated !== value.total_amount) {
        onChange({ ...value, total_amount: calculated });
      }
    }
  }, [value.installments, value.installment_value]);

  return (
    <div className="space-y-4 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 className="font-semibold text-amber-900 dark:text-amber-100">
          Dados do Financiamento Bancário
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banco */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Banco Financiador <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: Banco do Brasil, Santander, Caixa..."
            value={value.bank || ""}
            onChange={(e) => updateField("bank", e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Tipo de Financiamento */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Tipo de Financiamento
          </label>
          <select
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            value={value.type || ""}
            onChange={(e) => updateField("type", e.target.value)}
            disabled={disabled}
          >
            <option value="">Selecione...</option>
            <option value="CDC">CDC - Crédito Direto ao Consumidor</option>
            <option value="CONSIGNADO">Consignado</option>
            <option value="PESSOAL">Empréstimo Pessoal</option>
            <option value="IMOBILIARIO">Financiamento Imobiliário</option>
            <option value="FGTS">FGTS</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        {/* Número de Parcelas */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Número de Parcelas <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="360"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 60"
            value={value.installments || ""}
            onChange={(e) => updateField("installments", parseInt(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>

        {/* Valor da Parcela */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Valor da Parcela (R$) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 850.50"
            value={value.installment_value || ""}
            onChange={(e) => updateField("installment_value", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>

        {/* Taxa de Juros */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Taxa de Juros (% a.m.) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 1.20"
            value={value.interest_rate || ""}
            onChange={(e) => updateField("interest_rate", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>

        {/* Valor da Entrada */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Valor da Entrada (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 5000.00"
            value={value.entry_value || ""}
            onChange={(e) => updateField("entry_value", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>

        {/* Valor Total Financiado */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Valor Total Financiado (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            value={value.total_amount || ""}
            readOnly
            disabled
            title="Calculado automaticamente: parcelas × valor da parcela"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Calculado automaticamente
          </p>
        </div>

        {/* Data Primeira Parcela */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Data da Primeira Parcela
          </label>
          <input
            type="date"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            value={value.first_due_date || ""}
            onChange={(e) => updateField("first_due_date", e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* CET - Custo Efetivo Total */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            CET - Custo Efetivo Total (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 15.80"
            value={value.cet || ""}
            onChange={(e) => updateField("cet", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>

        {/* IOF */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            IOF (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Ex: 320.50"
            value={value.iof || ""}
            onChange={(e) => updateField("iof", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Resumo */}
      {value.installments && value.installment_value ? (
        <div className="mt-4 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Resumo: {value.installments}× de R$ {value.installment_value.toFixed(2)} = 
            <span className="font-bold"> R$ {value.total_amount?.toFixed(2) || "0.00"}</span>
          </p>
          {value.interest_rate && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Taxa: {value.interest_rate}% a.m. | Banco: {value.bank || "Não informado"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
