import { GameType } from '../../types/game.types';
import { GameStrategy } from '../../domain/games/base/GameStrategy';
import { SystemLogger } from '../logger/SystemLogger';

/**
 * Registro centralizado de estrategias de juego disponibles.
 * Implementa el patrón Registry para permitir registro dinámico de juegos.
 */
export class GameRegistry {
  private readonly games: Map<GameType, GameStrategy> = new Map();

  /**
   * Registra una estrategia de juego en el registry.
   * @param strategy - La estrategia a registrar
   * @throws Error si ya existe un juego del mismo tipo
   */
  register(strategy: GameStrategy): void {
    if (this.games.has(strategy.gameType)) {
      const existing = this.games.get(strategy.gameType);
      SystemLogger.warn('Game already registered, skipping', {
        gameType: strategy.gameType,
        existingGame: existing?.gameName,
        newGame: strategy.gameName,
      });
      return;
    }

    this.games.set(strategy.gameType, strategy);
    SystemLogger.info('Game registered', {
      gameType: strategy.gameType,
      gameName: strategy.gameName,
      totalRounds: strategy.totalRounds,
      prizeName: strategy.prizeName,
    });
  }

  /**
   * Elimina un juego del registry.
   * @param gameType - El tipo de juego a remover
   */
  unregister(gameType: GameType): void {
    const removed = this.games.delete(gameType);
    if (removed) {
      SystemLogger.info('Game unregistered', { gameType });
    }
  }

  /**
   * Obtiene una estrategia de juego por su tipo.
   * @param gameType - El tipo de juego a buscar
   * @returns La estrategia o undefined si no existe
   */
  get(gameType: GameType): GameStrategy | undefined {
    return this.games.get(gameType);
  }

  /**
   * Lista todas las estrategias de juego registradas.
   * @returns Array con todas las estrategias
   */
  getAll(): GameStrategy[] {
    return Array.from(this.games.values());
  }

  /**
   * Verifica si existe un juego del tipo especificado.
   * @param gameType - El tipo de juego a verificar
   * @returns true si existe, false otherwise
   */
  has(gameType: GameType): boolean {
    return this.games.has(gameType);
  }

  /**
   * Obtiene los nombres de todos los juegos disponibles.
   * Útil para listar en el comando !games list.
   * @returns Array con los nombres de juegos disponibles
   */
  getGameNames(): string[] {
    return Array.from(this.games.values()).map(strategy => strategy.gameName);
  }

  /**
   * Obtiene información resumida de todos los juegos.
   * Incluye tipo, nombre y cantidad de rondas.
   */
  getGameInfo(): Array<{ type: GameType; name: string; rounds: number; prize: string }> {
    return Array.from(this.games.values()).map(strategy => ({
      type: strategy.gameType,
      name: strategy.gameName,
      rounds: strategy.totalRounds,
      prize: strategy.prizeName,
    }));
  }
}

/**
 * Instancia singleton del registry para uso global.
 */
export const gameRegistry = new GameRegistry();
