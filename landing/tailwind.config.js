/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2fb463",
          dark: "#1f8b49",
          light: "rgba(47, 180, 99, 0.12)",
        },
        secondary: "#3b82f6",
        accent: "#8b5cf6",
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          300: "#cbd5f5",
          500: "#64748b",
          700: "#334155",
          900: "#0f172a",
        },
      },
      boxShadow: {
        soft: "0 10px 40px rgba(15, 23, 42, 0.08)",
      },
      backgroundImage: {
        "grid-light": "linear-gradient(90deg, rgba(15,23,42,.05) 1px, transparent 1px), linear-gradient(0deg, rgba(15,23,42,.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
