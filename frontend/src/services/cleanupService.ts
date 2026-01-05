/**
 * CleanupService - Serviço centralizado para limpeza de cache ao fazer logout
 * 
 * Responsabilidades:
 * - Desconectar Socket.IO
 * - Limpar localStorage/sessionStorage
 * - Executar callbacks customizados de limpeza
 * - Emitir evento global de logout
 * 
 * Uso:
 * ```typescript
 * import { cleanupService } from '@/services/cleanupService';
 * 
 * // Registrar socket para desconectar
 * cleanupService.registerSocket(socket);
 * 
 * // Registrar callback customizado
 * cleanupService.registerCleanup(() => {
 *   myCache.clear();
 * });
 * 
 * // Executar limpeza completa
 * await cleanupService.cleanup();
 * ```
 */

import type { Socket } from 'socket.io-client';

class CleanupService {
  private socketInstance: Socket | null = null;
  private cleanupCallbacks: Array<() => void> = [];

  /**
   * Registra instância do Socket.IO para desconectar no logout
   */
  registerSocket(socket: Socket | null) {
    if (socket) {
      this.socketInstance = socket;
    }
  }

  /**
   * Registra callback customizado para executar na limpeza
   */
  registerCleanup(callback: () => void) {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Limpa localStorage mantendo apenas chaves permitidas
   */
  private cleanLocalStorage() {
    // Chaves que podem ser mantidas (preferências globais não sensíveis)
    const keysToKeep = new Set([
      'theme-preference', // Preferência global de tema (opcional)
      // Adicione outras chaves não sensíveis se necessário
    ]);
    
    // Padrões de chaves do Supabase que devem ser removidas no logout
    const supabaseKeyPatterns = [
      /^sb-.*-auth-token$/,           // Token de sessão do Supabase
      /^supabase\.auth\.token$/,      // Token alternativo
      /^access_token$/,               // Token de acesso
      /^refresh_token$/,              // Token de refresh
    ];
    
    // Coletar todas as chaves
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    
    // Remover chaves específicas (incluindo tokens de autenticação)
    allKeys.forEach(key => {
      const shouldKeep = keysToKeep.has(key);
      
      // Remover se: não está na whitelist
      if (!shouldKeep) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Limpa sessionStorage completamente
   */
  private cleanSessionStorage() {
    sessionStorage.clear();
  }

  /**
   * Desconecta Socket.IO se estiver conectado
   */
  private disconnectSocket() {
    if (this.socketInstance) {
      try {
        this.socketInstance.disconnect();
      } catch (error) {
        console.error('[CleanupService] Error disconnecting socket:', error);
      }
      this.socketInstance = null;
    }
  }

  /**
   * Executa todos os callbacks customizados registrados
   */
  private runCustomCleanups() {
    this.cleanupCallbacks.forEach((callback, index) => {
      try {
        callback();
      } catch (error) {
        console.error(`[CleanupService] Error in custom cleanup ${index + 1}:`, error);
      }
    });
    
    // Limpar array de callbacks após executar
    this.cleanupCallbacks = [];
  }

  /**
   * Emite evento global de logout para componentes escutarem
   */
  private emitLogoutEvent() {
    window.dispatchEvent(new CustomEvent('user:logout', {
      detail: { timestamp: new Date().toISOString() }
    }));
  }

  /**
   * EXECUTA LIMPEZA COMPLETA DO SISTEMA
   * 
   * Ordem de execução:
   * 1. Desconectar Socket.IO (PRIMEIRO - evita receber dados durante limpeza)
   * 2. Executar callbacks customizados
   * 3. Limpar storages
   * 4. Emitir evento de logout
   * 
   * @returns Promise<void>
   */
  async cleanup(): Promise<void> {
    try {
      // 1. Desconectar Socket.IO PRIMEIRO (crítico)
      this.disconnectSocket();
      
      // 2. Executar callbacks customizados
      this.runCustomCleanups();
      
      // 3. Limpar storages
      this.cleanLocalStorage();
      this.cleanSessionStorage();
      
      // 4. Emitir evento global
      this.emitLogoutEvent();
      
    } catch (error) {
      console.error('[CleanupService] ❌ CLEANUP ERROR:', error);
      throw error;
    }
  }

  /**
   * Reset do serviço (útil para testes)
   */
  reset() {
    this.socketInstance = null;
    this.cleanupCallbacks = [];
  }

  /**
   * Retorna status do serviço (útil para debug)
   */
  getStatus() {
    return {
      hasSocket: !!this.socketInstance,
      callbacksCount: this.cleanupCallbacks.length,
      socketConnected: this.socketInstance?.connected ?? false,
    };
  }
}

// Exportar instância única (Singleton)
export const cleanupService = new CleanupService();

// Exportar tipo para TypeScript
export type { Socket };
