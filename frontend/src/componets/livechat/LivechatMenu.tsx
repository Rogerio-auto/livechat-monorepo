import { FiMessageSquare, FiAlertCircle, FiUsers, FiSend, FiTag } from "react-icons/fi";

export type LivechatSection =
  | "all"
  | "unanswered"
  | "contacts"
  | "campaigns"
  | "labels";

type Props = {
  section: LivechatSection;
  onChange: (s: LivechatSection) => void;
  collapsed?: boolean;
};

const items: Array<{ key: LivechatSection; label: string; Icon: React.ComponentType<any> }> = [
  { key: "all", label: "Todas mensagens", Icon: FiMessageSquare },
  { key: "unanswered", label: "Não atendidas", Icon: FiAlertCircle },
  { key: "contacts", label: "Contatos", Icon: FiUsers },
  { key: "campaigns", label: "Campanhas", Icon: FiSend },
  { key: "labels", label: "Labels", Icon: FiTag },
];

export default function LivechatMenu({ section, onChange, collapsed = false }: Props) {
  return (
    <div className="flex flex-col gap-1 px-2">
      {items.map(({ key, label, Icon }) => {
        const active = key === section;
        const buttonClass = active
          ? "text-[var(--color-heading)] border"
          : "text-[var(--color-text-muted)] border border-transparent hover:border-[color:var(--color-border)] hover:bg-[color:color-mix(in srgb,var(--color-bg) 65%,transparent)]";
        const style = active
          ? {
              backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, transparent)",
              borderColor: "color-mix(in srgb, var(--color-primary) 45%, transparent)",
            }
          : undefined;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${buttonClass} ${collapsed ? 'justify-center px-2' : ''}`}
            style={style}
            title={collapsed ? label : undefined}
          >
            <Icon className={`${active ? "text-[var(--color-highlight)]" : "text-[var(--color-text-muted)]"} ${collapsed ? 'w-5 h-5' : ''}`} />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        );
      })}
    </div>

  );
}
