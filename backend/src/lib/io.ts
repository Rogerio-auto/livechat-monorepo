// src/lib/io.ts
import type { Server as SocketIOServer } from "socket.io";

let _io: SocketIOServer | null = null;

export function setIO(io: SocketIOServer) {
  _io = io;
}

/** Garante que o IO está pronto. Se não estiver, lança erro claro. */
export function getIO(): SocketIOServer {
  if (!_io) {
    throw new Error(
      "[io] Socket.IO não inicializado. Chame setIO(io) antes de usar getIO()."
    );
  }
  return _io;
}

/** Útil para condicionais ocasionais, sem usar try/catch. */
export function hasIO(): boolean {
  return !!_io;
}
