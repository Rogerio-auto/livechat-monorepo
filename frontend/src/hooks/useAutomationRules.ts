import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import type {
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationLog,
} from "../types/automationRules";

export function useAutomationRules(activeOnly = false) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (activeOnly) params.set("active_only", "true");
      
      const response = await api.get<{ rules: AutomationRule[] }>(`/api/automation-rules?${params}`);
      setRules(response.rules || []);
    } catch (err: any) {
      console.error("Error fetching automation rules:", err);
      setError(err.message || "Erro ao carregar regras");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (input: CreateAutomationRuleInput): Promise<AutomationRule> => {
    try {
      const response = await api.post<AutomationRule>("/api/automation-rules", input);
      await fetchRules(); // Recarregar lista
      return response;
    } catch (err: any) {
      console.error("Error creating rule:", err);
      throw new Error(err.message || "Erro ao criar regra");
    }
  };

  const updateRule = async (
    id: string,
    input: UpdateAutomationRuleInput
  ): Promise<AutomationRule> => {
    try {
      const response = await api.put<AutomationRule>(`/api/automation-rules/${id}`, input);
      await fetchRules(); // Recarregar lista
      return response;
    } catch (err: any) {
      console.error("Error updating rule:", err);
      throw new Error(err.message || "Erro ao atualizar regra");
    }
  };

  const deleteRule = async (id: string): Promise<void> => {
    try {
      await api.delete<void>(`/api/automation-rules/${id}`);
      await fetchRules(); // Recarregar lista
    } catch (err: any) {
      console.error("Error deleting rule:", err);
      throw new Error(err.message || "Erro ao deletar regra");
    }
  };

  const toggleRule = async (id: string, is_active: boolean): Promise<void> => {
    try {
      await api.put<AutomationRule>(`/api/automation-rules/${id}`, { is_active });
      await fetchRules(); // Recarregar lista
    } catch (err: any) {
      console.error("Error toggling rule:", err);
      throw new Error(err.message || "Erro ao ativar/desativar regra");
    }
  };

  const getRuleLogs = async (id: string, limit = 50): Promise<AutomationLog[]> => {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      const response = await api.get<{ logs: AutomationLog[] }>(`/api/automation-rules/${id}/logs?${params}`);
      return response.logs || [];
    } catch (err: any) {
      console.error("Error fetching rule logs:", err);
      throw new Error(err.message || "Erro ao carregar logs");
    }
  };

  return {
    rules,
    loading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    getRuleLogs,
  };
}
