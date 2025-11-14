import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validação das variáveis de ambiente
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase configuration missing:", {
    VITE_SUPABASE_URL: supabaseUrl ? "✅" : "❌",
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? "✅" : "❌",
  });
  throw new Error(
    "Supabase configuration is missing. Please check your environment variables:\n" +
    "- VITE_SUPABASE_URL\n" +
    "- VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Não usar sessão do Supabase Auth
    autoRefreshToken: false,
  },
  global: {
    headers: {
      // Função para obter o token JWT do localStorage
      get Authorization() {
        const token = localStorage.getItem("token");
        return token ? `Bearer ${token}` : "";
      },
    },
  },
});