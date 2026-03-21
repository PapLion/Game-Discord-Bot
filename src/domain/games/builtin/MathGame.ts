import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
import { BaseGame } from '../base/BaseGame';
import { GameStrategy } from '../base/GameStrategy';
import { Participant } from '../../../types/game.types';
import { GAME_CONSTANTS } from '../../../types/constants';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';

type MathOperation = '+' | '-' | '*';

interface MathProblem {
  question: string;
  answer: string;
}

export class MathGameStrategy implements GameStrategy {
  readonly gameType: 'math' = 'math';
  readonly gameName: string = 'Math Challenge';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '50 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use MathGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class MathGame extends BaseGame {
  private correctAnswer: string | null = null;
  private readonly POINTS_PER_CORRECT: number = 10;
  private attemptedParticipants: Set<string> = new Set();

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new MathGameStrategy();
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

    SystemLogger.info('MathGame initialized', {
      sessionId: this.sessionId,
    });
  }

  private generateProblem(): MathProblem {
    const operations: MathOperation[] = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    let num1: number;
    let num2: number;
    let answer: number;

    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 50) + 1;
        num2 = Math.floor(Math.random() * 50) + 1;
        answer = num1 + num2;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 50) + 10;
        num2 = Math.floor(Math.random() * num1) + 1;
        answer = num1 - num2;
        break;
      case '*':
        num1 = Math.floor(Math.random() * 10) + 1;
        num2 = Math.floor(Math.random() * 10) + 1;
        answer = num1 * num2;
        break;
    }

    return {
      question: `${num1} ${operation} ${num2} = ?`,
      answer: answer.toString(),
    };
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      this.attemptedParticipants.clear();
      const problem = this.generateProblem();
      this.correctAnswer = problem.answer;

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `🔢 ${problem.question}`,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const maxAttempts = this.getParticipants().length * 3;
      let winnerFound = false;

      for (let attempt = 0; attempt < maxAttempts && !winnerFound; attempt++) {
        const answer = await this.waitForAnswer(5000);
        const answeringDiscordId = this.getAnsweringDiscordId();

        if (answer === null || answeringDiscordId === null) {
          break;
        }

        if (this.attemptedParticipants.has(answeringDiscordId)) {
          continue;
        }

        this.attemptedParticipants.add(answeringDiscordId);

        const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

        if (isCorrect) {
          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, this.POINTS_PER_CORRECT);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendRoundMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: this.correctAnswer,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('Math round winner', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
            });

            winnerFound = true;
          }
        }
      }

      if (!winnerFound) {
        await this.sendRoundMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.correctAnswer ?? 'No answer',
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Math round timeout', { sessionId: this.sessionId, round });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('MathGame.roundLogic failed', {
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
    if (topScore === 0) return null;

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('Math winner determined', {
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

  protected async sendRoundMessage(embed: EmbedBuilder): Promise<Message> {
    return this.channel.send({
      embeds: [embed as any] as Parameters<typeof this.channel.send>[0] extends { embeds?: infer E }
        ? { embeds: E }
        : never,
    });
  }
}
