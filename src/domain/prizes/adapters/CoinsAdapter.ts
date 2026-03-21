import { DeliveryResult, Prize } from '../../../types/prize.types';
import { UserRepository } from '../../../infrastructure/database/UserRepository';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class CoinsAdapter {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async canDeliver(_userId: string, _prize: Prize): Promise<boolean> {
    return true;
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      const coinsAmount = parseInt(prize.value, 10);
      if (isNaN(coinsAmount)) {
        SystemLogger.error('CoinsAdapter: invalid prize value', { userId, value: prize.value });
        return { success: false, error: new Error('Invalid coins amount') };
      }

      await this.userRepo.updateCoins(userId, coinsAmount);

      auditLogger.logPrizeAwarded(userId, prize.type, prize.value);

      SystemLogger.info('CoinsAdapter: coins delivered', { userId, amount: coinsAmount });

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      SystemLogger.error('CoinsAdapter.deliver failed', { error: err.message, userId });
      return { success: false, error: err };
    }
  }
}
