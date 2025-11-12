import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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