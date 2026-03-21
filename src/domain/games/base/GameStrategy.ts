import { GameType, Participant, GameSession } from '../../../types/game.types';

/**
 * Interface mínima para estrategias de juego.
 * Definida ANTES de BaseGame para que BaseGame dependa de la interface,
 * no de la implementación (Dependency Inversion Principle).
 */
export interface GameStrategy {
  /** Tipo de juego (trivia, reaction, etc.) */
  readonly gameType: GameType;

  /** Nombre legible del juego */
  readonly gameName: string;

  /** Cantidad total de rondas */
  readonly totalRounds: number;

  /** Nombre del premio asociado */
  readonly prizeName: string;

  /**
   * Ejecuta la lógica de una ronda específica.
   * @param round - Número de ronda (1-indexed)
   */
  roundLogic(round: number): Promise<void>;

  /**
   * Determina el ganador al final del juego.
   * @returns El Participant ganador o null si hay empate/tie
   */
  evaluateWinner(): Participant | null;
}

/**
 * Contexto compartido que las estrategias pueden usar para acceder al estado del juego.
 * Esto permite que las estrategias sean stateless pero tengan acceso al estado cuando lo necesiten.
 */
export interface GameStrategyContext {
  session: GameSession;
  participants: Participant[];
  currentRound: number;
}
