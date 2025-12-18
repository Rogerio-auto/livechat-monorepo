// frontend/src/hooks/useAgentWebSocket.ts
import { useEffect } from 'react';

export function useAgentWebSocket(agentId: string, onMessage: (msg: any) => void) {
  useEffect(() => {
    // TODO: Implementar WebSocket
  }, [agentId, onMessage]);
}
