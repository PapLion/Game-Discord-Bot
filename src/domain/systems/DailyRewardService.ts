import { StreakSystem, StreakClaimResult, streakSystem } from './StreakSystem';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../infrastructure/logger/AuditLogger';

export interface DailyClaimResponse {
  success: boolean;
  claimed: boolean;
  streak: number;
  multiplier: number;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  nextClaimIn: string | null;
  wasBroken: boolean;
}

export class DailyRewardService {
  private static instance: DailyRewardService;
  private streakSys: StreakSystem;
  private userRepo: UserRepository;

  private constructor(streakSys?: StreakSystem, userRepo?: UserRepository) {
    this.streakSys = streakSys ?? streakSystem;
    this.userRepo = userRepo ?? new UserRepository();
  }

  static getInstance(): DailyRewardService {
    if (!DailyRewardService.instance) {
      DailyRewardService.instance = new DailyRewardService();
    }
    return DailyRewardService.instance;
  }

  async claimDaily(userId: string): Promise<DailyClaimResponse> {
    try {
      const result = await this.streakSys.claim(userId);

      const previousStreak = await this.getPreviousStreak(userId);
      const wasBroken =
        result.status === 'broken' || (result.status === 'first_claim' && previousStreak > 0);

      if (result.status === 'success' || result.status === 'first_claim') {
        await this.userRepo.updateCoins(userId, result.totalReward);

        auditLogger.logDailyReward(userId, result.totalReward, result.streak, result.multiplier);

        SystemLogger.info('DailyRewardService: Reward claimed', {
          userId,
          streak: result.streak,
          reward: result.totalReward,
          wasBroken,
        });
      }

      const nextClaimIn = this.calculateNextClaimTime(result);

      return {
        success: result.status !== 'already_claimed',
        claimed: result.status === 'success' || result.status === 'first_claim',
        streak: result.streak,
        multiplier: result.multiplier,
        baseReward: result.baseReward,
        bonusReward: result.bonusReward,
        totalReward: result.totalReward,
        nextClaimIn,
        wasBroken,
      };
    } catch (error) {
      SystemLogger.error('DailyRewardService.claimDaily failed', {
        error,
        userId,
      });
      throw error;
    }
  }

  async getTimeUntilNextClaim(userId: string): Promise<string | null> {
    try {
      const user = await this.userRepo.findByDiscordId(userId, userId);

      if (!user || !user.lastDaily) {
        return null;
      }

      const hoursSinceLastDaily = this.getHoursSinceLastDaily(user.lastDaily);

      if (hoursSinceLastDaily >= 20) {
        return null;
      }

      const hoursRemaining = 20 - hoursSinceLastDaily;
      return this.formatHoursRemaining(hoursRemaining);
    } catch (error) {
      SystemLogger.error('DailyRewardService.getTimeUntilNextClaim failed', {
        error,
        userId,
      });
      return null;
    }
  }

  private async getPreviousStreak(userId: string): Promise<number> {
    try {
      const user = await this.userRepo.findByDiscordId(userId, userId);
      return user?.streak ?? 0;
    } catch {
      return 0;
    }
  }

  private calculateNextClaimTime(result: StreakClaimResult): string | null {
    if (result.status === 'already_claimed') {
      return '20 hours';
    }
    return null;
  }

  private getHoursSinceLastDaily(lastDaily: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastDaily.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  private formatHoursRemaining(hours: number): string {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}

export const dailyRewardService = DailyRewardService.getInstance();
