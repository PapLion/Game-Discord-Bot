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
import { PendingPrizeService } from '../base/PendingPrizeService';
import { scoreService } from '../../systems/ScoreService';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';

const MIDNIGHTDROP_QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  { q: '¿Cuántas horas hay en un día?', a: '24' },
  { q: '¿A qué hora cae la medianoche?', a: '0' },
  { q: '¿Cuántos minutos tiene una hora?', a: '60' },
  { q: '¿Cuántos segundos tiene un minuto?', a: '60' },
  { q: '¿Qué ocurre a medianoche?', a: 'dia nuevo' },
];

export class MidnightDropGameStrategy implements GameStrategy {
  readonly gameType: 'midnightdrop' = 'midnightdrop';
  readonly gameName: string = 'Midnight Drop';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '1000 Coins + Legendary Token';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use MidnightDropGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class MidnightDropGame extends BaseGame {
  private questions: Array<{ q: string; a: string }> = [];
  private correctAnswer: string | null = null;
  private readonly MAX_PARTICIPANTS = GAME_CONSTANTS.MIDNIGHTDROP_MAX_PARTICIPANTS;
  private readonly POINTS_PER_CORRECT = 20;
  private playerTickets: Map<string, number> = new Map();
  private totalTickets: number = 0;
  private ticketsPerPlayer: number = 1;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new MidnightDropGameStrategy();
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

    this.questions = this.shuffleQuestions([...MIDNIGHTDROP_QUESTIONS]);

    SystemLogger.info('MidnightDropGame initialized', {
      sessionId: this.sessionId,
      maxParticipants: this.MAX_PARTICIPANTS,
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

  public async addParticipant(userId: string, discordId: string, username: string): Promise<void> {
    if (this.participants.size >= this.MAX_PARTICIPANTS) {
      throw new Error('El juego ya tiene el máximo de participantes');
    }

    await super.addParticipant(userId, discordId, username);
    this.playerTickets.set(userId, this.ticketsPerPlayer);
    this.totalTickets += this.ticketsPerPlayer;

    SystemLogger.info('MidnightDrop participant added', {
      sessionId: this.sessionId,
      userId,
      totalParticipants: this.participants.size,
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

      await this.sendMidnightMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `🌙 ${question.q}`,
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

            const currentTickets =
              this.playerTickets.get(participant.userId) ?? this.ticketsPerPlayer;
            this.playerTickets.set(participant.userId, currentTickets + 1);
            this.totalTickets += 1;

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendMidnightMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention: `${winnerMention} +1 ticket!`,
                answer: this.correctAnswer,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('MidnightDrop correct answer - ticket awarded', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              userId: participant.userId,
              tickets: currentTickets + 1,
            });
          }
        } else {
          await this.sendMidnightMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: this.correctAnswer,
              scores: this.getScoreboard(),
            })
          );
        }
      } else {
        await this.sendMidnightMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.correctAnswer ?? 'Sin respuesta',
            scores: this.getScoreboard(),
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('MidnightDropGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  protected override async end(): Promise<void> {
    try {
      const participants = this.getParticipants();
      if (participants.length === 0) {
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );
        this.status = 'finished';

        await this.sendMidnightMessage(
          EmbedFactory.info('El Midnight Drop terminó sin participantes.')
        );
        return;
      }

      const winners = this.selectWinners(participants);

      for (const winner of winners) {
        winner.isWinner = true;

        const pendingPrizeId = await PendingPrizeService.createPending(
          this.db,
          winner.userId,
          this.sessionId,
          'coins',
          '1000'
        );

        await scoreService.updateAfterGame({
          sessionId: this.sessionId,
          winnerId: winner.userId,
          guildId: this.guild.id,
          gameType: this.strategy.gameType,
          score: winner.score,
        });

        auditLogger.logPrizeAwarded(winner.userId, 'coins', '1000', this.sessionId);

        SystemLogger.info('MidnightDrop winner', {
          sessionId: this.sessionId,
          winnerUserId: winner.userId,
          tickets: this.playerTickets.get(winner.userId),
        });
      }

      this.db.execute(
        "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        [this.sessionId]
      );
      this.status = 'finished';

      const winnerMentions = winners.map(w => `<@${w.discordId}>`).join(', ');
      const rankings = this.getMidnightRankings();

      await this.sendMidnightMessage(
        EmbedFactory.gameEnd({
          gameName: this.strategy.gameName,
          winnerMention: `${winnerMentions} ¡Ganadores del Midnight Drop! 🌙`,
          finalScore: winners[0]?.score ?? 0,
          rankings,
          prizeName: '1000 Coins + Legendary Token 🌟',
        })
      );

      SystemLogger.info('MidnightDrop game ended', {
        sessionId: this.sessionId,
        winnerCount: winners.length,
      });

      this.cleanupGameResources();
    } catch (error) {
      SystemLogger.error('MidnightDropGame.end failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private selectWinners(participants: Participant[]): Participant[] {
    if (participants.length <= 3) {
      return participants;
    }

    const weightedPool: string[] = [];
    for (const p of participants) {
      const tickets = this.playerTickets.get(p.userId) ?? 1;
      for (let i = 0; i < tickets; i++) {
        weightedPool.push(p.userId);
      }
    }

    const winnerCount = Math.min(3, participants.length);
    const winners: Set<string> = new Set();

    while (winners.size < winnerCount && weightedPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * weightedPool.length);
      const winnerId = weightedPool[randomIndex];
      winners.add(winnerId);
    }

    return participants.filter(p => winners.has(p.userId));
  }

  protected override evaluateWinner(): Participant | null {
    return null;
  }

  private getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private getMidnightRankings(): Array<{ mention: string; score: number; position: number }> {
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

  private async sendMidnightMessage(embed: EmbedBuilder): Promise<Message> {
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
