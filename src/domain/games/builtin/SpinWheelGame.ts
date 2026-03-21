import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
import { BaseGame } from '../base/BaseGame';
import { GameStrategy } from '../base/GameStrategy';
import { Participant } from '../../../types/game.types';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';

export class SpinWheelGameStrategy implements GameStrategy {
  readonly gameType: 'spinwheel' = 'spinwheel';
  readonly gameName: string = 'Spin Wheel';
  readonly totalRounds: number = 1;
  readonly prizeName: string = '100 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use SpinWheelGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class SpinWheelGame extends BaseGame {
  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new SpinWheelGameStrategy();
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

    SystemLogger.info('SpinWheelGame initialized', {
      sessionId: this.sessionId,
    });
  }

  protected override async roundLogic(_round: number): Promise<void> {
    try {
      const participants = this.getParticipants();
      if (participants.length === 0) {
        await this.sendRoundMessage(EmbedFactory.error('No players in the game!'));
        return;
      }

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: 1,
          totalRounds: 1,
          question: '🎡 Spinning the wheel...',
          timeoutSeconds: 3,
        })
      );

      await new Promise(resolve => setTimeout(resolve, 3000));

      const randomIndex = Math.floor(Math.random() * participants.length);
      const winner = participants[randomIndex];

      if (winner) {
        await this.updateScore(winner.userId, 10);

        await this.sendRoundMessage(
          EmbedFactory.roundResult({
            correct: true,
            winnerMention: `<@${winner.discordId}>`,
            answer: 'Lucky winner!',
            points: 10,
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Spin wheel winner', {
          sessionId: this.sessionId,
          winnerDiscordId: winner.discordId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('SpinWheelGame.roundLogic failed', {
        sessionId: this.sessionId,
        error: message,
      });
      throw error;
    }
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('Spin wheel final winner determined', {
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

  protected async sendRoundMessage(embed: EmbedBuilder): Promise<Message> {
    return this.channel.send({
      embeds: [embed as any] as Parameters<typeof this.channel.send>[0] extends { embeds?: infer E }
        ? { embeds: E }
        : never,
    });
  }
}
