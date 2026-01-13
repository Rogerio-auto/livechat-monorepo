import { Request } from "express";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      company_id?: string | null;
      role?: string | null;
      name?: string | null;
      avatar?: string | null;
      phone?: string | null;
      theme_preference?: string | null;
    }

    interface Request {
      user?: User;
      profile?: any;
    }
  }
}

export interface AuthRequest extends Request {
  // Tornamos user opcional para compatibilidade com RequestHandler
  user?: Express.User;
  profile?: any;
}
