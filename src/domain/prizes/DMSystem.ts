import { Client, User } from 'discord.js';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { WinnerDMData } from '../../types/prize.types';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { getPrizeRepository } from './PrizeRepository';

export class DMSystem {
  private client: Client | null = null;
  private prizeRepo = getPrizeRepository();

  setClient(client: Client): void {
    this.client = client;
  }

  async sendWinnerDM(
    userId: string,
    data: WinnerDMData,
    channel: import('discord.js').TextChannel
  ): Promise<void> {
    if (!this.client) {
      SystemLogger.error('DMSystem: client not set');
      await this.sendChannelFallback(userId, data, channel);
      return;
    }

    const discordId = this.prizeRepo.getUserDiscordId(userId);
    if (!discordId) {
      SystemLogger.error('DMSystem: discordId not found for user', { userId });
      await this.sendChannelFallback(userId, data, channel);
      return;
    }

    const user = await this.fetchUser(discordId);
    if (!user) {
      SystemLogger.error('DMSystem: user not found in Discord', { userId, discordId });
      await this.sendChannelFallback(userId, data, channel);
      return;
    }

    const sent = await this.trySendDM(user, data);
    if (!sent) {
      await this.sendChannelFallback(userId, data, channel);
    }
  }

  private async fetchUser(discordId: string): Promise<User | null> {
    if (!this.client) return null;

    try {
      return await this.client.users.fetch(discordId);
    } catch (error) {
      SystemLogger.error('DMSystem: failed to fetch user', { discordId, error });
      return null;
    }
  }

  private async trySendDM(user: User, data: WinnerDMData): Promise<boolean> {
    const embed = EmbedFactory.winnerDM({
      userMention: data.userMention,
      gameName: data.gameName,
      prizeName: data.prizeName,
      rewardDescription: data.rewardDescription,
    });

    try {
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        setTimeout(() => resolve('timeout'), 5000);
      });

      const sendPromise = user.send({ embeds: [embed as any] }).then(() => 'sent');

      const result = await Promise.race([sendPromise, timeoutPromise]);

      if (result === 'sent') {
        SystemLogger.info('DMSystem: DM sent successfully', { userId: user.id });
        return true;
      }

      SystemLogger.warn('DMSystem: DM timed out', { userId: user.id });
      return false;
    } catch (error) {
      SystemLogger.warn('DMSystem: DM send failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async sendChannelFallback(
    userId: string,
    data: WinnerDMData,
    channel: import('discord.js').TextChannel
  ): Promise<void> {
    try {
      const embed = EmbedFactory.winnerChannel({
        userMention: data.userMention,
        gameName: data.gameName,
        prizeName: data.prizeName,
        rewardDescription: data.rewardDescription,
      });

      await channel.send({ embeds: [embed as any] });
      SystemLogger.info('DMSystem: fallback channel message sent', { userId });
    } catch (error) {
      SystemLogger.error('DMSystem: fallback channel send failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const dmSystem = new DMSystem();
