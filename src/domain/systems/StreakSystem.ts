import { GAME_CONSTANTS } from '../../types/GAME_CONSTANTS';
import { IUserRepository, UserRepository } from '../../infrastructure/database/UserRepository';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

export type StreakState = 'inactive' | 'active' | 'broken' | 'maxed';

export interface StreakClaimResult {
  status: 'success' | 'already_claimed' | 'broken' | 'first_claim';
  streak: number;
  multiplier: number;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
}

export interface StreakInfo {
  state: StreakState;
  streak: number;
  lastDaily: Date | null;
  hoursSinceLastDaily: number | null;
  multiplier: number;
}

export interface IStreakSystem {
  getStreakInfo(userId: string): Promise<StreakInfo>;
  claim(userId: string): Promise<StreakClaimResult>;
  checkAndUpdateState(userId: string): Promise<StreakInfo>;
}

abstract class StreakStateHandler {
  abstract handle(context: StreakContext): Promise<StreakClaimResult>;

  protected getMultiplier(streak: number): number {
    if (streak >= 30) return GAME_CONSTANTS.MAX_STREAK_MULTIPLIER;
    if (streak >= 20) return 4.0;
    if (streak >= 14) return 3.0;
    if (streak >= 7) return 2.0;
    return 1.0;
  }

  protected getBaseReward(streak: number): number {
    if (streak >= 30) return 200;
    if (streak >= 14) return 150;
    if (streak >= 7) return 100;
    return 50;
  }
}

class InactiveStateHandler extends StreakStateHandler {
  handle(context: StreakContext): Promise<StreakClaimResult> {
    return context.handleFirstClaim();
  }
}

class ActiveStateHandler extends StreakStateHandler {
  handle(context: StreakContext): Promise<StreakClaimResult> {
    const hoursSinceLastDaily = context.getHoursSinceLastDaily();

    if (hoursSinceLastDaily < GAME_CONSTANTS.STREAK_WINDOW_MIN_HOURS) {
      return context.handleAlreadyClaimed();
    }

    if (hoursSinceLastDaily > GAME_CONSTANTS.STREAK_WINDOW_MAX_HOURS) {
      return context.handleBroken();
    }

    return context.handleStreakIncrease();
  }
}

class BrokenStateHandler extends StreakStateHandler {
  handle(context: StreakContext): Promise<StreakClaimResult> {
    return context.handleBroken();
  }
}

class MaxedStateHandler extends StreakStateHandler {
  handle(context: StreakContext): Promise<StreakClaimResult> {
    const hoursSinceLastDaily = context.getHoursSinceLastDaily();

    if (hoursSinceLastDaily < GAME_CONSTANTS.STREAK_WINDOW_MIN_HOURS) {
      return context.handleAlreadyClaimed();
    }

    if (hoursSinceLastDaily > GAME_CONSTANTS.STREAK_WINDOW_MAX_HOURS) {
      return context.handleBroken();
    }

    return context.handleMaxedClaim();
  }
}

class StreakContext {
  private userId: string;
  private streak: number;
  private lastDaily: Date | null;
  private userRepo: IUserRepository;
  private now: Date;

  constructor(userId: string, streak: number, lastDaily: Date | null, userRepo: IUserRepository) {
    this.userId = userId;
    this.streak = streak;
    this.lastDaily = lastDaily;
    this.userRepo = userRepo;
    this.now = new Date();
  }

  getHoursSinceLastDaily(): number {
    if (!this.lastDaily) {
      return GAME_CONSTANTS.STREAK_WINDOW_MAX_HOURS + 1;
    }

    const diffMs = this.now.getTime() - this.lastDaily.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  private calculateReward(streak: number): {
    base: number;
    bonus: number;
    total: number;
    multiplier: number;
  } {
    const base = StreakContext.getBaseRewardStatic(streak);
    const multiplier = StreakContext.getMultiplierStatic(streak);
    const bonus = Math.round(base * (multiplier - 1));
    const total = base + bonus;
    return { base, bonus, total, multiplier };
  }

  async handleFirstClaim(): Promise<StreakClaimResult> {
    const newStreak = 1;
    const reward = this.calculateReward(newStreak);

    await this.userRepo.updateStreak(this.userId, newStreak, this.now);

    SystemLogger.info('StreakSystem: First claim', {
      userId: this.userId,
      streak: newStreak,
      reward: reward.total,
    });

    return {
      status: 'first_claim',
      streak: newStreak,
      multiplier: reward.multiplier,
      baseReward: reward.base,
      bonusReward: reward.bonus,
      totalReward: reward.total,
    };
  }

  async handleStreakIncrease(): Promise<StreakClaimResult> {
    const newStreak = this.streak + 1;
    const reward = this.calculateReward(newStreak);

    await this.userRepo.updateStreak(this.userId, newStreak, this.now);

    SystemLogger.info('StreakSystem: Streak increased', {
      userId: this.userId,
      previousStreak: this.streak,
      newStreak,
      reward: reward.total,
    });

    return {
      status: 'success',
      streak: newStreak,
      multiplier: reward.multiplier,
      baseReward: reward.base,
      bonusReward: reward.bonus,
      totalReward: reward.total,
    };
  }

  async handleAlreadyClaimed(): Promise<StreakClaimResult> {
    const reward = this.calculateReward(this.streak);

    return {
      status: 'already_claimed',
      streak: this.streak,
      multiplier: reward.multiplier,
      baseReward: reward.base,
      bonusReward: reward.bonus,
      totalReward: reward.total,
    };
  }

  async handleBroken(): Promise<StreakClaimResult> {
    const reward = this.calculateReward(1);

    await this.userRepo.updateStreak(this.userId, 1, this.now);

    SystemLogger.info('StreakSystem: Streak broken', {
      userId: this.userId,
      previousStreak: this.streak,
    });

    return {
      status: 'broken',
      streak: 1,
      multiplier: reward.multiplier,
      baseReward: reward.base,
      bonusReward: reward.bonus,
      totalReward: reward.total,
    };
  }

  async handleMaxedClaim(): Promise<StreakClaimResult> {
    const reward = this.calculateReward(this.streak);

    await this.userRepo.updateStreak(this.userId, this.streak, this.now);

    SystemLogger.info('StreakSystem: Maxed streak claimed', {
      userId: this.userId,
      streak: this.streak,
      reward: reward.total,
    });

    return {
      status: 'success',
      streak: this.streak,
      multiplier: reward.multiplier,
      baseReward: reward.base,
      bonusReward: reward.bonus,
      totalReward: reward.total,
    };
  }

  determineState(): StreakState {
    if (this.streak === 0 && !this.lastDaily) {
      return 'inactive';
    }

    if (this.streak >= GAME_CONSTANTS.MAX_STREAK_MULTIPLIER * 6) {
      return 'maxed';
    }

    const hoursSinceLastDaily = this.getHoursSinceLastDaily();

    if (this.streak > 0 && hoursSinceLastDaily > GAME_CONSTANTS.STREAK_WINDOW_MAX_HOURS) {
      return 'broken';
    }

    if (this.streak > 0) {
      return 'active';
    }

    if (this.lastDaily && hoursSinceLastDaily > GAME_CONSTANTS.STREAK_WINDOW_MAX_HOURS) {
      return 'broken';
    }

    return 'active';
  }

  getHoursSinceLastDailyInfo(): number | null {
    if (!this.lastDaily) {
      return null;
    }
    return this.getHoursSinceLastDaily();
  }

  static getMultiplierStatic(streak: number): number {
    if (streak >= 30) return GAME_CONSTANTS.MAX_STREAK_MULTIPLIER;
    if (streak >= 20) return 4.0;
    if (streak >= 14) return 3.0;
    if (streak >= 7) return 2.0;
    return 1.0;
  }

  static getBaseRewardStatic(streak: number): number {
    if (streak >= 30) return 200;
    if (streak >= 14) return 150;
    if (streak >= 7) return 100;
    return 50;
  }
}

export class StreakSystem implements IStreakSystem {
  private static instance: StreakSystem;
  private userRepo: IUserRepository;

  private constructor(userRepo?: IUserRepository) {
    this.userRepo = userRepo ?? new UserRepository();
  }

  static getInstance(userRepo?: IUserRepository): StreakSystem {
    if (!StreakSystem.instance) {
      StreakSystem.instance = new StreakSystem(userRepo);
    }
    return StreakSystem.instance;
  }

  async getStreakInfo(userId: string): Promise<StreakInfo> {
    const user = await this.userRepo.findByDiscordId(userId, userId);

    if (!user) {
      return {
        state: 'inactive',
        streak: 0,
        lastDaily: null,
        hoursSinceLastDaily: null,
        multiplier: 1.0,
      };
    }

    const context = new StreakContext(user.id, user.streak, user.lastDaily ?? null, this.userRepo);
    const state = context.determineState();
    const multiplier = this.getMultiplierForStreak(user.streak);

    return {
      state,
      streak: user.streak,
      lastDaily: user.lastDaily ?? null,
      hoursSinceLastDaily: context.getHoursSinceLastDailyInfo(),
      multiplier,
    };
  }

  async claim(userId: string): Promise<StreakClaimResult> {
    const user = await this.userRepo.findByDiscordId(userId, userId);

    if (!user) {
      const newContext = new StreakContext(userId, 0, null, this.userRepo);
      return newContext.handleFirstClaim();
    }

    const context = new StreakContext(user.id, user.streak, user.lastDaily ?? null, this.userRepo);
    const state = context.determineState();
    const handler = this.getHandler(state);

    return handler.handle(context);
  }

  async checkAndUpdateState(userId: string): Promise<StreakInfo> {
    const user = await this.userRepo.findByDiscordId(userId, userId);

    if (!user) {
      return {
        state: 'inactive',
        streak: 0,
        lastDaily: null,
        hoursSinceLastDaily: null,
        multiplier: 1.0,
      };
    }

    const context = new StreakContext(user.id, user.streak, user.lastDaily ?? null, this.userRepo);
    let state = context.determineState();

    if (state === 'broken' && user.streak > 0) {
      await this.userRepo.updateStreak(user.id, 0, user.lastDaily ?? new Date());
      state = 'inactive';
    }

    return {
      state,
      streak: user.streak,
      lastDaily: user.lastDaily ?? null,
      hoursSinceLastDaily: context.getHoursSinceLastDailyInfo(),
      multiplier: this.getMultiplierForStreak(user.streak),
    };
  }

  private getHandler(state: StreakState): StreakStateHandler {
    switch (state) {
      case 'inactive':
        return new InactiveStateHandler();
      case 'active':
        return new ActiveStateHandler();
      case 'broken':
        return new BrokenStateHandler();
      case 'maxed':
        return new MaxedStateHandler();
    }
  }

  private getMultiplierForStreak(streak: number): number {
    if (streak >= 30) return GAME_CONSTANTS.MAX_STREAK_MULTIPLIER;
    if (streak >= 20) return 4.0;
    if (streak >= 14) return 3.0;
    if (streak >= 7) return 2.0;
    return 1.0;
  }
}

export const streakSystem = StreakSystem.getInstance();
