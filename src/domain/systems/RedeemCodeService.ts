import { getPrizeRepository, PrizeRepository } from '../prizes/PrizeRepository';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { GAME_CONSTANTS } from '../../types/GAME_CONSTANTS';

export interface ClaimResult {
  success: boolean;
  codeId?: string;
  code?: string;
  fallbackUsed?: boolean;
  fallbackAmount?: number;
  codeClaimed?: boolean;
  errorMessage?: string;
}

export class RedeemCodeService {
  private prizeRepo: PrizeRepository;
  private userRepo: UserRepository;

  constructor() {
    this.prizeRepo = getPrizeRepository();
    this.userRepo = new UserRepository();
  }

  hasAvailableCodes(): boolean {
    const code = this.prizeRepo.findAvailableRedeemCode();
    return code !== undefined;
  }

  async claimCodeForUser(userId: string): Promise<ClaimResult> {
    const code = this.prizeRepo.findAvailableRedeemCode();

    if (!code) {
      SystemLogger.warn('RedeemCodeService: no codes available, using fallback coins', { userId });

      const fallbackAmount = GAME_CONSTANTS.REDEEM_FALLBACK_COINS;
      await this.userRepo.updateCoins(userId, fallbackAmount);

      return {
        success: true,
        fallbackUsed: true,
        fallbackAmount,
      };
    }

    const claimed = this.prizeRepo.claimRedeemCode(code.id, userId, code.version);

    if (!claimed) {
      SystemLogger.warn('RedeemCodeService: code claimed by another user (optimistic lock)', {
        userId,
        codeId: code.id,
        code: code.code,
      });

      const altCode = this.prizeRepo.findAvailableRedeemCode();
      if (!altCode) {
        SystemLogger.warn('RedeemCodeService: no more codes available after race, using fallback', {
          userId,
        });

        const fallbackAmount = GAME_CONSTANTS.REDEEM_FALLBACK_COINS;
        await this.userRepo.updateCoins(userId, fallbackAmount);

        return {
          success: true,
          fallbackUsed: true,
          fallbackAmount,
        };
      }

      const altClaimed = this.prizeRepo.claimRedeemCode(altCode.id, userId, altCode.version);
      if (!altClaimed) {
        SystemLogger.error('RedeemCodeService: all codes race-contested, using fallback', {
          userId,
        });

        const fallbackAmount = GAME_CONSTANTS.REDEEM_FALLBACK_COINS;
        await this.userRepo.updateCoins(userId, fallbackAmount);

        return {
          success: true,
          fallbackUsed: true,
          fallbackAmount,
        };
      }

      return {
        success: true,
        codeId: altCode.id,
        code: altCode.code,
      };
    }

    return {
      success: true,
      codeId: code.id,
      code: code.code,
    };
  }

  getCodeById(codeId: string) {
    return this.prizeRepo.getRedeemCodeById(codeId);
  }
}
