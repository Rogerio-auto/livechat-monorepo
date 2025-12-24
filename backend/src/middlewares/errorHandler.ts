import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.ts";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    logger.warn(`[Validation Error] ${req.method} ${req.path}`, {
      errors: err.errors.map(e => ({ path: e.path, message: e.message }))
    });
    
    return res.status(400).json({
      error: "Erro de validação de dados",
      details: err.errors.map(e => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }

  // Log de erro genérico (PII já é tratado pelo logger se passarmos o objeto de erro corretamente)
  logger.error(`[Unhandled Error] ${req.method} ${req.path}`, {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });

  return res.status(500).json({
    error: "Ocorreu um erro interno no servidor"
  });
}
