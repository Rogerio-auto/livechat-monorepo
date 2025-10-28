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
    <nav className="config-nav rounded-2xl sticky top-6">
      <ul className="p-3 space-y-1">
        {sections.map((s) => {
          const active = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`config-nav-btn w-full text-left px-3 py-2 rounded-xl transition ${
                  active ? "config-nav-btn--active" : ""
                }`}
                onClick={() => onChange(s.id)}
              >
                <div
                  className={`text-sm font-medium ${
                    active ? "config-heading" : "config-text-muted"
                  }`}
                >
                  {s.title}
                </div>
                {s.subtitle && (
                  <div
                    className={`config-nav-btn__subtitle text-xs ${
                      active ? "config-nav-btn__subtitle--active" : ""
                    }`}
                  >
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
