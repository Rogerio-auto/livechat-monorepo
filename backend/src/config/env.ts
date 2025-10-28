// src/config/env.ts
import dotenv from "dotenv";
import path from "path";

const backendEnvPath = path.resolve(process.cwd(), ".env"); // mais robusto que __dirname/dist
dotenv.config({ path: backendEnvPath });
dotenv.config();

export const PORT = Number(process.env.PORT_BACKEND || 5000);

export const FRONTEND_ORIGINS: string[] = Array.from(
  new Set(
    [
      ...(process.env.FRONTEND_ORIGIN || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
  )
);

export const SUPABASE_URL = process.env.SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "sb_access_token";
export const JWT_COOKIE_SECURE = String(process.env.JWT_COOKIE_SECURE) === "true";

export const DOCS_BUCKET = process.env.DOCS_BUCKET || "documents";

export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";
