import { TextChannel, Guild, Message, MessageReplyOptions, APIEmbed } from 'discord.js';
import { EventEmitter } from 'events';
import { GameStrategy } from './GameStrategy';
import { GameSession, Participant, GameStatus } from '../../../types/game.types';
import { GameError, ERROR_CODES } from '../../../types/errors';
import { GAME_CONSTANTS } from '../../../types/GAME_CONSTANTS';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import {
  ScopedEventEmitter,
  GAME_EVENTS,
  PlayerJoinedPayload,
} from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { GuildConfig } from '../../../infrastructure/database/GuildConfigService';
import { PendingPrizeService } from './PendingPrizeService';
import { scoreService } from '../../systems/ScoreService';
import { randomUUID } from 'crypto';

/**
 * Extensión mínima de EventEmitter para los métodos que necesitamos.
 * ScopedEventEmitter.forSession() retorna un EventEmitter pero TypeScript
 * tiene problemas reconociendo los métodos de instancia.
 */
interface TypedEventEmitter {
  emit(event: string | symbol, ...args: unknown[]): boolean;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  off(event: string | symbol, listener: (...args: unknown[]) => void): this;
}

/**
 * Interfaz interna para registrar sesiones en la DB
 */
interface GameSessionRow {
  id: string;
  guild_id: string;
  channel_id: string;
  game_type: string;
  status: GameStatus;
  started_by: string;
  created_at: string;
  ended_at: string | null;
}

// UserRow removed — BaseGame.addParticipant() no longer queries users table
// User management (create/lookup) is handled by UserRepository in GameOrchestrator

/**
 * Valor placeholder para prize cuando aún no está definido en la BD.
 * Se configura en R-E (Resolver-Entrega).
 */
const DEFAULT_PRIZE_TYPE = 'coins';
const DEFAULT_PRIZE_VALUE = '100';

/**
 * BaseGame — Clase abstracta que define el ciclo de vida completo de un juego.
 *
 * EL CICLO ES FIJO: announce() → waitForPlayers() → playRounds() → end()
 *
 * Las subclases SOLO implementan:
 * - roundLogic(): lógica específica de cada ronda (mostrar pregunta, esperar respuesta)
 * - evaluateWinner(): determina el ganador basado en scores
 *
 * CRÍTICO — Regla G-O (Resolver-Gaps):
 * - roundLogic() NUNCA crea pending_prizes
 * - end() es el ÚNICO punto de entrega de premio
 */
export abstract class BaseGame {
  // ==========================================================================
  // PROPIEDADES PROTEGIDAS
  // ==========================================================================

  protected readonly sessionId: string;
  protected participants: Map<string, Participant> = new Map();
  protected currentRound: number = 0;
  protected sessionMessage: Message | null = null;
  protected countdownInterval: ReturnType<typeof setInterval> | null = null;
  protected answerResolver: ((answer: string) => void) | null = null;
  protected answerDiscordId: string | null = null;
  protected status: GameStatus = 'waiting';

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor(
    protected readonly strategy: GameStrategy,
    protected readonly channel: TextChannel,
    protected readonly guild: Guild,
    protected readonly startedBy: string,
    protected readonly liveMessageManager: LiveMessageManager,
    protected readonly eventEmitter: ScopedEventEmitter,
    protected readonly db: DatabaseService,
    protected readonly guildConfigService: GuildConfigService
  ) {
    // Generar UUID único para la sesión
    this.sessionId = randomUUID();
  }

  // ==========================================================================
  // MÉTODOS PÚBLICOS
  // ==========================================================================

  /**
   * Ejecuta el ciclo completo del juego.
   * Este método es FIJO — no modificar.
   *
   * Flujo: announce() → waitForPlayers() → playRounds() → end()
   */
  public async run(): Promise<void> {
    try {
      // 1. Anunciar el juego
      await this.announce();

      // 2. Esperar jugadores
      const hasEnoughPlayers = await this.waitForPlayers();
      if (!hasEnoughPlayers) {
        return; // Se canceló por falta de jugadores
      }

      // 3. Jugar las rondas
      await this.playRounds();

      // 4. Terminar el juego (ÚNICO punto de entrega de premio)
      await this.end();
    } catch (error) {
      await this.handleRunError(error);
    }
  }

  /**
   * Obtiene la sesión actual del juego.
   */
  public async getSession(): Promise<GameSession | null> {
    try {
      const row = this.db.runOne<GameSessionRow>('SELECT * FROM game_sessions WHERE id = ?', [
        this.sessionId,
      ]);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        guildId: row.guild_id,
        channelId: row.channel_id,
        gameType: row.game_type as GameSession['gameType'],
        status: row.status,
        startedBy: row.started_by,
        createdAt: new Date(row.created_at),
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      };
    } catch (error) {
      SystemLogger.error('BaseGame.getSession failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cancela el juego limpiamente.
   */
  public async cancel(): Promise<void> {
    try {
      // Limpiar el countdown interval
      this.cleanupCountdown();

      // Actualizar status en DB
      this.db.execute(
        "UPDATE game_sessions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        [this.sessionId]
      );

      this.status = 'cancelled';

      // Limpiar live message
      await this.liveMessageManager.cleanup(this.sessionId);

      // Destruir el event emitter de esta sesión
      this.eventEmitter.destroySession(this.sessionId);

      // Emitir evento de fin
      (this.eventEmitter.global() as unknown as TypedEventEmitter).emit(GAME_EVENTS.GAME_END, {
        sessionId: this.sessionId,
        gameType: this.strategy.gameType,
        participantCount: this.participants.size,
      });

      // Loguear cancelación
      auditLogger.logGameCancelled('Cancelled by system', this.sessionId);

      SystemLogger.info('Game cancelled', {
        sessionId: this.sessionId,
        gameType: this.strategy.gameType,
      });
    } catch (error) {
      SystemLogger.error('BaseGame.cancel failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retorna la lista de participantes.
   */
  public getParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Retorna el estado actual del juego.
   */
  public getStatus(): GameStatus {
    return this.status;
  }

  // ==========================================================================
  // MÉTODOS PROTEGIDOS ABSTRACTOS (override en subclases)
  // ==========================================================================

  /**
   * Lógica específica de cada ronda.
   * Las subclases implementan según el tipo de juego:
   * - Mostrar pregunta
   * - Esperar respuesta de los jugadores
   * - Evaluar respuesta correcta
   *
   * IMPORTANTE: NUNCA crea pending_prizes aquí.
   * La entrega de premio se hace ÚNICAMENTE en end().
   *
   * @param round - Número de ronda (1-indexed)
   */
  protected abstract roundLogic(round: number): Promise<void>;

  /**
   * Determina el ganador basado en los scores finales.
   * @returns El Participant ganador o null si hay empate
   */
  protected abstract evaluateWinner(): Participant | null;

  // ==========================================================================
  // MÉTODOS PROTEGIDOS (implementación en BaseGame)
  // ==========================================================================

  /**
   * Anuncia el juego y crea la sesión en DB.
   */
  protected async announce(): Promise<void> {
    try {
      // Obtener config del guild
      const config: GuildConfig = this.guildConfigService.getOrCreate(this.guild.id);

      const lobbyWaitSeconds = config.lobbyWaitSeconds ?? GAME_CONSTANTS.LOBBY_WAIT_SECONDS;
      const maxPlayers = config.maxPlayersPerGame ?? GAME_CONSTANTS.MAX_PLAYERS;

      // Crear embed de anuncio
      const announceEmbed = EmbedFactory.gameAnnounce({
        gameType: this.strategy.gameType,
        gameName: this.strategy.gameName,
        prize: this.strategy.prizeName,
        startedBy: this.startedBy,
        maxPlayers,
        lobbyWaitSeconds,
      });

      // Enviar mensaje al canal
      const message = await this.sendWithEmbeds({ embeds: [announceEmbed] });
      this.sessionMessage = message;

      // Guardar en live message manager
      this.liveMessageManager.setLobbyMessage(this.sessionId, message);

      // Crear sesión en DB
      this.db.execute(
        `INSERT INTO game_sessions 
          (id, guild_id, channel_id, game_type, status, started_by, created_at)
         VALUES (?, ?, ?, ?, 'waiting', ?, CURRENT_TIMESTAMP)`,
        [this.sessionId, this.guild.id, this.channel.id, this.strategy.gameType, this.startedBy]
      );

      this.status = 'waiting';

      // Emitir evento de inicio
      (this.eventEmitter.forSession(this.sessionId) as unknown as TypedEventEmitter).emit(
        GAME_EVENTS.GAME_START,
        {
          sessionId: this.sessionId,
          gameType: this.strategy.gameType,
          participantCount: 0,
          totalRounds: this.strategy.totalRounds,
        }
      );

      SystemLogger.info('Game announced', {
        sessionId: this.sessionId,
        gameType: this.strategy.gameType,
        lobbyWaitSeconds,
      });
    } catch (error) {
      SystemLogger.error('BaseGame.announce failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new GameError('Failed to announce game', ERROR_CODES.GAME_ALREADY_STARTED);
    }
  }

  /**
   * Espera a que se unan jugadores durante el lobby.
   * @returns true si hay suficientes jugadores, false si se canceló
   */
  protected async waitForPlayers(): Promise<boolean> {
    try {
      const config: GuildConfig = this.guildConfigService.getOrCreate(this.guild.id);

      const lobbyWaitSeconds = config.lobbyWaitSeconds ?? GAME_CONSTANTS.LOBBY_WAIT_SECONDS;
      const maxPlayers = config.maxPlayersPerGame ?? GAME_CONSTANTS.MAX_PLAYERS;
      const minPlayers = config.minPlayersPerGame ?? GAME_CONSTANTS.MIN_PLAYERS;

      // Setup del listener para !join
      const sessionEmitter = this.eventEmitter.forSession(
        this.sessionId
      ) as unknown as TypedEventEmitter;
      const joinHandler = async (payload: unknown) => {
        const typedPayload = payload as PlayerJoinedPayload;
        if (typedPayload.sessionId === this.sessionId) {
          await this.addParticipant(typedPayload.userId, typedPayload.discordId, '');
        }
      };
      sessionEmitter.on(GAME_EVENTS.PLAYER_JOINED, joinHandler);

      // Countdown
      let countdown = lobbyWaitSeconds;
      const countdownPromise = new Promise<void>(resolve => {
        this.countdownInterval = setInterval(async () => {
          countdown--;

          // Actualizar embed cada 5 segundos
          if (countdown % 5 === 0 || countdown <= 5) {
            await this.updateLobbyEmbed(maxPlayers, countdown);
          }

          if (countdown <= 0) {
            this.cleanupCountdown();
            resolve();
          }
        }, 1000);
      });

      // Esperar a que termine el countdown
      await countdownPromise;

      // Cleanup del listener
      sessionEmitter.off(GAME_EVENTS.PLAYER_JOINED, joinHandler);

      // Verificar si hay suficientes jugadores
      if (this.participants.size < minPlayers) {
        await this.sendWithEmbeds({
          embeds: [
            EmbedFactory.error(
              `No hay suficientes jugadores. Se necesitan al menos ${minPlayers}.`,
              'Usa !start para intentar de nuevo'
            ),
          ],
        });

        // Cancelar el juego
        await this.cancel();
        return false;
      }

      // Suficientes jugadores — actualizar status a 'active'
      this.db.execute("UPDATE game_sessions SET status = 'active' WHERE id = ?", [this.sessionId]);
      this.status = 'active';

      SystemLogger.info('Game starting with players', {
        sessionId: this.sessionId,
        playerCount: this.participants.size,
      });

      return true;
    } catch (error) {
      SystemLogger.error('BaseGame.waitForPlayers failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.cancel();
      return false;
    }
  }

  /**
   * Ejecuta todas las rondas del juego.
   * Cada subclase define roundLogic() para enviar su propio mensaje de ronda.
   * roundLogic() es el ÚNICO que envía mensajes de ronda.
   */
  protected async playRounds(): Promise<void> {
    try {
      const totalRounds = this.strategy.totalRounds;

      for (let round = 1; round <= totalRounds; round++) {
        this.currentRound = round;

        // Emitir inicio de ronda para listeners externos
        (this.eventEmitter.forSession(this.sessionId) as unknown as TypedEventEmitter).emit(
          GAME_EVENTS.GAME_ROUND,
          {
            sessionId: this.sessionId,
            round,
            totalRounds,
          }
        );

        // Ejecutar lógica de la ronda (override de subclase)
        // Cada subclase envía su propio mensaje de ronda en roundLogic()
        // IMPORTANTE: roundLogic NO crea pending_prizes
        await this.roundLogic(round);
      }
    } catch (error) {
      SystemLogger.error('BaseGame.playRounds failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new GameError('Failed to play rounds', ERROR_CODES.QUERY_FAILED);
    }
  }

  /**
   * Termina el juego y entrega el premio al ganador.
   *
   * CRÍTICO: Este es el ÚNICO punto donde se crea pending_prize.
   *
   * La Regla G-O establece:
   * - "Premio se entrega UNA VEZ por sesión completa — no por ronda."
   * - "BaseGame.end() es el ÚNICO punto de entrega de premio."
   *
   * roundLogic() NUNCA debe crear pending_prizes.
   */
  protected async end(): Promise<void> {
    try {
      // Evaluar ganador (implementación de subclase)
      const winner = this.evaluateWinner();

      // Rankings
      const rankings = this.getRankings();

      if (winner) {
        // === ÚNICO PUNTO DE CREACIÓN DE PENDING_PRIZE ===
        // Crear el registro de premio pendiente
        const pendingPrizeId = await PendingPrizeService.createPending(
          this.db,
          winner.userId,
          this.sessionId,
          DEFAULT_PRIZE_TYPE,
          DEFAULT_PRIZE_VALUE
        );

        // Registrar al ganador en game_winners via ScoreService
        await scoreService.updateAfterGame({
          sessionId: this.sessionId,
          winnerId: winner.userId,
          guildId: this.guild.id,
          gameType: this.strategy.gameType,
          score: winner.score,
        });

        // Actualizar status en DB
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );

        this.status = 'finished';

        // Enviar embed de fin con ganador
        const winnerMention = `<@${winner.discordId}>`;
        await this.sendWithEmbeds({
          embeds: [
            EmbedFactory.gameEnd({
              gameName: this.strategy.gameName,
              winnerMention,
              finalScore: winner.score,
              rankings,
              prizeName: this.strategy.prizeName,
            }),
          ],
        });

        // Emitir evento de ganador
        (this.eventEmitter.global() as unknown as TypedEventEmitter).emit(GAME_EVENTS.GAME_WINNER, {
          sessionId: this.sessionId,
          winnerId: winner.userId,
          winnerDiscordId: winner.discordId,
          prizeName: this.strategy.prizeName,
        });

        // Loguear en audit
        auditLogger.logPrizeAwarded(
          winner.userId,
          DEFAULT_PRIZE_TYPE,
          DEFAULT_PRIZE_VALUE,
          this.sessionId
        );

        SystemLogger.info('Game ended with winner', {
          sessionId: this.sessionId,
          winnerUserId: winner.userId,
          winnerDiscordId: winner.discordId,
          score: winner.score,
          pendingPrizeId,
        });
      } else {
        // No hay ganador (empate o error)
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );

        this.status = 'finished';

        await this.sendWithEmbeds({
          embeds: [EmbedFactory.info('El juego terminó sin ganador.')],
        });

        SystemLogger.info('Game ended without winner', {
          sessionId: this.sessionId,
        });
      }

      // Cleanup de recursos
      this.cleanupResources();
    } catch (error) {
      SystemLogger.error('BaseGame.end failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new GameError('Failed to end game', ERROR_CODES.QUERY_FAILED);
    }
  }

  /**
   * Agrega un participante al juego.
   * Público para que el Orchestrator pueda agregar jugadores directamente.
   *
   * El usuario debe existir en la DB (creado por UserRepository antes de llamar esto).
   * Esta función solo agrega al Map de participantes en memoria.
   */
  public async addParticipant(userId: string, discordId: string, _username: string): Promise<void> {
    try {
      // Verificar si ya existe
      if (this.participants.has(userId)) {
        return;
      }

      // Crear participant con el userId provisto
      const participant: Participant = {
        userId,
        discordId,
        score: 0,
        isWinner: false,
        joinedAt: new Date(),
      };

      this.participants.set(userId, participant);

      // Emitir evento de jugador unido
      (this.eventEmitter.forSession(this.sessionId) as unknown as TypedEventEmitter).emit(
        GAME_EVENTS.PLAYER_JOINED,
        {
          userId: participant.userId,
          discordId,
          sessionId: this.sessionId,
          participantCount: this.participants.size,
        }
      );

      SystemLogger.info('Player joined game', {
        sessionId: this.sessionId,
        userId: participant.userId,
        discordId,
        totalPlayers: this.participants.size,
      });
    } catch (error) {
      SystemLogger.error('BaseGame.addParticipant failed', {
        sessionId: this.sessionId,
        userId,
        discordId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Actualiza el score de un participante.
   */
  protected async updateScore(userId: string, points: number): Promise<void> {
    try {
      const participant = this.participants.get(userId);
      if (participant) {
        participant.score += points;

        SystemLogger.debug('Score updated', {
          sessionId: this.sessionId,
          userId,
          addedPoints: points,
          newScore: participant.score,
        });
      }
    } catch (error) {
      SystemLogger.error('BaseGame.updateScore failed', {
        sessionId: this.sessionId,
        userId,
        points,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Espera una respuesta de un jugador.
   * @param timeoutMs - Timeout en milisegundos (default: ROUND_TIMEOUT_MS)
   * @returns La respuesta o null si timeout
   */
  protected waitForAnswer(timeoutMs?: number): Promise<string | null> {
    return new Promise(resolve => {
      const timeout = timeoutMs ?? GAME_CONSTANTS.ROUND_TIMEOUT_MS;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        this.answerResolver = null;
        resolve(null);
      }, timeout);

      // Resolver con la respuesta
      this.answerResolver = (answer: string) => {
        clearTimeout(timeoutId);
        this.answerResolver = null;
        resolve(answer);
      };
    });
  }

  /**
   * Resuelve la promesa de waitForAnswer con la respuesta del jugador.
   * Público para que el Orchestrator pueda resolver respuestas.
   */
  public resolveAnswer(answer: string): void {
    if (this.answerResolver) {
      this.answerResolver(answer);
    }
  }

  /**
   * Setea el discordId del jugador que está respondiendo.
   * Llamado por PlayCommand antes de resolveAnswer.
   * Las subclases pueden acceder a this.answerDiscordId para saber quién respondió.
   */
  public setAnsweringUser(discordId: string): void {
    this.answerDiscordId = discordId;
  }

  /**
   * Obtiene el discordId del último jugador que respondió.
   */
  protected getAnsweringDiscordId(): string | null {
    return this.answerDiscordId;
  }

  // ==========================================================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ==========================================================================

  /**
   * Actualiza el embed del lobby durante la espera de jugadores.
   */
  private async updateLobbyEmbed(maxPlayers: number, countdown: number): Promise<void> {
    try {
      const players = Array.from(this.participants.values()).map(p => ({
        mention: `<@${p.discordId}>`,
      }));

      await this.liveMessageManager.updateLobby(this.sessionId, {
        gameType: this.strategy.gameType,
        gameName: this.strategy.gameName,
        players,
        totalPlayers: this.participants.size,
        maxPlayers,
        countdown,
      });
    } catch (error) {
      SystemLogger.error('Failed to update lobby embed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Limpia el countdown interval.
   */
  private cleanupCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Limpia todos los recursos del juego.
   */
  private cleanupResources(): void {
    this.cleanupCountdown();
    this.liveMessageManager.cleanup(this.sessionId);
    this.eventEmitter.destroySession(this.sessionId);
    this.answerResolver = null;
  }

  /**
   * Helper para enviar mensajes con embeds evitando problemas de tipos de discord.js.
   * El proyecto tiene incompatibilidad de tipos entre @discordjs/builders y discord-api-types.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendWithEmbeds(options: { embeds: any[] }): Promise<Message> {
    return this.channel.send(options as Parameters<typeof this.channel.send>[0]);
  }

  /**
   * Obtiene los rankings ordenados por score.
   */
  private getRankings(): Array<{ mention: string; score: number; position: number }> {
    const sorted = Array.from(this.participants.values()).sort((a, b) => b.score - a.score);

    return sorted.map((p, index) => ({
      mention: `<@${p.discordId}>`,
      score: p.score,
      position: index + 1,
    }));
  }

  /**
   * Maneja errores durante run().
   */
  private async handleRunError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    SystemLogger.error('BaseGame.run failed', {
      sessionId: this.sessionId,
      error: errorMessage,
    });

    try {
      await this.sendWithEmbeds({
        embeds: [
          EmbedFactory.error('Ocurrió un error durante el juego.', 'El juego ha sido cancelado'),
        ],
      });
    } catch {
      // No podemos hacer más si el canal no está disponible
    }

    await this.cancel();
  }
}
