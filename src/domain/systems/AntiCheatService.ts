import { GAME_CONSTANTS } from '../../types/GAME_CONSTANTS';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../infrastructure/logger/AuditLogger';

interface ResponseRecord {
  timestamp: number;
  isTooFast: boolean;
}

interface UserFlags {
  count: number;
  reasons: string[];
  firstFlag: number;
}

interface BanRecord {
  userId: string;
  expiresAt: number;
  reason: string;
}

export interface IAntiCheatService {
  recordResponse(userId: string, timestampMs: number): boolean;
  isTooFast(userId: string): boolean;
  flagSuspicious(userId: string, reason: string): void;
  isSuspicious(userId: string): boolean;
  isBanned(userId: string): boolean;
  resetUser(userId: string): void;
  getWarningCount(userId: string): number;
}

export class AntiCheatService implements IAntiCheatService {
  private static instance: AntiCheatService;

  private responseHistory: Map<string, ResponseRecord[]> = new Map();
  private userFlags: Map<string, UserFlags> = new Map();
  private activeBans: Map<string, BanRecord> = new Map();

  private readonly SUSPICION_THRESHOLD = 3;
  private readonly BAN_DURATION_MS = 5 * 60 * 1000;
  private readonly WINDOW_CLEANUP_MS = 60 * 60 * 1000;

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): AntiCheatService {
    if (!AntiCheatService.instance) {
      AntiCheatService.instance = new AntiCheatService();
    }
    return AntiCheatService.instance;
  }

  recordResponse(userId: string, timestampMs: number): boolean {
    const now = Date.now();
    const records = this.responseHistory.get(userId) ?? [];

    const lastResponse = records[records.length - 1];
    const timeSinceLastResponse = lastResponse ? now - lastResponse.timestamp : Infinity;
    const isTooFast =
      timeSinceLastResponse < GAME_CONSTANTS.MIN_REACTION_MS && lastResponse !== undefined;

    records.push({ timestamp: now, isTooFast });
    this.responseHistory.set(userId, records);

    if (isTooFast) {
      this.flagSuspicious(userId, `Response too fast: ${timeSinceLastResponse}ms`);
      SystemLogger.warn('AntiCheatService: Fast response detected', {
        userId,
        responseTime: timeSinceLastResponse,
        minAllowed: GAME_CONSTANTS.MIN_REACTION_MS,
      });
      return false;
    }

    return true;
  }

  isTooFast(userId: string): boolean {
    const records = this.responseHistory.get(userId);
    if (!records || records.length === 0) {
      return false;
    }

    const now = Date.now();
    const recentRecords = records.filter(r => now - r.timestamp < GAME_CONSTANTS.SPAM_WINDOW_MS);

    return recentRecords.some(r => r.isTooFast);
  }

  flagSuspicious(userId: string, reason: string): void {
    const now = Date.now();
    const existing = this.userFlags.get(userId);

    if (existing) {
      existing.count += 1;
      existing.reasons.push(reason);
    } else {
      this.userFlags.set(userId, {
        count: 1,
        reasons: [reason],
        firstFlag: now,
      });
    }

    const flags = this.userFlags.get(userId);
    if (flags && flags.count >= this.SUSPICION_THRESHOLD) {
      this.applyBan(userId, 'Too many suspicious activities detected');
    }

    SystemLogger.info('AntiCheatService: User flagged', {
      userId,
      reason,
      totalFlags: this.userFlags.get(userId)?.count ?? 1,
    });
  }

  isSuspicious(userId: string): boolean {
    const flags = this.userFlags.get(userId);
    return (flags?.count ?? 0) >= this.SUSPICION_THRESHOLD;
  }

  isBanned(userId: string): boolean {
    const ban = this.activeBans.get(userId);
    if (!ban) {
      return false;
    }

    if (Date.now() > ban.expiresAt) {
      this.activeBans.delete(userId);
      return false;
    }

    return true;
  }

  resetUser(userId: string): void {
    this.responseHistory.delete(userId);
    this.userFlags.delete(userId);
    this.activeBans.delete(userId);

    SystemLogger.info('AntiCheatService: User reset', { userId });
  }

  getWarningCount(userId: string): number {
    return this.userFlags.get(userId)?.count ?? 0;
  }

  private applyBan(userId: string, reason: string): void {
    const expiresAt = Date.now() + this.BAN_DURATION_MS;

    this.activeBans.set(userId, {
      userId,
      expiresAt,
      reason,
    });

    auditLogger.logBanApplied(userId, reason, '5 minutes');

    SystemLogger.warn('AntiCheatService: Ban applied', {
      userId,
      reason,
      expiresAt,
    });
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [userId, records] of this.responseHistory.entries()) {
        const filtered = records.filter(r => now - r.timestamp < this.WINDOW_CLEANUP_MS);
        if (filtered.length === 0) {
          this.responseHistory.delete(userId);
        } else {
          this.responseHistory.set(userId, filtered);
        }
      }

      for (const [userId, ban] of this.activeBans.entries()) {
        if (now > ban.expiresAt) {
          this.activeBans.delete(userId);
        }
      }
    }, this.WINDOW_CLEANUP_MS);
  }

  isRateLimited(userId: string, currentTime: number): boolean {
    const records = this.responseHistory.get(userId);
    if (!records) {
      return false;
    }

    const recentRecords = records.filter(
      r => currentTime - r.timestamp < GAME_CONSTANTS.SPAM_WINDOW_MS
    );

    return recentRecords.length >= GAME_CONSTANTS.SPAM_MAX_MESSAGES;
  }
}

export const antiCheatService = AntiCheatService.getInstance();
