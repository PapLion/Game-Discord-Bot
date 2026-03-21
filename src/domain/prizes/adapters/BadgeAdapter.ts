import { DeliveryResult, Prize } from '../../../types/prize.types';
import { getPrizeRepository } from '../PrizeRepository';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class BadgeAdapter {
  private prizeRepo = getPrizeRepository();

  async canDeliver(_userId: string, _prize: Prize): Promise<boolean> {
    return true;
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      this.prizeRepo.insertInventoryItem(userId, 'badge', prize.value);

      auditLogger.logPrizeAwarded(userId, prize.type, prize.value);

      SystemLogger.info('BadgeAdapter: badge delivered', { userId, badgeId: prize.value });

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      SystemLogger.error('BadgeAdapter.deliver failed', { error: err.message, userId });
      return { success: false, error: err };
    }
  }
}
