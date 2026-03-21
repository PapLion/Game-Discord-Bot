import { DeliveryResult, Prize } from '../../../types/prize.types';
import { getPrizeRepository } from '../PrizeRepository';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class VirtualItemAdapter {
  private prizeRepo = getPrizeRepository();

  async canDeliver(_userId: string, _prize: Prize): Promise<boolean> {
    return true;
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      this.prizeRepo.insertInventoryItem(userId, 'virtual_item', prize.value);

      auditLogger.logPrizeAwarded(userId, prize.type, prize.value);

      SystemLogger.info('VirtualItemAdapter: item delivered', { userId, itemId: prize.value });

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      SystemLogger.error('VirtualItemAdapter.deliver failed', { error: err.message, userId });
      return { success: false, error: err };
    }
  }
}
