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

export class GuessingGameStrategy implements GameStrategy {
  readonly gameType: 'guessing' = 'guessing';
  readonly gameName: string = 'Number Guessing';
  readonly totalRounds: number = 1;
  readonly prizeName: string = '75 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use GuessingGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

interface Guess {
  discordId: string;
  number: number;
  distance: number;
}

export class GuessingGame extends BaseGame {
  private secretNumber: number = 0;
  private readonly MIN_NUMBER: number = 1;
  private readonly MAX_NUMBER: number = 100;
  private readonly POINTS_FOR_WIN: number = 10;
  private guesses: Map<string, number> = new Map();
  private winnerFound: boolean = false;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new GuessingGameStrategy();
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

    this.secretNumber =
      Math.floor(Math.random() * (this.MAX_NUMBER - this.MIN_NUMBER + 1)) + this.MIN_NUMBER;

    SystemLogger.info('GuessingGame initialized', {
      sessionId: this.sessionId,
      secretNumber: this.secretNumber,
    });
  }

  private getHint(guess: number): string {
    if (guess < this.secretNumber) {
      return '📈 Higher!';
    } else if (guess > this.secretNumber) {
      return '📉 Lower!';
    }
    return '✅ Correct!';
  }

  private getDistance(guess: number): number {
    return Math.abs(this.secretNumber - guess);
  }

  protected override async roundLogic(_round: number): Promise<void> {
    try {
      const timeoutMs = 120000;

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: 1,
          totalRounds: 1,
          question: `🔮 Guess the number between ${this.MIN_NUMBER} and ${this.MAX_NUMBER}! Type !play [number]`,
          timeoutSeconds: Math.floor(timeoutMs / 1000),
        })
      );

      const participants = this.getParticipants();
      const maxAttempts = participants.length * 10;

      for (let attempt = 0; attempt < maxAttempts && !this.winnerFound; attempt++) {
        const answer = await this.waitForAnswer(5000);
        const answeringDiscordId = this.getAnsweringDiscordId();

        if (answer === null || answeringDiscordId === null) {
          break;
        }

        if (this.guesses.has(answeringDiscordId)) {
          continue;
        }

        const guessNumber = parseInt(answer.trim(), 10);

        if (isNaN(guessNumber) || guessNumber < this.MIN_NUMBER || guessNumber > this.MAX_NUMBER) {
          await this.channel.send({
            content: `<@${answeringDiscordId}> Please guess a number between ${this.MIN_NUMBER} and ${this.MAX_NUMBER}.`,
          });
          continue;
        }

        this.guesses.set(answeringDiscordId, guessNumber);

        const hint = this.getHint(guessNumber);
        await this.channel.send({
          content: `<@${answeringDiscordId}> ${hint}`,
        });

        if (guessNumber === this.secretNumber) {
          this.winnerFound = true;
          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, this.POINTS_FOR_WIN);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendRoundMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: `Number was ${this.secretNumber}`,
                points: this.POINTS_FOR_WIN,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('Guessing game winner', {
              sessionId: this.sessionId,
              discordId: participant.discordId,
              guess: guessNumber,
            });
          }
        }
      }

      if (!this.winnerFound) {
        await this.sendRoundMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: `The number was ${this.secretNumber}`,
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Guessing game timeout', { sessionId: this.sessionId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('GuessingGame.roundLogic failed', {
        sessionId: this.sessionId,
        error: message,
      });
      throw error;
    }
  }

  protected override async end(): Promise<void> {
    if (!this.winnerFound) {
      const closestGuessers = this.findClosestGuessers();

      if (closestGuessers.length > 1) {
        const mentions = closestGuessers.map(g => `<@${g.discordId}>`).join(', ');
        const pointsPerWinner = Math.floor(this.POINTS_FOR_WIN / closestGuessers.length);

        for (const guesser of closestGuessers) {
          const participant = this.findParticipantByDiscordId(guesser.discordId);
          if (participant) {
            await this.updateScore(participant.userId, pointsPerWinner);
          }
        }

        await this.sendRoundMessage(
          EmbedFactory.roundResult({
            correct: true,
            winnerMention: mentions,
            answer: `Tie! Closest to ${this.secretNumber}, prize split ${pointsPerWinner} pts each`,
            points: pointsPerWinner,
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Guessing game tie - prize divided', {
          sessionId: this.sessionId,
          winners: closestGuessers.map(g => g.discordId),
          distance: closestGuessers[0].distance,
        });
      }
    }

    await super.end();
  }

  private findClosestGuessers(): Guess[] {
    const guesses: Guess[] = [];

    for (const [discordId, number] of this.guesses.entries()) {
      guesses.push({
        discordId,
        number,
        distance: this.getDistance(number),
      });
    }

    guesses.sort((a, b) => a.distance - b.distance);

    if (guesses.length === 0) return [];

    const closestDistance = guesses[0].distance;
    return guesses.filter(g => g.distance === closestDistance);
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('Guessing game final winner determined', {
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
