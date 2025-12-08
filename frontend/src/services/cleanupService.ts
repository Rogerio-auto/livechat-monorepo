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
      console.log('[CleanupService] Socket registered for cleanup');
    }
  }

  /**
   * Registra callback customizado para executar na limpeza
   */
  registerCleanup(callback: () => void) {
    this.cleanupCallbacks.push(callback);
    console.log('[CleanupService] Cleanup callback registered');
  }

  /**
   * Limpa localStorage mantendo apenas chaves permitidas
   */
  private cleanLocalStorage() {
    console.log('[CleanupService] Cleaning localStorage...');
    
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
    let removed = 0;
    allKeys.forEach(key => {
      const shouldKeep = keysToKeep.has(key);
      const isSupabaseAuth = supabaseKeyPatterns.some(pattern => pattern.test(key));
      
      // Remover se: não está na whitelist E (é token do Supabase OU não está na whitelist)
      if (!shouldKeep) {
        localStorage.removeItem(key);
        removed++;
        if (isSupabaseAuth) {
          console.log(`[CleanupService] Removed auth token: ${key}`);
        }
      }
    });
    
    console.log(`[CleanupService] Removed ${removed} keys from localStorage`);
  }

  /**
   * Limpa sessionStorage completamente
   */
  private cleanSessionStorage() {
    console.log('[CleanupService] Cleaning sessionStorage...');
    const count = sessionStorage.length;
    sessionStorage.clear();
    console.log(`[CleanupService] Cleared ${count} keys from sessionStorage`);
  }

  /**
   * Desconecta Socket.IO se estiver conectado
   */
  private disconnectSocket() {
    if (this.socketInstance) {
      console.log('[CleanupService] Disconnecting Socket.IO...');
      try {
        this.socketInstance.disconnect();
        console.log('[CleanupService] Socket.IO disconnected');
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
    console.log(`[CleanupService] Running ${this.cleanupCallbacks.length} custom cleanups...`);
    
    this.cleanupCallbacks.forEach((callback, index) => {
      try {
        callback();
        console.log(`[CleanupService] Custom cleanup ${index + 1} completed`);
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
    console.log('[CleanupService] Emitting user:logout event');
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
    console.log('═══════════════════════════════════════════════════');
    console.log('[CleanupService] 🧹 STARTING FULL SYSTEM CLEANUP');
    console.log('═══════════════════════════════════════════════════');
    
    const startTime = performance.now();
    
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
      
      const duration = (performance.now() - startTime).toFixed(2);
      
      console.log('═══════════════════════════════════════════════════');
      console.log(`[CleanupService] ✅ CLEANUP COMPLETED in ${duration}ms`);
      console.log('═══════════════════════════════════════════════════');
      
    } catch (error) {
      console.error('═══════════════════════════════════════════════════');
      console.error('[CleanupService] ❌ CLEANUP ERROR:', error);
      console.error('═══════════════════════════════════════════════════');
      throw error;
    }
  }

  /**
   * Reset do serviço (útil para testes)
   */
  reset() {
    console.log('[CleanupService] Resetting service');
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
