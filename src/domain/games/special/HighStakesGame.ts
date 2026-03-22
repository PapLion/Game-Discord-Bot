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
import { GameError, ERROR_CODES } from '../../../types/errors';
import { UserRepository } from '../../../infrastructure/database/UserRepository';

const HIGHSTAKES_QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  { q: '¿Capital de Francia?', a: 'parís' },
  { q: '¿Cuántos continentes hay?', a: '7' },
  { q: '¿Color que se mezcla con azul?', a: 'amarillo' },
  { q: '¿En qué año llegó el hombre a la luna?', a: '1969' },
  { q: '¿Río más largo del mundo?', a: 'amazonas' },
  { q: '¿Cuántos planetas tiene el sistema solar?', a: '8' },
  { q: '¿Rey de la selva?', a: 'león' },
  { q: '¿País de la Torre Eiffel?', a: 'francia' },
  { q: '¿Idioma con más hablantes?', a: 'mandarín' },
  { q: '¿Océano más grande?', a: 'pacífico' },
];

export class HighStakesGameStrategy implements GameStrategy {
  readonly gameType: 'highstakes' = 'highstakes';
  readonly gameName: string = 'High Stakes';
  readonly totalRounds: number = 5;
  readonly prizeName: string = 'Pozo total de coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use HighStakesGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class HighStakesGame extends BaseGame {
  private questions: Array<{ q: string; a: string }> = [];
  private correctAnswer: string | null = null;
  private readonly MIN_BET = GAME_CONSTANTS.HIGHSTAKES_MIN_BET;
  private readonly POINTS_PER_CORRECT = 10;
  private playerBets: Map<string, number> = new Map();
  private totalPot: number = 0;
  private userRepository: UserRepository;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new HighStakesGameStrategy();
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

    this.questions = this.shuffleQuestions([...HIGHSTAKES_QUESTIONS]);
    this.userRepository = new UserRepository(db);

    SystemLogger.info('HighStakesGame initialized', {
      sessionId: this.sessionId,
      minBet: this.MIN_BET,
    });
  }

  private shuffleQuestions(
    questions: Array<{ q: string; a: string }>
  ): Array<{ q: string; a: string }> {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  public async addParticipantWithBet(
    userId: string,
    discordId: string,
    username: string,
    betAmount: number
  ): Promise<void> {
    const user = await this.userRepository.findByDiscordId(discordId, this.guild.id);

    if (!user || user.coins < betAmount) {
      throw new GameError(
        `No tienes suficientes coins. Necesitas al menos ${betAmount} coins.`,
        ERROR_CODES.QUERY_FAILED
      );
    }

    if (betAmount < this.MIN_BET) {
      throw new GameError(`La apuesta mínima es ${this.MIN_BET} coins.`, ERROR_CODES.QUERY_FAILED);
    }

    await this.userRepository.updateCoins(userId, -betAmount);
    this.playerBets.set(userId, betAmount);
    this.totalPot += betAmount;

    await super.addParticipant(userId, discordId, username);

    SystemLogger.info('HighStakes bet placed', {
      sessionId: this.sessionId,
      userId,
      betAmount,
      totalPot: this.totalPot,
    });
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      const question = this.questions[round - 1];
      if (!question) {
        SystemLogger.warn('No question for round', { sessionId: this.sessionId, round });
        return;
      }

      this.correctAnswer = question.a.toLowerCase().trim();

      await this.sendHighStakesMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `💎 ${question.q}`,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const answer = await this.waitForAnswer();
      const answeringDiscordId = this.getAnsweringDiscordId();

      if (answer !== null && this.correctAnswer !== null) {
        const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

        if (isCorrect && answeringDiscordId !== null) {
          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, this.POINTS_PER_CORRECT);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendHighStakesMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: this.correctAnswer,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('HighStakes correct answer', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              userId: participant.userId,
            });
          }
        } else {
          await this.sendHighStakesMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: this.correctAnswer,
              scores: this.getScoreboard(),
            })
          );
        }
      } else {
        await this.sendHighStakesMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.correctAnswer ?? 'Sin respuesta',
            scores: this.getScoreboard(),
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('HighStakesGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  protected override async end(): Promise<void> {
    try {
      const winner = this.evaluateWinner();

      if (winner) {
        await this.userRepository.updateCoins(winner.userId, this.totalPot);

        winner.isWinner = true;
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );
        this.status = 'finished';

        const winnerMention = `<@${winner.discordId}>`;
        const rankings = this.getHighStakesRankings();

        await this.sendHighStakesMessage(
          EmbedFactory.gameEnd({
            gameName: this.strategy.gameName,
            winnerMention: `${winnerMention} ¡Gana el pozo de ${this.totalPot} coins!`,
            finalScore: winner.score,
            rankings,
            prizeName: `${this.totalPot} Coins 💎`,
          })
        );

        SystemLogger.info('HighStakes game ended with winner', {
          sessionId: this.sessionId,
          winnerUserId: winner.userId,
          wonPot: this.totalPot,
        });
      } else {
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );
        this.status = 'finished';

        await this.sendHighStakesMessage(
          EmbedFactory.info('El juego terminó sin ganador. Las apuestas no fueron devueltas.')
        );
      }

      this.cleanupGameResources();
    } catch (error) {
      SystemLogger.error('HighStakesGame.end failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) return null;

    const winner = sorted[0];
    return winner ?? null;
  }

  getTotalPot(): number {
    return this.totalPot;
  }

  private getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private getHighStakesRankings(): Array<{ mention: string; score: number; position: number }> {
    const sorted = Array.from(this.participants.values()).sort((a, b) => b.score - a.score);
    return sorted.map((p, index) => ({
      mention: `<@${p.discordId}>`,
      score: p.score,
      position: index + 1,
    }));
  }

  private findParticipantByDiscordId(discordId: string): Participant | undefined {
    return this.getParticipants().find(p => p.discordId === discordId);
  }

  private async sendHighStakesMessage(embed: EmbedBuilder): Promise<Message> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.channel.send({ embeds: [embed as any] });
  }

  private cleanupGameResources(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.liveMessageManager.cleanup(this.sessionId);
    this.eventEmitter.destroySession(this.sessionId);
    this.answerResolver = null;
  }
}
