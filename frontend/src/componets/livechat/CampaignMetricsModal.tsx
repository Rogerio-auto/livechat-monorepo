import React, { useEffect, useState } from "react";
import { FiX, FiUsers, FiCheck, FiAlertCircle, FiClock, FiSend, FiRefreshCw } from "react-icons/fi";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import type { Campaign } from "../../types/types";
import { getAccessToken } from "../../utils/api";

type CampaignStats = {
  total_recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
};

type Props = {
  apiBase: string;
  campaign: Campaign;
  open: boolean;
  onClose: () => void;
};

export default function CampaignMetricsModal({ apiBase, campaign, open, onClose }: Props) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${apiBase}/livechat/campaigns/${campaign.id}/stats`, {
        headers,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        throw new Error(await res.text());
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open, campaign.id]);

  if (!open) return null;

  const progress = stats
    ? stats.total_recipients > 0
      ? Math.round((stats.sent / stats.total_recipients) * 100)
      : 0
    : 0;

  const deliveryRate = stats && stats.sent > 0
    ? Math.round((stats.delivered / stats.sent) * 100)
    : 0;

  const readRate = stats && stats.delivered > 0
    ? Math.round((stats.read / stats.delivered) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[700px] max-w-[95vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FiUsers className="w-5 h-5" />
                Métricas da Campanha
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{campaign.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
              <FiX className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <FiRefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          )}

          {!loading && stats && (
            <>
              {/* Progress Overview */}
              <Card gradient={false} className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FiSend className="w-4 h-4" />
                  Progresso Geral
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Enviadas / Total</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {stats.sent} / {stats.total_recipients}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400 font-medium">
                    {progress}% concluído
                  </p>
                </div>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card gradient={false} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FiClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Pendentes
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.pending}
                  </div>
                </Card>

                <Card gradient={false} className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FiSend className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Enviadas
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.sent}
                  </div>
                </Card>

                <Card gradient={false} className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Entregues
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.delivered}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {deliveryRate}% das enviadas
                  </p>
                </Card>

                <Card gradient={false} className="p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FiCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Lidas
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.read}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {readRate}% das entregues
                  </p>
                </Card>

                <Card gradient={false} className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FiAlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Falhas
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.failed}
                  </div>
                </Card>

                <Card gradient={false} className="p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FiUsers className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Total
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total_recipients}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadStats}
            disabled={loading}
          >
            <FiRefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
