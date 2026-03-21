import { EventEmitter as NodeEventEmitterClass } from 'node:events';

/**
 * Interfaz que extiende EventEmitter con los métodos de instancia de Node.js.
 * Esto es necesario porque en @types/node 20.x, la clase EventEmitter de 'events'
 * usa un sistema de tipos genérico basado en EventMap, y los métodos como
 * setMaxListeners y removeAllListeners están definidos en la interfaz
 * NodeJS.EventEmitter del global scope.
 *
 * Usamos una intersección de tipos para combinar la clase EventEmitter
 * base con los métodos adicionales que necesitamos.
 */
type NodeEventEmitter = NodeEventEmitterClass & {
  setMaxListeners(n: number): NodeEventEmitter;
  getMaxListeners(): number;
  removeAllListeners(event?: string | symbol): NodeEventEmitter;
  removeListener(event: string | symbol, listener: (...args: unknown[]) => void): NodeEventEmitter;
  off(event: string | symbol, listener: (...args: unknown[]) => void): NodeEventEmitter;
  on(event: string | symbol, listener: (...args: unknown[]) => void): NodeEventEmitter;
  once(event: string | symbol, listener: (...args: unknown[]) => void): NodeEventEmitter;
  addListener(event: string | symbol, listener: (...args: unknown[]) => void): NodeEventEmitter;
  emit(event: string | symbol, ...args: unknown[]): boolean;
  eventNames(): Array<string | symbol>;
  listenerCount(event: string | symbol): number;
  listeners(event: string | symbol): Array<(...args: unknown[]) => void>;
};

/**
 * Constantes de eventos para el sistema de juegos.
 * Centraliza los nombres de eventos para evitar typos y facilitar refactoring.
 */
export const GAME_EVENTS = {
  PLAYER_JOINED: 'player:joined',
  GAME_START: 'game:start',
  GAME_ROUND: 'game:round',
  GAME_WINNER: 'game:winner',
  GAME_END: 'game:end',
} as const;

/** Tipo union derivado de los eventos disponibles */
export type GameEventName = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];

/**
 * Payload para eventos de jugador joined
 */
export interface PlayerJoinedPayload {
  userId: string;
  discordId: string;
  sessionId: string;
  participantCount: number;
}

/**
 * Payload para eventos de inicio de juego
 */
export interface GameStartPayload {
  sessionId: string;
  gameType: string;
  participantCount: number;
  totalRounds: number;
}

/**
 * Payload para eventos de fin de ronda
 */
export interface GameRoundPayload {
  sessionId: string;
  round: number;
  totalRounds: number;
  roundWinnerId?: string;
}

/**
 * Payload para eventos de ganador
 */
export interface GameWinnerPayload {
  sessionId: string;
  winnerId: string;
  winnerDiscordId: string;
  prizeName: string;
  prizeTier?: string;
}

/**
 * Payload para eventos de fin de juego
 */
export interface GameEndPayload {
  sessionId: string;
  gameType: string;
  winnerId?: string;
  totalRounds: number;
  participantCount: number;
}

/**
 * EventEmitter aislados por sessionId.
 * Una sesión no puede recibir eventos de otra.
 *
 * Usage:
 * ```typescript
 * const scoped = new ScopedEventEmitter();
 *
 * // Crear emitter para una sesión específica
 * const sessionEmitter = scoped.forSession('session-123');
 * sessionEmitter.on('player:joined', (payload) => console.log(payload));
 *
 * // Cleanup cuando termina la sesión
 * scoped.destroySession('session-123');
 *
 * // Eventos globales (cross-session)
 * const globalEmitter = scoped.global();
 * globalEmitter.on('game:start', (payload) => console.log('Game started globally'));
 * ```
 */
export class ScopedEventEmitter {
  private readonly emitters: Map<string, NodeEventEmitter> = new Map();
  private readonly globalEmitter: NodeEventEmitter;

  constructor() {
    this.globalEmitter = new NodeEventEmitterClass() as NodeEventEmitter;
  }

  /**
   * Obtiene o crea un EventEmitter para la sesión especificada.
   * Los eventos emitidos en este emitter SOLO son recibidos por listeners
   * registrados en la misma sesión.
   *
   * @param sessionId - ID único de la sesión
   * @returns EventEmitter dedicado a esa sesión
   */
  forSession(sessionId: string): NodeEventEmitter {
    let emitter = this.emitters.get(sessionId);

    if (emitter === undefined) {
      const newEmitter = new NodeEventEmitterClass() as NodeEventEmitter;
      newEmitter.setMaxListeners(50); // Permitir múltiples listeners por sesión
      this.emitters.set(sessionId, newEmitter);
      return newEmitter;
    }

    return emitter;
  }

  /**
   * Limpia todos los listeners y elimina el emitter de una sesión.
   * Debe llamarse cuando termina una sesión para evitar memory leaks.
   *
   * @param sessionId - ID de la sesión a destruir
   */
  destroySession(sessionId: string): void {
    const emitter = this.emitters.get(sessionId);

    if (emitter !== undefined) {
      emitter.removeAllListeners();
      this.emitters.delete(sessionId);
    }
  }

  /**
   * Obtiene el EventEmitter global.
   * Los eventos emitidos aquí son recibidos por TODOS los listeners globales,
   * independientemente de la sesión.
   * Útil para logging, métricas, o eventos de admin.
   *
   * @returns EventEmitter global
   */
  global(): NodeEventEmitter {
    return this.globalEmitter;
  }

  /**
   * Verifica si existe un emitter para la sesión especificada.
   *
   * @param sessionId - ID de la sesión
   * @returns true si existe un emitter para esa sesión
   */
  hasSession(sessionId: string): boolean {
    return this.emitters.has(sessionId);
  }

  /**
   * Retorna el número de sesiones activas.
   * Útil para debugging y métricas.
   *
   * @returns Cantidad de emitters de sesión activos
   */
  getActiveSessionCount(): number {
    return this.emitters.size;
  }

  /**
   * Destruye TODOS los emitters de sesión (pero NO el global).
   * Útil para cleanup completo del sistema.
   */
  destroyAllSessions(): void {
    for (const emitter of this.emitters.values()) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
  }

  /**
   * Destruye el emitter global y lo recrea.
   * Útil para testing o reset completo.
   */
  resetGlobal(): void {
    this.globalEmitter.removeAllListeners();
  }
}
