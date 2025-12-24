// backend/src/lib/logger.ts

const SENSITIVE_KEYS = [
  "email",
  "phone",
  "password",
  "token",
  "access_token",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
  "cookie",
  "password_hash",
  "client_secret"
];

/**
 * Recursively masks sensitive values in an object or array
 */
export function maskPII(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskPII);
  }

  const masked: any = { ...data };

  for (const key in masked) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      if (typeof masked[key] === "string") {
        const val = masked[key];
        if (val.length <= 4) {
          masked[key] = "****";
        } else {
          // Keep first 2 and last 2 characters
          masked[key] = `${val.substring(0, 2)}****${val.substring(val.length - 2)}`;
        }
      } else {
        masked[key] = "****";
      }
    } else if (typeof masked[key] === "object") {
      masked[key] = maskPII(masked[key]);
    }
  }

  return masked;
}

/**
 * Secure logger that masks PII before printing to console
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args.map(maskPII));
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args.map(maskPII));
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args.map(maskPII));
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${message}`, ...args.map(maskPII));
    }
  }
};
