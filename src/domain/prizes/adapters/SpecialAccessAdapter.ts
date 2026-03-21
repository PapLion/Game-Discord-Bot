import { DeliveryResult, Prize } from '../../../types/prize.types';
import { getPrizeRepository } from '../PrizeRepository';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class SpecialAccessAdapter {
  private prizeRepo = getPrizeRepository();

  async canDeliver(_userId: string, _prize: Prize): Promise<boolean> {
    return true;
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      const expiresAt = this.parseExpiresAt(prize);
      this.prizeRepo.insertSpecialAccess(userId, null, 'system', expiresAt);

      auditLogger.logPrizeAwarded(userId, prize.type, prize.value);

      SystemLogger.info('SpecialAccessAdapter: access granted', {
        userId,
        expiresAt: expiresAt ?? 'permanent',
      });

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      SystemLogger.error('SpecialAccessAdapter.deliver failed', { error: err.message, userId });
      return { success: false, error: err };
    }
  }

  private parseExpiresAt(prize: Prize): string | null {
    const expiresMatch = prize.value.match(/expires=(\d+)h/);
    if (expiresMatch) {
      const hours = parseInt(expiresMatch[1], 10);
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      return expiresAt.toISOString();
    }

    if (prize.value.includes('permanent')) {
      return null;
    }

    return null;
  }
}
