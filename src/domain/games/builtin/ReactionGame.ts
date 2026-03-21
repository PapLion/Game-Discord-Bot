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

export class ReactionGameStrategy implements GameStrategy {
  readonly gameType: 'reaction' = 'reaction';
  readonly gameName: string = 'Reaction Speed';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '50 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use ReactionGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class ReactionGame extends BaseGame {
  private roundStartTime: number = 0;
  private readonly POINTS_PER_WIN: number = 10;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new ReactionGameStrategy();
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

    SystemLogger.info('ReactionGame initialized', {
      sessionId: this.sessionId,
    });
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      this.roundStartTime = Date.now();

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: '⚡ REACT NOW! 🎯 — First to type !play wins!',
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const answer = await this.waitForAnswer();
      const answeringDiscordId = this.getAnsweringDiscordId();

      if (answer !== null && answeringDiscordId !== null) {
        const reactionTimeMs = Date.now() - this.roundStartTime;

        if (reactionTimeMs < GAME_CONSTANTS.MIN_REACTION_MS) {
          this.flagSuspicious(answeringDiscordId, reactionTimeMs);
        }

        const participant = this.findParticipantByDiscordId(answeringDiscordId);

        if (participant) {
          await this.updateScore(participant.userId, this.POINTS_PER_WIN);

          const winnerMention = `<@${participant.discordId}>`;
          await this.sendRoundMessage(
            EmbedFactory.roundResult({
              correct: true,
              winnerMention,
              answer: `${reactionTimeMs}ms`,
              points: this.POINTS_PER_WIN,
              scores: this.getScoreboard(),
            })
          );

          SystemLogger.info('Reaction round winner', {
            sessionId: this.sessionId,
            round,
            discordId: participant.discordId,
            reactionTimeMs,
          });
        }
      } else {
        await this.sendRoundMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: 'No one reacted in time',
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Reaction round timeout', { sessionId: this.sessionId, round });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('ReactionGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  protected flagSuspicious(discordId: string, reactionTimeMs: number): void {
    SystemLogger.warn('Anti-cheat flagged suspicious response', {
      sessionId: this.sessionId,
      discordId,
      reactionTimeMs,
      reason: 'Response time below minimum threshold',
    });
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
      SystemLogger.info('Reaction winner determined', {
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
