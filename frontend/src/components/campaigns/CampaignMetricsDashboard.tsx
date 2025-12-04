/**
 * Campaign Metrics Dashboard
 * 
 * Widget para exibir métricas de campanha em tempo real:
 * - Delivery Rate (taxa de entrega)
 * - Block Rate (taxa de bloqueio)
 * - Read Rate (taxa de leitura)
 * - Health Status (status de saúde)
 */

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Eye, Ban, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Progress } from "../ui/progress";

interface CampaignMetrics {
  id: string;
  campaign_id: string;
  measured_at: string;
  
  // Raw counts
  total_recipients: number;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  messages_replied: number;
  messages_failed: number;
  messages_blocked: number;
  
  // Rates (percentages)
  delivery_rate: number;
  read_rate: number;
  response_rate: number;
  block_rate: number;
  failure_rate: number;
  
  // Health
  health_status: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";
}

interface CampaignMetricsDashboardProps {
  campaignId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // em segundos
  compact?: boolean;
}

export function CampaignMetricsDashboard({
  campaignId,
  autoRefresh = true,
  refreshInterval = 60,
  compact = false,
}: CampaignMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
      const response = await fetch(`${API}/livechat/campaigns/${campaignId}/metrics`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      console.error("Erro ao buscar métricas:", err);
      setError("Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [campaignId, autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-sm text-red-700">{error || "Métricas não disponíveis"}</p>
      </div>
    );
  }

  const getHealthConfig = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          label: "Saudável",
        };
      case "WARNING":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          label: "Atenção",
        };
      case "CRITICAL":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          label: "Crítico",
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          label: "Desconhecido",
        };
    }
  };

  const healthConfig = getHealthConfig(metrics.health_status);
  const HealthIcon = healthConfig.icon;

  if (compact) {
    return (
      <div className={`border rounded-lg p-3 ${healthConfig.bgColor} ${healthConfig.borderColor}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Métricas da Campanha</span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${healthConfig.color}`}>
            <HealthIcon className="w-3 h-3 mr-1" />
            {healthConfig.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-gray-600">Entrega</div>
            <div className={`font-bold ${metrics.delivery_rate >= 90 ? "text-green-600" : metrics.delivery_rate >= 80 ? "text-yellow-600" : "text-red-600"}`}>
              {metrics.delivery_rate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">Leitura</div>
            <div className="font-bold text-blue-600">
              {metrics.read_rate.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">Bloqueio</div>
            <div className={`font-bold ${metrics.block_rate < 2 ? "text-green-600" : metrics.block_rate < 5 ? "text-yellow-600" : "text-red-600"}`}>
              {metrics.block_rate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${healthConfig.bgColor} ${healthConfig.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Métricas da Campanha</h3>
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${healthConfig.color}`}>
          <HealthIcon className="w-4 h-4 mr-1" />
          {healthConfig.label}
        </span>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{metrics.messages_sent}</div>
          <div className="text-xs text-gray-600">Enviadas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.messages_delivered}</div>
          <div className="text-xs text-gray-600">Entregues</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{metrics.messages_read}</div>
          <div className="text-xs text-gray-600">Lidas</div>
        </div>
      </div>

      {/* Delivery Rate */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Taxa de Entrega
            </span>
            <span className={`text-sm font-bold ${
              metrics.delivery_rate >= 90 ? "text-green-600" :
              metrics.delivery_rate >= 80 ? "text-yellow-600" :
              "text-red-600"
            }`}>
              {metrics.delivery_rate.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={metrics.delivery_rate} 
            className={metrics.delivery_rate >= 90 ? "bg-green-100" : metrics.delivery_rate >= 80 ? "bg-yellow-100" : "bg-red-100"}
          />
          <p className="text-xs text-gray-600 mt-1">
            {metrics.messages_delivered} de {metrics.messages_sent} entregues
          </p>
        </div>

        {/* Read Rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Eye className="w-4 h-4" />
              Taxa de Leitura
            </span>
            <span className="text-sm font-bold text-blue-600">
              {metrics.read_rate.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={metrics.read_rate} 
            className="bg-blue-100"
          />
          <p className="text-xs text-gray-600 mt-1">
            {metrics.messages_read} de {metrics.messages_delivered} lidas
          </p>
        </div>

        {/* Block Rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Ban className="w-4 h-4" />
              Taxa de Bloqueio
            </span>
            <span className={`text-sm font-bold ${
              metrics.block_rate < 2 ? "text-green-600" :
              metrics.block_rate < 5 ? "text-yellow-600" :
              "text-red-600"
            }`}>
              {metrics.block_rate.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={Math.min(metrics.block_rate, 100)} 
            className={metrics.block_rate < 2 ? "bg-green-100" : metrics.block_rate < 5 ? "bg-yellow-100" : "bg-red-100"}
          />
          <p className="text-xs text-gray-600 mt-1">
            {metrics.messages_blocked} bloqueios
            {metrics.block_rate >= 5 && (
              <span className="text-red-600 font-semibold ml-1">⚠️ CRÍTICO</span>
            )}
            {metrics.block_rate >= 2 && metrics.block_rate < 5 && (
              <span className="text-yellow-600 font-semibold ml-1">⚠️ ATENÇÃO</span>
            )}
          </p>
        </div>

        {/* Response Rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              Taxa de Resposta
            </span>
            <span className="text-sm font-bold text-purple-600">
              {metrics.response_rate.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={metrics.response_rate} 
            className="bg-purple-100"
          />
          <p className="text-xs text-gray-600 mt-1">
            {metrics.messages_replied} respostas
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200/50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Última atualização:</span>
          <span>{new Date(metrics.measured_at).toLocaleString("pt-BR")}</span>
        </div>
      </div>
    </div>
  );
}
