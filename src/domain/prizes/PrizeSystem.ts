import { Prize, PrizeType } from '../../types/prize.types';
import { getPrizeRepository } from './PrizeRepository';
import { CoinsAdapter } from './adapters/CoinsAdapter';
import { BadgeAdapter } from './adapters/BadgeAdapter';
import { RoleAdapter } from './adapters/RoleAdapter';
import { VirtualItemAdapter } from './adapters/VirtualItemAdapter';
import { SpecialAccessAdapter } from './adapters/SpecialAccessAdapter';
import { RedeemAdapter } from './adapters/RedeemAdapter';
import { dmSystem } from './DMSystem';
import { auditLogger } from '../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { GAME_CONSTANTS } from '../../types/constants';
import { Client } from 'discord.js';

export interface ClaimResult {
  success: boolean;
  prizesClaimed: number;
  error?: string;
}

export class PrizeSystem {
  private prizeRepo = getPrizeRepository();
  private coinsAdapter = new CoinsAdapter();
  private badgeAdapter = new BadgeAdapter();
  private roleAdapter = new RoleAdapter();
  private virtualItemAdapter = new VirtualItemAdapter();
  private specialAccessAdapter = new SpecialAccessAdapter();
  private redeemAdapter = new RedeemAdapter();

  setClient(client: Client): void {
    this.roleAdapter.setClient(client);
    dmSystem.setClient(client);
  }

  async claimPending(
    userId: string,
    channel: import('discord.js').TextChannel
  ): Promise<ClaimResult> {
    const pendingPrizes = this.prizeRepo.findPendingByUser(userId);

    if (pendingPrizes.length === 0) {
      return { success: false, prizesClaimed: 0, error: 'NO_PENDING_PRIZES' };
    }

    let prizesClaimed = 0;

    for (const pending of pendingPrizes) {
      const prize: Prize = {
        id: pending.prize_id ?? pending.id,
        name: pending.prize_value,
        type: pending.prize_type as PrizeType,
        value: pending.prize_value,
        rarity: 'common',
      };

      const delivered = await this.deliverPrize(userId, prize, pending.id);

      if (delivered) {
        this.prizeRepo.markAsClaimed(pending.id);
        auditLogger.logPrizeClaimed(userId, pending.id);
        prizesClaimed++;

        await dmSystem.sendWinnerDM(
          userId,
          {
            userId,
            userMention: `<@${this.prizeRepo.getUserDiscordId(userId)}>`,
            gameName: 'Game Reward',
            prizeName: prize.name,
            rewardDescription: prize.name,
            sessionId: pending.session_id ?? '',
          },
          channel
        );
      } else {
        this.prizeRepo.incrementAttempts(pending.id);
        if (pending.attempts + 1 >= GAME_CONSTANTS.PRIZE_RETRY_MAX) {
          this.prizeRepo.markAsFailed(pending.id);
          SystemLogger.error('PrizeSystem: prize delivery failed after max attempts', {
            userId,
            pendingPrizeId: pending.id,
          });
        }
      }
    }

    return { success: prizesClaimed > 0, prizesClaimed };
  }

  private async deliverPrize(userId: string, prize: Prize, pendingId: string): Promise<boolean> {
    const adapter = this.getAdapter(prize.type);

    for (let attempt = 1; attempt <= GAME_CONSTANTS.PRIZE_RETRY_MAX; attempt++) {
      const result = await adapter.deliver(userId, prize);

      if (result.success) {
        return true;
      }

      if (attempt < GAME_CONSTANTS.PRIZE_RETRY_MAX) {
        await this.sleep(GAME_CONSTANTS.PRIZE_RETRY_BACKOFF_MS * attempt);
        SystemLogger.warn('PrizeSystem: retrying delivery', {
          userId,
          pendingId,
          prizeType: prize.type,
          attempt,
        });
      }
    }

    return false;
  }

  private getAdapter(prizeType: PrizeType) {
    switch (prizeType) {
      case 'coins':
        return this.coinsAdapter;
      case 'badge':
        return this.badgeAdapter;
      case 'role':
        return this.roleAdapter;
      case 'virtual_item':
        return this.virtualItemAdapter;
      case 'special_access':
        return this.specialAccessAdapter;
      case 'redeem':
        return this.redeemAdapter;
      default:
        return this.coinsAdapter;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const prizeSystem = new PrizeSystem();
