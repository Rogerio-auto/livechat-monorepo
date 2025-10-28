// src/pages/componets/livechat/TemplatePicker.tsx
export default function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: { id: string; name: string; kind: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span>Template</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent text-sm"
      >
        <option value="">Selecione…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.kind}
          </option>
        ))}
      </select>
    </label>
  );
}
