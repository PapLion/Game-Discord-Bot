import { DeliveryResult, Prize } from '../../../types/prize.types';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { GAME_CONSTANTS } from '../../../types/constants';
import { Client, Role } from 'discord.js';

export class RoleAdapter {
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  async canDeliver(_userId: string, _prize: Prize): Promise<boolean> {
    return this.client !== null;
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    if (!this.client) {
      SystemLogger.error('RoleAdapter: client not set');
      return { success: false, error: new Error('Discord client not initialized') };
    }

    const roleId = prize.value;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= GAME_CONSTANTS.PRIZE_RETRY_MAX; attempt++) {
      try {
        const guild = this.findGuildForUser(userId);
        if (!guild) {
          SystemLogger.error('RoleAdapter: guild not found for user', { userId });
          return { success: false, error: new Error('Guild not found') };
        }

        const role = await this.fetchRoleWithRetry(guild, roleId);
        if (!role) {
          SystemLogger.error('RoleAdapter: role not found', { roleId });
          return { success: false, error: new Error('Role not found') };
        }

        const member = await guild.members.fetch(userId);
        await member.roles.add(role);

        SystemLogger.info('RoleAdapter: role assigned', { userId, roleId });
        return { success: true };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        SystemLogger.warn('RoleAdapter: attempt failed, retrying', {
          userId,
          attempt,
          error: lastError.message,
        });

        if (attempt < GAME_CONSTANTS.PRIZE_RETRY_MAX) {
          await this.sleep(GAME_CONSTANTS.PRIZE_RETRY_BACKOFF_MS * attempt);
        }
      }
    }

    SystemLogger.error('RoleAdapter.deliver failed after retries', {
      userId,
      error: lastError?.message,
    });
    return { success: false, error: lastError };
  }

  private findGuildForUser(userId: string): import('discord.js').Guild | undefined {
    if (!this.client) return undefined;
    return this.client.guilds.cache.find(guild => guild.members.cache.has(userId));
  }

  private async fetchRoleWithRetry(
    guild: import('discord.js').Guild,
    roleId: string
  ): Promise<Role | null> {
    for (let attempt = 1; attempt <= GAME_CONSTANTS.PRIZE_RETRY_MAX; attempt++) {
      try {
        const role = await guild.roles.fetch(roleId);
        if (role) return role;
      } catch (error) {
        if (attempt === GAME_CONSTANTS.PRIZE_RETRY_MAX) {
          throw error;
        }
        await this.sleep(GAME_CONSTANTS.PRIZE_RETRY_BACKOFF_MS * attempt);
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
