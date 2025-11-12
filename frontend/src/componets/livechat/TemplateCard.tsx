import React from "react";
import { FiEdit2, FiCopy, FiTrash2, FiEye, FiImage, FiVideo, FiFileText, FiDollarSign, FiMessageSquare, FiCreditCard, FiUpload, FiCheckCircle, FiClock, FiXCircle, FiPauseCircle, FiSlash, FiEdit3, FiHardDrive } from "react-icons/fi";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

type Template = {
  id: string;
  name: string;
  kind: string;
  status?: string;
  meta_status?: string;
  meta_template_id?: string;
};

type TemplateCardProps = {
  template: Template;
  canManage: boolean;
  onEdit: (template: Template) => void;
  onClone: (template: Template) => void;
  onDelete: (template: Template) => void;
  onView: (template: Template) => void;
  onSubmitToMeta?: (template: Template) => void;
};

const getIconByKind = (kind: string) => {
  const iconClass = "w-6 h-6";
  switch (kind.toUpperCase()) {
    case "TEXT":
      return <FiMessageSquare className={`${iconClass} text-gray-600 dark:text-gray-400`} />;
    case "IMAGE":
    case "MEDIA_TEXT":
      return <FiImage className={`${iconClass} text-blue-600 dark:text-blue-400`} />;
    case "VIDEO":
      return <FiVideo className={`${iconClass} text-purple-600 dark:text-purple-400`} />;
    case "DOCUMENT":
      return <FiFileText className={`${iconClass} text-orange-600 dark:text-orange-400`} />;
    case "BUTTONS":
      return <FiCreditCard className={`${iconClass} text-indigo-600 dark:text-indigo-400`} />;
    case "PAYMENT":
      return <FiDollarSign className={`${iconClass} text-green-600 dark:text-green-400`} />;
    default:
      return <FiFileText className={`${iconClass} text-gray-600 dark:text-gray-400`} />;
  }
};

const getTypeLabel = (kind: string) => {
  switch (kind.toUpperCase()) {
    case "TEXT": return "Texto";
    case "IMAGE": return "Imagem";
    case "VIDEO": return "Vídeo";
    case "DOCUMENT": return "Documento";
    case "BUTTONS": return "Botões";
    case "PAYMENT": return "Pagamento";
    case "MEDIA_TEXT": return "Mídia + Texto";
    default: return kind;
  }
};

const getStatusBadge = (status?: string, metaStatus?: string) => {
  if (metaStatus === "APPROVED") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium border border-green-200 dark:border-green-800 flex items-center gap-1">
        <FiCheckCircle className="w-3 h-3" /> Aprovado Meta
      </span>
    );
  }
  if (metaStatus === "PENDING") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium border border-yellow-200 dark:border-yellow-800 flex items-center gap-1">
        <FiClock className="w-3 h-3" /> Aguardando Meta
      </span>
    );
  }
  if (metaStatus === "REJECTED") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium border border-red-200 dark:border-red-800 flex items-center gap-1">
        <FiXCircle className="w-3 h-3" /> Rejeitado Meta
      </span>
    );
  }
  if (metaStatus === "PAUSED") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium border border-orange-200 dark:border-orange-800 flex items-center gap-1">
        <FiPauseCircle className="w-3 h-3" /> Pausado Meta
      </span>
    );
  }
  if (metaStatus === "DISABLED") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-1">
        <FiSlash className="w-3 h-3" /> Desabilitado Meta
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-1">
        <FiEdit3 className="w-3 h-3" /> Rascunho
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-800 flex items-center gap-1">
      <FiHardDrive className="w-3 h-3" /> Local
    </span>
  );
};

export default function TemplateCard({ template, canManage, onEdit, onClone, onDelete, onView, onSubmitToMeta }: TemplateCardProps) {
  const canSubmitToMeta = !template.meta_template_id && canManage && onSubmitToMeta;
  const hasMetaStatus = !!template.meta_status;

  return (
    <Card 
      gradient={false}
      hover
      padding="none"
      className="shrink-0 w-72 overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600"
    >
      {/* Header com ícone grande e badge */}
      <div className="p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 border-b border-gray-100 dark:border-gray-700 group-hover:from-blue-50/30 dark:group-hover:from-blue-900/10 transition-colors duration-300">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            {getIconByKind(template.kind)}
          </div>
          {getStatusBadge(template.status, template.meta_status)}
        </div>
        
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 truncate" title={template.name}>
            {template.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {getTypeLabel(template.kind)}
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="p-4 bg-white dark:bg-gray-800/30">
        {/* Botão "Enviar para Meta" se ainda não foi enviado */}
        {canSubmitToMeta && (
          <Button
            onClick={() => onSubmitToMeta(template)}
            variant="gradient"
            size="sm"
            className="w-full mb-3 text-xs"
          >
            <FiUpload className="w-3.5 h-3.5 mr-1.5" /> Enviar para Meta
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={() => onView(template)}
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
          >
            <FiEye className="w-3.5 h-3.5 mr-1.5" /> Ver
          </Button>

          {canManage && (
            <>
              <Button
                onClick={() => onEdit(template)}
                variant="ghost"
                size="sm"
                className="px-2.5"
                aria-label="Editar"
              >
                <FiEdit2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={() => onClone(template)}
                variant="ghost"
                size="sm"
                className="px-2.5"
                aria-label="Clonar"
              >
                <FiCopy className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={() => onDelete(template)}
                variant="ghost"
                size="sm"
                className="px-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                aria-label="Excluir"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
