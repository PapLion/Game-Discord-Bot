import { GameType } from '../../types/game.types';
import { GameStrategy } from '../../domain/games/base/GameStrategy';
import { BaseGame } from '../../domain/games/base/BaseGame';
import { TriviaGame } from '../../domain/games/builtin/TriviaGame';
import { GameRegistry } from './GameRegistry';
import { TextChannel, Guild } from 'discord.js';
import { LiveMessageManager } from '../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../events/ScopedEventEmitter';
import { DatabaseService } from '../database/DatabaseService';
import { GuildConfigService } from '../database/GuildConfigService';
import { SystemLogger } from '../logger/SystemLogger';

/**
 * Dependencias requeridas por GameFactory para crear instancias de juegos.
 */
export interface GameFactoryDeps {
  gameRegistry: GameRegistry;
  liveMessageManager: LiveMessageManager;
  scopedEventEmitter: ScopedEventEmitter;
  db: DatabaseService;
  guildConfigService: GuildConfigService;
}

/**
 * Factory para crear instancias de juegos concretos con inyección de dependencias.
 *
 * Cada tipo de juego tiene su propia clase concreta (TriviaGame, ReactionGame, etc.).
 * Esta factory crea la instancia correcta basándose en el gameType.
 *
 * IMPORTANTE: BaseGame es abstracta — NO se puede instanciar directamente.
 * Solo se crean clases concretas que extienden BaseGame.
 */
export class GameFactory {
  private readonly deps: GameFactoryDeps;

  constructor(deps: GameFactoryDeps) {
    this.deps = deps;
  }

  /**
   * Crea una nueva instancia de juego del tipo especificado.
   *
   * @param gameType - Tipo de juego a crear
   * @param channel - Canal de Discord donde se ejecuta el juego
   * @param guild - Servidor de Discord
   * @param startedBy - ID del usuario que inicia el juego
   * @returns Nueva instancia de BaseGame (concreta) o null si el tipo no existe
   */
  create(
    gameType: GameType,
    channel: TextChannel,
    guild: Guild,
    startedBy: string
  ): BaseGame | null {
    // Verificar que el tipo existe en el registry
    const strategy = this.deps.gameRegistry.get(gameType);
    if (!strategy) {
      SystemLogger.warn('Attempted to create unknown game type', {
        gameType,
        channelId: channel.id,
        guildId: guild.id,
      });
      return null;
    }

    try {
      // Crear la instancia concreta según el tipo de juego
      // BaseGame y sus subclases usan parámetros individuales en el constructor
      const game = this.createGameInstance(gameType, channel, guild, startedBy);

      SystemLogger.info('Game instance created', {
        gameType,
        gameName: strategy.gameName,
        channelId: channel.id,
        guildId: guild.id,
        startedBy,
      });

      return game;
    } catch (error) {
      SystemLogger.error('Failed to create game instance', {
        gameType,
        channelId: channel.id,
        guildId: guild.id,
        startedBy,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Crea la instancia concreta del juego según el tipo.
   * Cada juego concreto tiene su propia lógica de instanciación.
   */
  private createGameInstance(
    gameType: GameType,
    channel: TextChannel,
    guild: Guild,
    startedBy: string
  ): BaseGame {
    switch (gameType) {
      case 'trivia':
        return new TriviaGame(
          channel,
          guild,
          startedBy,
          this.deps.liveMessageManager,
          this.deps.scopedEventEmitter,
          this.deps.db,
          this.deps.guildConfigService
        );

      // Los demás juegos se agregan en R-F
      default:
        throw new Error(`Unsupported game type: ${gameType}`);
    }
  }

  /**
   * Verifica si un tipo de juego está disponible.
   * @param gameType - Tipo de juego a verificar
   */
  isAvailable(gameType: GameType): boolean {
    return this.deps.gameRegistry.has(gameType);
  }

  /**
   * Lista todos los tipos de juego disponibles.
   */
  getAvailableTypes(): GameType[] {
    return this.deps.gameRegistry.getAll().map(s => s.gameType);
  }
}
