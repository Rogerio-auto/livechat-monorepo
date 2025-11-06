type Section = { id: string; title: string; subtitle?: string };

export default function SettingsNav({
  sections,
  current,
  onChange,
}: {
  sections: Section[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="sticky top-6">
      <ul className="space-y-1">
        {sections.map((s) => {
          const active = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-(--color-primary) text-(--color-on-primary) shadow-lg"
                    : "text-(--color-text) hover:bg-(--color-sidebar-hover)"
                }`}
                onClick={() => onChange(s.id)}
              >
                <div className={`text-sm font-semibold ${active ? "text-(--color-on-primary)" : "text-(--color-text)"}`}>
                  {s.title}
                </div>
                {s.subtitle && (
                  <div className={`text-xs mt-0.5 ${
                    active
                      ? "text-(--color-on-primary) opacity-80"
                      : "text-(--color-text-muted)"
                  }`}>
                    {s.subtitle}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
