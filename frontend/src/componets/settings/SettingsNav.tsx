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
                    ? "bg-blue-600 dark:bg-blue-700 text-white shadow-lg shadow-blue-500/50"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
                onClick={() => onChange(s.id)}
              >
                <div className={`text-sm font-semibold ${active ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
                  {s.title}
                </div>
                {s.subtitle && (
                  <div className={`text-xs mt-0.5 ${
                    active
                      ? "text-white/90"
                      : "text-gray-600 dark:text-gray-400"
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
