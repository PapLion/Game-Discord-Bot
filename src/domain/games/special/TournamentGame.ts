import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
import { BaseGame } from '../base/BaseGame';
import { GameStrategy } from '../base/GameStrategy';
import { Participant } from '../../../types/game.types';
import { GAME_CONSTANTS } from '../../../types/GAME_CONSTANTS';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';
import { GAME_EVENTS } from '../../../infrastructure/events/ScopedEventEmitter';

interface BracketMatch {
  player1: Participant;
  player2: Participant;
  winner?: Participant;
  round: number;
}

export class TournamentGameStrategy implements GameStrategy {
  readonly gameType: 'tournament' = 'tournament';
  readonly gameName: string = 'Tournament';
  readonly totalRounds: number = 3;
  readonly prizeName: string = '500 Coins + Event Crown';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use TournamentGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class TournamentGame extends BaseGame {
  private eliminatedPlayers: Set<string> = new Set();
  private questions: Array<{ q: string; a: string }> = [];
  private correctAnswer: string | null = null;
  private readonly POINTS_PER_CORRECT = 10;
  private readonly TOURNAMENT_MIN = GAME_CONSTANTS.TOURNAMENT_MIN_PLAYERS;
  private readonly TOURNAMENT_MAX = GAME_CONSTANTS.TOURNAMENT_MAX_PLAYERS;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new TournamentGameStrategy();
    super(
      strategy,
      channel,
      guild,
      startedBy,
      liveMessageManager,
      eventEmitter,
      db,
      guildConfigService
    );

    this.questions = this.generateTournamentQuestions();

    SystemLogger.info('TournamentGame initialized', {
      sessionId: this.sessionId,
      minPlayers: this.TOURNAMENT_MIN,
      maxPlayers: this.TOURNAMENT_MAX,
    });
  }

  protected override async waitForPlayers(): Promise<boolean> {
    try {
      const config = this.guildConfigService.getOrCreate(this.guild.id);
      const lobbyWaitSeconds = config.lobbyWaitSeconds ?? GAME_CONSTANTS.LOBBY_WAIT_SECONDS;

      const sessionEmitter = this.eventEmitter.forSession(this.sessionId);
      const joinHandler = async (payload: unknown) => {
        const p = payload as { userId: string; discordId: string; sessionId: string };
        if (p.sessionId === this.sessionId) {
          await this.addParticipant(p.userId, p.discordId, '');
        }
      };
      sessionEmitter.on(GAME_EVENTS.PLAYER_JOINED, joinHandler);

      let countdown = lobbyWaitSeconds;
      const countdownPromise = new Promise<void>(resolve => {
        this.countdownInterval = setInterval(async () => {
          countdown--;

          if (countdown % 5 === 0 || countdown <= 5) {
            await this.refreshTournamentLobby(countdown);
          }

          if (countdown <= 0) {
            this.cleanupCountdownInterval();
            resolve();
          }
        }, 1000);
      });

      await countdownPromise;

      sessionEmitter.off(GAME_EVENTS.PLAYER_JOINED, joinHandler);

      if (this.participants.size < this.TOURNAMENT_MIN) {
        await this.sendTournamentMessage(
          EmbedFactory.error(
            `Se necesitan al menos ${this.TOURNAMENT_MIN} jugadores para el torneo.`,
            'Usa !start tournament para intentar de nuevo'
          )
        );
        await this.cancel();
        return false;
      }

      if (this.participants.size > this.TOURNAMENT_MAX) {
        const trimmed = Array.from(this.participants.values()).slice(0, this.TOURNAMENT_MAX);
        this.participants.clear();
        for (const p of trimmed) {
          this.participants.set(p.userId, p);
        }
      }

      this.db.execute("UPDATE game_sessions SET status = 'active' WHERE id = ?", [this.sessionId]);
      this.status = 'active';

      SystemLogger.info('Tournament starting with players', {
        sessionId: this.sessionId,
        playerCount: this.participants.size,
      });

      return true;
    } catch (error) {
      SystemLogger.error('TournamentGame.waitForPlayers failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.cancel();
      return false;
    }
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      const remaining = this.getActiveParticipants();
      if (remaining.length < 2) {
        SystemLogger.info('Tournament ended with less than 2 players', {
          sessionId: this.sessionId,
          remaining: remaining.length,
        });
        return;
      }

      const numMatches = Math.floor(remaining.length / 2);

      for (let i = 0; i < numMatches; i++) {
        const player1 = remaining[i * 2];
        const player2 = remaining[i * 2 + 1];
        if (!player1 || !player2) continue;

        await this.playMatch(player1, player2, round);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('TournamentGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  private async playMatch(
    player1: Participant,
    player2: Participant,
    round: number
  ): Promise<Participant | null> {
    await this.sendTournamentMessage(
      EmbedFactory.roundStart({
        roundNumber: round,
        totalRounds: this.strategy.totalRounds,
        question: `⚔️ DUELO: <@${player1.discordId}> vs <@${player2.discordId}>`,
        timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
      })
    );

    const questionIndex = (round - 1) % this.questions.length;
    const question = this.questions[questionIndex];
    this.correctAnswer = question.a.toLowerCase().trim();

    await this.sendTournamentMessage(
      EmbedFactory.roundStart({
        roundNumber: round,
        totalRounds: this.strategy.totalRounds,
        question: question.q,
        timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
      })
    );

    const answer = await this.waitForAnswer();
    const answeringDiscordId = this.getAnsweringDiscordId();

    let winner: Participant | null = null;

    if (answer !== null && answeringDiscordId !== null) {
      const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

      if (isCorrect) {
        if (answeringDiscordId === player1.discordId) {
          winner = player1;
          await this.updateScore(player1.userId, this.POINTS_PER_CORRECT);
        } else if (answeringDiscordId === player2.discordId) {
          winner = player2;
          await this.updateScore(player2.userId, this.POINTS_PER_CORRECT);
        }
      }
    }

    if (!winner) {
      winner = Math.random() > 0.5 ? player1 : player2;
    }

    this.eliminatedPlayers.add(winner.userId === player1.userId ? player2.userId : player1.userId);

    const winnerMention = `<@${winner.discordId}>`;
    const loserDiscordId = winner.userId === player1.userId ? player2.discordId : player1.discordId;
    const loserMention = `<@${loserDiscordId}>`;

    await this.sendTournamentMessage(
      EmbedFactory.roundResult({
        correct: true,
        winnerMention: `⚔️ ${winnerMention} GANA el duelo! ${loserMention} eliminado.`,
        answer: this.correctAnswer,
        points: this.POINTS_PER_CORRECT,
        scores: this.getScoreboard(),
      })
    );

    SystemLogger.info('Tournament match completed', {
      sessionId: this.sessionId,
      winnerId: winner.userId,
      loserId: winner.userId === player1.userId ? player2.userId : player1.userId,
    });

    return winner;
  }

  protected override evaluateWinner(): Participant | null {
    const activeParticipants = this.getActiveParticipants();

    if (activeParticipants.length === 0) {
      return null;
    }

    if (activeParticipants.length === 1) {
      const winner = activeParticipants[0];
      winner.isWinner = true;
      SystemLogger.info('Tournament winner determined', {
        sessionId: this.sessionId,
        winnerDiscordId: winner.discordId,
        score: winner.score,
      });
      return winner;
    }

    const sorted = [...this.participants.values()].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) return null;

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
    }

    return winner ?? null;
  }

  private getActiveParticipants(): Participant[] {
    return Array.from(this.participants.values()).filter(
      p => !this.eliminatedPlayers.has(p.userId)
    );
  }

  private generateTournamentQuestions(): Array<{ q: string; a: string }> {
    return [
      { q: '¿Capital de Japón?', a: 'tokio' },
      { q: '¿Cuántos bits tiene un byte?', a: '8' },
      { q: '¿Color del cielo?', a: 'azul' },
      { q: '¿Animal que ladra?', a: 'perro' },
      { q: '¿Resultado de 7x8?', a: '56' },
      { q: '¿Continente más grande?', a: 'asia' },
      { q: '¿Gas que respiramos?', a: 'oxigeno' },
      { q: '¿Forma de la Tierra?', a: 'esfera' },
    ];
  }

  private getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .filter(p => !this.eliminatedPlayers.has(p.userId))
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private async refreshTournamentLobby(countdown: number): Promise<void> {
    try {
      const players = this.getActiveParticipants().map(p => ({
        mention: `<@${p.discordId}>`,
      }));

      await this.liveMessageManager.updateLobby(this.sessionId, {
        gameType: this.strategy.gameType,
        gameName: `${this.strategy.gameName} (${this.getActiveParticipants().length}/${this.participants.size})`,
        players,
        totalPlayers: this.participants.size,
        maxPlayers: this.TOURNAMENT_MAX,
        countdown,
      });
    } catch (error) {
      SystemLogger.error('Failed to update tournament lobby embed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendTournamentMessage(embed: EmbedBuilder): Promise<Message> {
    return this.channel.send({
      embeds: [embed as any] as Parameters<typeof this.channel.send>[0] extends { embeds?: infer E }
        ? { embeds: E }
        : never,
    });
  }

  private cleanupCountdownInterval(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
