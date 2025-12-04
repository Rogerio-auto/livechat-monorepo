/**
 * Meta Health Status Widget
 * 
 * Exibe visualmente o status de saúde da conta Meta:
 * - Quality Rating (GREEN/YELLOW/RED)
 * - Messaging Limit Tier (TIER_1K, TIER_10K, etc)
 * - Tier Limit (msgs/dia)
 * - Última atualização
 */

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";

interface MetaHealthData {
  inbox_id: string;
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  messaging_limit_tier: string;
  tier_limit: number;
  cached: boolean;
  updated_at: string;
}

interface MetaHealthStatusProps {
  inboxId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // em segundos
  showRefreshButton?: boolean;
}

export function MetaHealthStatus({
  inboxId,
  autoRefresh = false,
  refreshInterval = 300, // 5 minutos padrão
  showRefreshButton = true,
}: MetaHealthStatusProps) {
  const [health, setHealth] = useState<MetaHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async (forceRefresh = false) => {
    try {
      setRefreshing(forceRefresh);
      const url = forceRefresh
        ? `/api/meta/health/${inboxId}?refresh=true`
        : `/api/meta/health/${inboxId}`;
      
      const response = await api.get(url);
      setHealth(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Erro ao buscar Meta health:", err);
      setError(err.response?.data?.error || "Erro ao carregar status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchHealth();
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [inboxId, autoRefresh, refreshInterval]);

  const handleRefresh = () => {
    fetchHealth(true);
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Erro ao carregar status da Meta</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (!health) return null;

  const getQualityConfig = (rating: string) => {
    switch (rating) {
      case "GREEN":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          label: "Excelente",
          description: "Conta em ótimo estado",
        };
      case "YELLOW":
        return {
          icon: AlertCircle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          label: "Atenção",
          description: "Qualidade reduzida - envie com cuidado",
        };
      case "RED":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          label: "Crítico",
          description: "Conta bloqueada - NÃO enviar mensagens",
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          label: "Desconhecido",
          description: "Status não disponível",
        };
    }
  };

  const getTierLabel = (tier: string) => {
    const tierMap: Record<string, string> = {
      TIER_1K: "1.000 msgs/dia",
      TIER_10K: "10.000 msgs/dia",
      TIER_100K: "100.000 msgs/dia",
      TIER_UNLIMITED: "Ilimitado",
      TIER_250: "250 msgs/dia",
      TIER_50: "50 msgs/dia",
      UNKNOWN: "Não definido",
    };
    return tierMap[tier] || tier;
  };

  const qualityConfig = getQualityConfig(health.quality_rating);
  const QualityIcon = qualityConfig.icon;

  const lastUpdate = new Date(health.updated_at);
  const timeAgo = getTimeAgo(lastUpdate);

  return (
    <div className={`border rounded-lg p-4 ${qualityConfig.bgColor} ${qualityConfig.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <QualityIcon className={`w-5 h-5 ${qualityConfig.color}`} />
          <span className={`font-semibold ${qualityConfig.color}`}>
            Status Meta: {qualityConfig.label}
          </span>
        </div>
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-1 rounded hover:bg-white/50 transition-colors ${
              refreshing ? "animate-spin" : ""
            }`}
            title="Atualizar status da API Meta"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 mb-3">{qualityConfig.description}</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Quality Rating */}
        <div className="bg-white/50 rounded p-2">
          <div className="text-xs text-gray-600 mb-1">Quality Rating</div>
          <div className={`text-lg font-bold ${qualityConfig.color}`}>
            {health.quality_rating}
          </div>
        </div>

        {/* Tier Limit */}
        <div className="bg-white/50 rounded p-2">
          <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Limite Diário
          </div>
          <div className="text-lg font-bold text-gray-800">
            {health.tier_limit.toLocaleString("pt-BR")}
          </div>
        </div>

        {/* Messaging Tier */}
        <div className="bg-white/50 rounded p-2 col-span-2">
          <div className="text-xs text-gray-600 mb-1">Tier Atual</div>
          <div className="text-sm font-semibold text-gray-800">
            {getTierLabel(health.messaging_limit_tier)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-200/50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {health.cached ? "📦 Cache" : "🔄 Atualizado"}
          </span>
          <span title={lastUpdate.toLocaleString("pt-BR")}>
            {timeAgo}
          </span>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${diffDays}d atrás`;
}
