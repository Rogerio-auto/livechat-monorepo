import { useState } from "react";
import InboxesPanel from "../../components/inboxes/InboxesPanel";
import { useInboxesSettings, EMPTY_INBOX_FORM, EMPTY_WAHA_FORM } from "../../hooks/useInboxesSettings";
import { API, fetchJson, getAccessToken } from "../../utils/api";
import type { InboxFormExtended, Inbox } from "@livechat/shared";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";

const generateVerifyToken = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export default function InboxesPage() {
  const {
    companyInboxes,
    setCompanyInboxes,
    inboxForms,
    setInboxForms,
    inboxBaseline,
    setInboxBaseline,
    loading,
    error,
    handleSaveInbox,
    metaWebhookUrl,
    refetch
  } = useInboxesSettings();

  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInboxForm, setCreateInboxForm] = useState<InboxFormExtended>({ ...EMPTY_INBOX_FORM });
  const [createSaving, setCreateSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Inbox | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const isMeta = createInboxForm.provider === "META_CLOUD";
  const isWaha = createInboxForm.provider === "WAHA";

  const openCreateModalForProvider = (provider: "META_CLOUD" | "WAHA") => {
    if (provider === "META_CLOUD") {
      setCreateInboxForm({
        ...EMPTY_INBOX_FORM,
        provider_config: {
          meta: {
            ...EMPTY_INBOX_FORM.provider_config?.meta,
            webhook_verify_token: generateVerifyToken(),
          },
        },
      });
    } else {
      setCreateInboxForm({ ...EMPTY_WAHA_FORM });
    }
    setProviderPickerOpen(false);
    setCreateModalOpen(true);
  };

  const submitCreateInbox = async () => {
    setCreateSaving(true);
    try {
      const payload = {
        ...createInboxForm,
        webhook_url: isMeta ? metaWebhookUrl : createInboxForm.webhook_url,
      };
      
      console.log("[submitCreateInbox] Enviando payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${API}/settings/inboxes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken() || ""}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[submitCreateInbox] Erro na resposta:", data);
        const errorMsg = data.error || "Erro desconhecido";
        const details = data.details ? JSON.stringify(data.details, null, 2) : "";
        alert(`Erro ao criar caixa: ${errorMsg}\n${details}`);
        return;
      }

      await refetch();
      setCreateModalOpen(false);
    } catch (err) {
      console.error("Erro ao criar caixa:", err);
      alert("Erro ao criar caixa de entrada. Verifique o console para mais detalhes.");
    } finally {
      setCreateSaving(false);
    }
  };

  const confirmDeleteInbox = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await fetchJson(`${API}/settings/inboxes/${deleteTarget.id}`, {
        method: "DELETE",
      });
      await refetch();
      setDeleteTarget(null);
    } catch (err) {
      console.error("Erro ao excluir caixa:", err);
      alert("Erro ao excluir caixa de entrada");
    } finally {
      setDeleteSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Canais de Atendimento</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Conecte e gerencie suas contas de WhatsApp e outros canais.</p>
        </div>
        <Button
          onClick={() => setProviderPickerOpen(true)}
          variant="primary"
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Caixa
        </Button>
      </div>

      <InboxesPanel
        companyInboxes={companyInboxes}
        setCompanyInboxes={setCompanyInboxes}
        forms={inboxForms}
        setForms={setInboxForms}
        baseline={inboxBaseline}
        setBaseline={setInboxBaseline}
        onSave={handleSaveInbox}
        onRequestDelete={(id) => setDeleteTarget(companyInboxes.find(i => i.id === id) || null)}
        metaWebhookUrl={metaWebhookUrl}
        disabled={false}
      />

      {/* Modal de Seleção de Provedor */}
      <Modal
        isOpen={providerPickerOpen}
        onClose={() => setProviderPickerOpen(false)}
        title="Escolha o Provedor"
      >
        <div className="grid grid-cols-1 gap-4 p-1">
          <button
            onClick={() => openCreateModalForProvider("META_CLOUD")}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Meta Cloud API</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Conexão oficial e estável via Facebook Developers.</div>
            </div>
          </button>

          <button
            onClick={() => openCreateModalForProvider("WAHA")}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">WAHA (Web WhatsApp)</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Conexão via QR Code (não oficial).</div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Modal de Criação */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={`Nova Caixa: ${isMeta ? 'Meta Cloud' : 'WAHA'}`}
      >
        <div className="space-y-4">
          <Input
            label="Nome da Caixa"
            placeholder="Ex: WhatsApp Suporte"
            value={createInboxForm.name}
            onChange={(e) => setCreateInboxForm({ ...createInboxForm, name: e.target.value })}
          />

          {!isWaha && (
            <Input
              label="Número de Telefone"
              placeholder="5511999999999"
              value={createInboxForm.phone_number}
              onChange={(e) => setCreateInboxForm({ ...createInboxForm, phone_number: e.target.value })}
            />
          )}

          {isMeta && (
            <>
              <Input
                label="Phone Number ID"
                placeholder="ID numérico da Meta"
                value={createInboxForm.provider_config?.meta?.phone_number_id || ""}
                onChange={(e) => setCreateInboxForm({
                  ...createInboxForm,
                  provider_config: {
                    ...createInboxForm.provider_config,
                    meta: { ...createInboxForm.provider_config?.meta, phone_number_id: e.target.value }
                  }
                })}
              />
              <Input
                label="WABA ID"
                placeholder="WhatsApp Business Account ID"
                value={createInboxForm.provider_config?.meta?.waba_id || ""}
                onChange={(e) => setCreateInboxForm({
                  ...createInboxForm,
                  provider_config: {
                    ...createInboxForm.provider_config,
                    meta: { ...createInboxForm.provider_config?.meta, waba_id: e.target.value }
                  }
                })}
              />
              <Input
                label="Access Token"
                placeholder="EAAB..."
                type="password"
                value={createInboxForm.provider_config?.meta?.access_token || ""}
                onChange={(e) => setCreateInboxForm({
                  ...createInboxForm,
                  provider_config: {
                    ...createInboxForm.provider_config,
                    meta: { ...createInboxForm.provider_config?.meta, access_token: e.target.value }
                  }
                })}
              />
              <Input
                label="App Secret"
                placeholder="App Secret do Painel Meta"
                type="password"
                value={createInboxForm.provider_config?.meta?.app_secret || ""}
                onChange={(e) => setCreateInboxForm({
                  ...createInboxForm,
                  provider_config: {
                    ...createInboxForm.provider_config,
                    meta: { ...createInboxForm.provider_config?.meta, app_secret: e.target.value }
                  }
                })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Webhook Verify Token</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="token seguro"
                    className="flex-1"
                    value={createInboxForm.provider_config?.meta?.webhook_verify_token || ""}
                    onChange={(e) => setCreateInboxForm({
                      ...createInboxForm,
                      provider_config: {
                        ...createInboxForm.provider_config,
                        meta: { ...createInboxForm.provider_config?.meta, webhook_verify_token: e.target.value }
                      }
                    })}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => setCreateInboxForm({
                      ...createInboxForm,
                      provider_config: {
                        ...createInboxForm.provider_config,
                        meta: { ...createInboxForm.provider_config?.meta, webhook_verify_token: generateVerifyToken() }
                      }
                    })}
                  >
                    Gerar
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={submitCreateInbox}
              disabled={createSaving || !createInboxForm.name}
            >
              {createSaving ? "Criando..." : "Criar Caixa"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Caixa de Entrada"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Tem certeza que deseja excluir a caixa <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span>?
            Esta ação não pode ser desfeita e todas as conexões serão perdidas.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteInbox}
              disabled={deleteSaving}
            >
              {deleteSaving ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
