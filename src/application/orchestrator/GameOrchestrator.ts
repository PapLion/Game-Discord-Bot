import { Message, TextChannel } from 'discord.js';
import { CommandContext } from '../../types/command.types';
import { GameType } from '../../types/game.types';
import { GameRegistry, gameRegistry } from '../../infrastructure/plugins/GameRegistry';
import { GameFactory, GameFactoryDeps } from '../../infrastructure/plugins/GameFactory';
import { LiveMessageManager } from '../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter, GAME_EVENTS } from '../../infrastructure/events/ScopedEventEmitter';
import { BaseGame } from '../../domain/games/base/BaseGame';
import { DatabaseService, getDatabaseService } from '../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../infrastructure/database/GuildConfigService';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { GameError, ERROR_CODES } from '../../types/errors';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../infrastructure/logger/AuditLogger';
import { GAME_CONSTANTS } from '../../types/constants';

/**
 * Mapeo de aliases de tipos de juego a GameType.
 * Permite que los usuarios escriban "!start trivia" en lugar de "!start trivia".
 */
const GAME_TYPE_ALIASES: Record<string, GameType> = {
  trivia: 'trivia',
  t: 'trivia',
  reaction: 'reaction',
  r: 'reaction',
  math: 'math',
  m: 'math',
  wordpuzzle: 'wordpuzzle',
  words: 'wordpuzzle',
  dice: 'dice',
  spinwheel: 'spinwheel',
  guessing: 'guessing',
  elimination: 'elimination',
  tournament: 'tournament',
  eventtrivia: 'eventtrivia',
  highstakes: 'highstakes',
  midnightdrop: 'midnightdrop',
  bossbattle: 'bossbattle',
};

// Extender BaseGame con propiedad privada para cleanup timeout
interface BaseGameWithCleanup extends BaseGame {
  cleanupTimeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * GameOrchestrator — Fachada que coordina todos los componentes del sistema de juegos.
 *
 * Responsabilidades:
 * - Gestionar juegos activos por guild (un juego por guild a la vez)
 * - Crear instancias de juego via GameFactory
 * - Manejar la lógica de comandos: start, join, play
 * - Coordinar cleanup cuando terminan los juegos
 *
 * SINGLETON — acceder via GameOrchestrator.getInstance()
 */
export class GameOrchestrator {
  // Singleton
  private static instance: GameOrchestrator;

  // Juegos activos por guildId — un juego por guild
  private readonly activeGames: Map<string, BaseGameWithCleanup> = new Map();

  // Dependencias inyectadas
  private readonly liveMessageManager: LiveMessageManager;
  private readonly scopedEventEmitter: ScopedEventEmitter;
  private readonly gameFactory: GameFactory;
  private readonly db: DatabaseService;
  private readonly guildConfigService: GuildConfigService;

  private constructor() {
    // Inicializar dependencias
    this.db = getDatabaseService();
    this.guildConfigService = new GuildConfigService(this.db);
    this.scopedEventEmitter = new ScopedEventEmitter();
    this.liveMessageManager = LiveMessageManager.getInstance();

    // Crear factory con dependencias
    const factoryDeps: GameFactoryDeps = {
      gameRegistry,
      liveMessageManager: this.liveMessageManager,
      scopedEventEmitter: this.scopedEventEmitter,
      db: this.db,
      guildConfigService: this.guildConfigService,
    };
    this.gameFactory = new GameFactory(factoryDeps);

    // Registrar estrategias de juego disponibles
    this.registerGameStrategies();

    SystemLogger.info('GameOrchestrator initialized');
  }

  /**
   * Obtiene la instancia singleton del orchestrator.
   */
  static getInstance(): GameOrchestrator {
    if (!GameOrchestrator.instance) {
      GameOrchestrator.instance = new GameOrchestrator();
    }
    return GameOrchestrator.instance;
  }

  /**
   * Registra las estrategias de juego disponibles en el registry.
   */
  private registerGameStrategies(): void {
    const { TriviaGameStrategy } = require('../../domain/games/builtin/TriviaGame');
    const { ReactionGameStrategy } = require('../../domain/games/builtin/ReactionGame');
    const { MathGameStrategy } = require('../../domain/games/builtin/MathGame');
    const { WordPuzzleGameStrategy } = require('../../domain/games/builtin/WordPuzzleGame');
    const { DiceGameStrategy } = require('../../domain/games/builtin/DiceGame');
    const { SpinWheelGameStrategy } = require('../../domain/games/builtin/SpinWheelGame');
    const { GuessingGameStrategy } = require('../../domain/games/builtin/GuessingGame');
    const { EliminationGameStrategy } = require('../../domain/games/builtin/EliminationGame');

    gameRegistry.register(new TriviaGameStrategy());
    gameRegistry.register(new ReactionGameStrategy());
    gameRegistry.register(new MathGameStrategy());
    gameRegistry.register(new WordPuzzleGameStrategy());
    gameRegistry.register(new DiceGameStrategy());
    gameRegistry.register(new SpinWheelGameStrategy());
    gameRegistry.register(new GuessingGameStrategy());
    gameRegistry.register(new EliminationGameStrategy());

    SystemLogger.info('Game strategies registered', {
      available: gameRegistry.getAll().map(s => s.gameType),
    });
  }

  /**
   * Inicia un nuevo juego en el guild.
   *
   * @param ctx - Contexto del comando
   * @param gameTypeInput - Tipo de juego (string, puede ser alias)
   * @throws GameError si ya hay un juego activo o el tipo es inválido
   */
  async startGame(ctx: CommandContext, gameTypeInput: string): Promise<void> {
    const guildId = ctx.guildId;
    const userId = ctx.userId;

    // 1. Validar que NO hay juego activo en ese guild
    if (this.activeGames.has(guildId)) {
      throw new GameError(
        'Ya hay un juego activo en este servidor',
        ERROR_CODES.GAME_ALREADY_STARTED
      );
    }

    // 2. Parsear el tipo de juego
    const gameType = this.parseGameType(gameTypeInput);
    if (!gameType) {
      throw new GameError(
        `Tipo de juego desconocido: "${gameTypeInput}"`,
        ERROR_CODES.QUERY_FAILED
      );
    }

    // 3. Verificar que el tipo de juego está disponible
    if (!this.gameFactory.isAvailable(gameType)) {
      throw new GameError(`El juego "${gameType}" no está disponible`, ERROR_CODES.QUERY_FAILED);
    }

    // 4. Obtener canal como TextChannel
    const channel = await this.getChannel(ctx);
    if (!channel) {
      throw new GameError('No se pudo obtener el canal', ERROR_CODES.QUERY_FAILED);
    }

    // 5. Obtener guild
    const guild = channel.guild;
    const username = ctx.message.author.username;

    // 6. Crear instancia del juego
    const game = this.gameFactory.create(gameType, channel, guild, username);
    if (!game) {
      throw new GameError(`No se pudo crear el juego "${gameType}"`, ERROR_CODES.QUERY_FAILED);
    }

    // 7. Registrar el juego activo
    const gameWithCleanup = game as BaseGameWithCleanup;
    this.activeGames.set(guildId, gameWithCleanup);

    // 8. Registrar listener para cleanup cuando termine el juego
    this.registerGameEndListener(guildId, gameWithCleanup);

    // 9. Ejecutar el juego en background (no await)
    // run() es async pero lo lanzamos sin esperar para que el comando responda rápido
    game.run().catch(error => {
      SystemLogger.error('Game run() threw unexpectedly', {
        sessionId: game['sessionId'],
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // 10. Responder con mensaje de confirmación
    const strategy = gameRegistry.get(gameType);
    if (strategy) {
      await ctx.reply({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeds: [
          EmbedFactory.gameAnnounce({
            gameType,
            gameName: strategy.gameName,
            prize: strategy.prizeName,
            startedBy: username,
            maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
            lobbyWaitSeconds: GAME_CONSTANTS.LOBBY_WAIT_SECONDS,
          }) as any,
        ],
      });
    }

    // 11. Loguear en audit
    auditLogger.logGameStarted(userId, gameType, game['sessionId']);

    SystemLogger.info('Game started via orchestrator', {
      guildId,
      gameType,
      startedBy: userId,
    });
  }

  /**
   * Agrega un jugador al juego activo del guild.
   *
   * @param ctx - Contexto del comando
   * @throws GameError si no hay juego activo
   */
  async joinGame(ctx: CommandContext): Promise<void> {
    const guildId = ctx.guildId;
    const discordId = ctx.discordId;
    const userId = ctx.userId;
    const username = ctx.message.author.username;

    // 1. Obtener juego activo
    const game = this.activeGames.get(guildId);
    if (!game) {
      throw new GameError(
        'No hay ningún juego activo en este momento',
        ERROR_CODES.NO_ACTIVE_SESSION
      );
    }

    // 2. Agregar participante al juego
    await game.addParticipant(userId, discordId, username);

    // 3. Responder confirmación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.success(`<@${discordId}> te uniste al juego!`) as any],
    });

    SystemLogger.info('Player joined via orchestrator', {
      guildId,
      userId,
      discordId,
    });
  }

  /**
   * Maneja la respuesta de un jugador.
   *
   * @param ctx - Contexto del comando
   * @param answer - Respuesta del jugador
   * @throws GameError si no hay juego activo
   */
  async handlePlay(ctx: CommandContext, answer: string): Promise<void> {
    const guildId = ctx.guildId;

    // 1. Obtener juego activo
    const game = this.activeGames.get(guildId);
    if (!game) {
      throw new GameError(
        'No hay ningún juego activo en este momento',
        ERROR_CODES.NO_ACTIVE_SESSION
      );
    }

    // 2. Obtener sesión actual
    const session = await game.getSession();
    if (!session) {
      throw new GameError('No se pudo obtener la sesión del juego', ERROR_CODES.NO_ACTIVE_SESSION);
    }

    // 3. Verificar que el juego está activo
    if (session.status !== 'active') {
      throw new GameError('El juego no está activo actualmente', ERROR_CODES.NOT_IN_SESSION);
    }

    // 4. Indicar quién está respondiendo (para que TriviaGame sepa quién ganó la ronda)
    game.setAnsweringUser(ctx.discordId);

    // 5. Resolver la respuesta (esto completa el waitForAnswer del juego)
    game.resolveAnswer(answer);

    // 5. Responder confirmación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.info(`Respuesta registrada: "${answer}"`) as any],
    });

    SystemLogger.debug('Answer handled via orchestrator', {
      guildId,
      userId: ctx.userId,
      answerLength: answer.length,
    });
  }

  /**
   * Cancela el juego activo en un guild.
   *
   * @param guildId - ID del guild
   */
  async cancelGame(guildId: string): Promise<void> {
    const game = this.activeGames.get(guildId);
    if (!game) {
      return; // No hay juego que cancelar
    }

    try {
      await game.cancel();
      this.cleanupGame(guildId);

      SystemLogger.info('Game cancelled via orchestrator', { guildId });
    } catch (error) {
      SystemLogger.error('Failed to cancel game', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene el juego activo de un guild.
   *
   * @param guildId - ID del guild
   * @returns El juego activo o undefined si no hay
   */
  getActiveSession(guildId: string): BaseGame | undefined {
    return this.activeGames.get(guildId);
  }

  // ==========================================================================
  // MÉTODOS PRIVADOS
  // ==========================================================================

  /**
   * Parsea el input del usuario a GameType.
   */
  private parseGameType(input: string): GameType | null {
    const normalized = input.toLowerCase().trim();
    return GAME_TYPE_ALIASES[normalized] ?? null;
  }

  /**
   * Obtiene el canal de texto desde el contexto.
   */
  private async getChannel(ctx: CommandContext): Promise<TextChannel | null> {
    try {
      const channel = await ctx.message.channel;
      if (channel && 'send' in channel) {
        return channel as TextChannel;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Registra un listener para cleanup cuando termina el juego.
   */
  private registerGameEndListener(guildId: string, game: BaseGameWithCleanup): void {
    const sessionId = game['sessionId'];

    // Escuchar evento de fin de juego
    const globalEmitter = this.scopedEventEmitter.global();
    const endHandler = () => {
      SystemLogger.info('Game end event received by orchestrator', {
        guildId,
        sessionId,
      });
      this.cleanupGame(guildId);
    };

    // Usar once para que se desregistre automáticamente
    globalEmitter.once(GAME_EVENTS.GAME_END, endHandler);

    // También cleanup si pasa mucho tiempo (fallback)
    const timeoutId = setTimeout(
      () => {
        if (this.activeGames.has(guildId)) {
          SystemLogger.warn('Game cleanup timeout triggered', {
            guildId,
            sessionId,
          });
          this.cleanupGame(guildId);
        }
      },
      30 * 60 * 1000
    ); // 30 minutos max

    // Guardar referencia para cleanup
    game.cleanupTimeoutId = timeoutId;
  }

  /**
   * Limpia los recursos de un juego terminado.
   */
  private cleanupGame(guildId: string): void {
    const game = this.activeGames.get(guildId);
    if (!game) {
      return;
    }

    // Limpiar timeout si existe
    if (game.cleanupTimeoutId) {
      clearTimeout(game.cleanupTimeoutId);
    }

    // Limpiar live messages
    this.liveMessageManager.cleanup(game['sessionId']);

    // Destruir emitter de sesión
    this.scopedEventEmitter.destroySession(game['sessionId']);

    // Remover de juegos activos
    this.activeGames.delete(guildId);

    SystemLogger.debug('Game resources cleaned up', {
      guildId,
      sessionId: game['sessionId'],
    });
  }
}
