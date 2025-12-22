/**
 * Opt-in Management Interface
 * 
 * Interface para gerenciar consentimento de marketing (LGPD)
 * - Visualizar status de opt-in dos customers
 * - Registrar opt-in individual ou em massa
 * - Registrar opt-out
 */

import { useState } from "react";
import { Check, X, Upload, UserCheck, UserX, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";

interface OptInStatus {
  marketing_opt_in: boolean;
  opt_in_date: string | null;
  opt_in_method: string | null;
  opt_in_source: string | null;
  opt_out_date: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface OptInManagementProps {
  customer?: Customer;
  showBulkImport?: boolean;
}

export function OptInManagement({ customer, showBulkImport = false }: OptInManagementProps) {
  const [status, setStatus] = useState<OptInStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOptInDialog, setShowOptInDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Opt-in form
  const [method, setMethod] = useState<string>("manual");
  const [source, setSource] = useState<string>("");
  
  // Bulk opt-in form
  const [phones, setPhones] = useState<string>("");
  const [bulkMethod, setBulkMethod] = useState<string>("import");
  const [bulkSource, setBulkSource] = useState<string>("");

  const fetchStatus = async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/api/customers/${customer.id}/opt-in-status`);
      setStatus(response.data);
    } catch (error: any) {
      console.error("Erro ao buscar status:", error);
      setMessage({ type: 'error', text: 'Erro ao carregar status de opt-in' });
    } finally {
      setLoading(false);
    }
  };

  const handleOptIn = async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      await api.post(`/api/customers/${customer.id}/opt-in`, {
        method,
        source: source || undefined,
      });
      
      setMessage({ type: 'success', text: 'Opt-in registrado com sucesso!' });
      setShowOptInDialog(false);
      fetchStatus();
    } catch (error: any) {
      console.error("Erro ao registrar opt-in:", error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao registrar opt-in' });
    } finally {
      setLoading(false);
    }
  };

  const handleOptOut = async () => {
    if (!customer) return;
    
    if (!confirm("Tem certeza que deseja remover o consentimento? O customer será removido de todas as campanhas ativas.")) {
      return;
    }
    
    setLoading(true);
    try {
      await api.post(`/api/customers/${customer.id}/opt-out`);
      
      setMessage({ type: 'success', text: 'Opt-out registrado com sucesso!' });
      fetchStatus();
    } catch (error: any) {
      console.error("Erro ao registrar opt-out:", error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao registrar opt-out' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOptIn = async () => {
    const phoneList = phones
      .split(/[\n,;]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    if (phoneList.length === 0) {
      setMessage({ type: 'error', text: 'Adicione pelo menos um telefone' });
      return;
    }
    
    if (phoneList.length > 1000) {
      setMessage({ type: 'error', text: 'Máximo de 1.000 telefones por vez' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post(`/api/customers/opt-in/bulk`, {
        phones: phoneList,
        method: bulkMethod,
        source: bulkSource || undefined,
      });
      
      const { success, failed } = response.data;
      setMessage({ type: 'success', text: `${success} opt-ins registrados! ${failed > 0 ? `(${failed} falharam)` : ""}` });
      setShowBulkDialog(false);
      setPhones("");
    } catch (error: any) {
      console.error("Erro ao registrar bulk opt-in:", error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao registrar opt-ins' });
    } finally {
      setLoading(false);
    }
  };

  if (customer && !status && !loading) {
    fetchStatus();
  }

  return (
    <div className="space-y-4">
      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-[#2fb463]/10 text-[#2fb463] border-[#2fb463]/20' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          <div className="flex items-center gap-2 font-medium">
            {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Customer Status Card */}
      {customer && status && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-[#151b23]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{customer.name}</h3>
              <p className="text-sm text-slate-500">{customer.phone}</p>
            </div>
            <div>
              {status.marketing_opt_in ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#2fb463]/10 text-[#2fb463] border border-[#2fb463]/20">
                  <Check className="w-3 h-3 mr-1.5" />
                  Opt-in Ativo
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <X className="w-3 h-3 mr-1.5" />
                  Sem Opt-in
                </span>
              )}
            </div>
          </div>

          {status.marketing_opt_in && (
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 text-sm space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Data:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {status.opt_in_date ? new Date(status.opt_in_date).toLocaleDateString("pt-BR") : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Método:</span>
                <span className="font-bold text-slate-900 dark:text-white">{status.opt_in_method || "N/A"}</span>
              </div>
              {status.opt_in_source && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Origem:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{status.opt_in_source}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            {!status.marketing_opt_in ? (
              <Button
                onClick={() => setShowOptInDialog(true)}
                size="md"
                variant="primary"
                className="flex-1"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Registrar Opt-in
              </Button>
            ) : (
              <Button
                onClick={handleOptOut}
                size="md"
                variant="danger"
                className="flex-1"
                disabled={loading}
              >
                <UserX className="w-4 h-4 mr-2" />
                Registrar Opt-out
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Button */}
      {showBulkImport && (
        <Button
          onClick={() => setShowBulkDialog(true)}
          variant="outline"
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Importar Opt-ins em Massa
        </Button>
      )}

      {/* Opt-in Modal */}
      {showOptInDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0b1015] rounded-xl p-8 max-w-md w-full shadow-md border border-slate-200 dark:border-slate-800">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Registrar Opt-in</h2>
            <p className="text-sm text-slate-500 mb-6">
              Registre o consentimento de marketing do customer (LGPD)
            </p>

            <div className="space-y-5">
              <div>
                <label htmlFor="method" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Método *</label>
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2fb463]/50 focus:border-[#2fb463]"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Website</option>
                  <option value="checkout">Checkout</option>
                  <option value="import">Importação</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label htmlFor="source" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Origem (opcional)</label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSource(e.target.value)}
                  placeholder="Ex: formulário_site, campanha_black_friday"
                />
              </div>

              <div className="bg-[#1f6feb]/10 border border-[#1f6feb]/20 rounded-xl p-4 text-sm text-[#1f6feb] dark:text-[#388bfd] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium">O opt-in será registrado imediatamente e permitirá o envio de campanhas de marketing.</p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setShowOptInDialog(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleOptIn} disabled={loading}>
                  {loading ? "Registrando..." : "Registrar Opt-in"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Opt-in Modal */}
      {showBulkDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0b1015] rounded-xl p-8 max-w-2xl w-full shadow-md border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Importar Opt-ins em Massa</h2>
            <p className="text-sm text-slate-500 mb-6">
              Registre opt-ins para múltiplos telefones (máximo 1.000 por vez)
            </p>

            <div className="space-y-5">
              <div>
                <label htmlFor="phones" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Telefones *</label>
                <textarea
                  id="phones"
                  value={phones}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPhones(e.target.value)}
                  placeholder="Cole os telefones aqui, um por linha ou separados por vírgula&#10;Ex:&#10;5511999999999&#10;5511888888888&#10;5511777777777"
                  rows={8}
                  className="font-mono text-sm w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2fb463]/50 focus:border-[#2fb463]"
                />
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  {phones.split(/[\n,;]/).filter(p => p.trim().length > 0).length} telefones identificados
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="bulkMethod" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Método *</label>
                  <select
                    id="bulkMethod"
                    value={bulkMethod}
                    onChange={(e) => setBulkMethod(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2fb463]/50 focus:border-[#2fb463]"
                  >
                    <option value="import">Importação</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="website">Website</option>
                    <option value="checkout">Checkout</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bulkSource" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Origem (opcional)</label>
                  <Input
                    id="bulkSource"
                    value={bulkSource}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkSource(e.target.value)}
                    placeholder="Ex: planilha_clientes"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium">Apenas customers existentes no sistema terão opt-in registrado. Telefones não encontrados serão ignorados.</p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setShowBulkDialog(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleBulkOptIn} disabled={loading}>
                  {loading ? "Processando..." : "Importar Opt-ins"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

