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

const EVENT_QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  { q: '¿Qué节日 se celebra el 25 de diciembre?', a: 'navidad' },
  { q: '¿Cuántos dias tiene un año bisiesto?', a: '366' },
  { q: '¿Qué mes es Halloween?', a: 'octubre' },
  { q: '¿Cuál es el mes más corto?', a: 'febrero' },
  { q: '¿Cuántas semanas tiene un año?', a: '52' },
  { q: '¿En qué mes empieza el verano?', a: 'junio' },
  { q: '¿Cuántos meses tienen 31 días?', a: '7' },
  { q: '¿Qué节日 es el 14 de febrero?', a: 'san valentin' },
  { q: '¿En qué mes cae el Día de la Independencia (Latinoamérica)?', a: 'septiembre' },
  { q: '¿Cuántas horas tiene un día?', a: '24' },
];

export class EventTriviaGameStrategy implements GameStrategy {
  readonly gameType: 'eventtrivia' = 'eventtrivia';
  readonly gameName: string = 'Event Trivia';
  readonly totalRounds: number = 10;
  readonly prizeName: string = '200 Coins + Event Badge';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use EventTriviaGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class EventTriviaGame extends BaseGame {
  private questions: Array<{ q: string; a: string }>;
  private correctAnswer: string | null = null;
  private readonly POINTS_PER_CORRECT = 10;
  private readonly eventTheme: string;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService,
    eventTheme: string = 'General'
  ) {
    const strategy = new EventTriviaGameStrategy();
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

    this.eventTheme = eventTheme;
    this.questions = this.shuffleQuestions([...EVENT_QUESTIONS]);

    SystemLogger.info('EventTriviaGame initialized', {
      sessionId: this.sessionId,
      theme: this.eventTheme,
      questionCount: this.questions.length,
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

  protected override async roundLogic(round: number): Promise<void> {
    try {
      const question = this.questions[round - 1];
      if (!question) {
        SystemLogger.warn('No question for round', { sessionId: this.sessionId, round });
        return;
      }

      this.correctAnswer = question.a.toLowerCase().trim();

      await this.sendEventMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `🎉 ${this.eventTheme}: ${question.q}`,
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
            await this.sendEventMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: this.correctAnswer,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('EventTrivia correct answer', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              userId: participant.userId,
            });
          }
        } else {
          await this.sendEventMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: this.correctAnswer,
              scores: this.getScoreboard(),
            })
          );
        }
      } else {
        await this.sendEventMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.correctAnswer ?? 'Sin respuesta',
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('EventTrivia round timeout', { sessionId: this.sessionId, round });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('EventTriviaGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) {
      return null;
    }

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('EventTrivia winner determined', {
        sessionId: this.sessionId,
        winnerDiscordId: winner.discordId,
        score: winner.score,
      });
    }

    return winner ?? null;
  }

  protected getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  protected findParticipantByDiscordId(discordId: string): Participant | undefined {
    return this.getParticipants().find(p => p.discordId === discordId);
  }

  private async sendEventMessage(embed: EmbedBuilder): Promise<Message> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.channel.send({ embeds: [embed as any] });
  }
}
