import React, { useState, useRef } from "react";
import { FiUpload, FiX, FiCheckCircle, FiAlertCircle, FiFile } from "react-icons/fi";
import { Button } from "../../components/ui/Button";
import { getAccessToken } from "../../utils/api";

type UploadStats = {
  total: number;
  valid: number;
  invalid: number;
  inserted: number;
  skipped_existing: number;
  created_customers: number;
  created_leads: number;
  failed: number;
};

type Props = {
  apiBase: string;
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function CampaignUploadRecipientsModal({
  apiBase,
  campaignId,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase().split(".").pop();
    if (!["txt", "csv", "xlsx", "xls"].includes(ext || "")) {
      setError("Formato não suportado. Use TXT, CSV ou XLSX.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStats(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setStats(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAccessToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const response = await fetch(
        `${apiBase}/livechat/campaigns/${campaignId}/upload-recipients`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setStats(data.stats);
      
      // Success - will show in the stats display
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      }
    } catch (err: any) {
      console.error("[CampaignUpload] Error:", err);
      setError(err.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setStats(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FiUpload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Enviar Lista de Números
              </h2>
              <p className="text-sm text-gray-500">
                TXT, CSV ou XLSX com telefones e nomes
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-2">
              Formatos aceitos:
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
              <li>• <strong>TXT:</strong> Um número por linha (ex: 5511999999999)</li>
              <li>• <strong>CSV:</strong> Coluna 1: phone, Coluna 2: name (opcional)</li>
              <li>• <strong>XLSX:</strong> Planilha com colunas phone e name</li>
              <li>• Você pode separar nome com vírgula ou tab: <code>5511999999999,João Silva</code></li>
            </ul>
          </div>

          {/* Upload Area */}
          {!stats && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                dragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />

              {!file ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-xl bg-linear-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                    <FiFile className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Arraste o arquivo aqui
                    </p>
                    <p className="text-xs text-gray-500">
                      ou clique para selecionar
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <FiFile className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setError(null);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <FiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-green-900 dark:text-green-300">
                    Upload concluído com sucesso!
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    {stats.inserted} números adicionados à campanha
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Total processados
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total}
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                    Válidos
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {stats.valid}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Inseridos
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {stats.inserted}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                    Novos contatos
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {stats.created_customers}
                  </p>
                </div>
                {stats.invalid > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                      Inválidos
                    </p>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                      {stats.invalid}
                    </p>
                  </div>
                )}
                {stats.failed > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-xs text-red-600 dark:text-red-400 mb-1">
                      Falhas
                    </p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {stats.failed}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Warnings section */}
              {(stats as any).warnings && (stats as any).warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-yellow-900 dark:text-yellow-300 mb-2">
                        Avisos de Validação:
                      </p>
                      <ul className="text-xs text-yellow-800 dark:text-yellow-400 space-y-1">
                        {(stats as any).warnings.map((warning: string, idx: number) => (
                          <li key={idx}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={handleClose} variant="outline">
            {stats ? "Fechar" : "Cancelar"}
          </Button>
          {!stats && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              <FiUpload className="w-4 h-4 mr-2" />
              {uploading ? "Enviando..." : "Enviar Lista"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

