import { DeliveryResult, Prize } from '../../../types/prize.types';
import { RedeemCodeService } from '../../systems/RedeemCodeService';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class RedeemAdapter {
  private redeemService: RedeemCodeService;

  constructor() {
    this.redeemService = new RedeemCodeService();
  }

  async canDeliver(userId: string, _prize: Prize): Promise<boolean> {
    return this.redeemService.hasAvailableCodes() || this.redeemService.hasAvailableCodes();
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      const result = await this.redeemService.claimCodeForUser(userId);

      if (result.success) {
        auditLogger.logPrizeAwarded(userId, prize.type, prize.value);
        if (result.codeId) {
          auditLogger.logCodeClaimed(userId, result.codeId);
        }
        SystemLogger.info('RedeemAdapter: code delivered', { userId, codeId: result.codeId });
        return { success: true };
      }

      if (result.fallbackUsed) {
        auditLogger.logPrizeAwarded(userId, 'coins', String(result.fallbackAmount));
        SystemLogger.warn('RedeemAdapter: fallback coins used (no codes available)', { userId });
        return { success: true, fallbackUsed: true };
      }

      if (result.codeClaimed) {
        return {
          success: false,
          error: new Error('REDEEM_CODE_CLAIMED'),
        };
      }

      return { success: false, error: new Error(result.errorMessage ?? 'Unknown error') };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      SystemLogger.error('RedeemAdapter.deliver failed', { error: err.message, userId });
      return { success: false, error: err };
    }
  }
}
