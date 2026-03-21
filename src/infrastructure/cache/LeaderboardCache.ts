import { GAME_CONSTANTS } from '../../types/GAME_CONSTANTS';
import { DatabaseService, getDatabaseService } from '../database/DatabaseService';
import { SystemLogger } from '../logger/SystemLogger';

export interface LeaderboardEntry {
  userId: string;
  discordId: string;
  coins: number;
  username: string;
}

interface CacheEntry {
  data: LeaderboardEntry[];
  timestamp: number;
}

export class LeaderboardCache {
  private static instance: LeaderboardCache;
  private cache: Map<string, CacheEntry> = new Map();
  private db: DatabaseService;

  private constructor() {
    this.db = getDatabaseService();
  }

  static getInstance(): LeaderboardCache {
    if (!LeaderboardCache.instance) {
      LeaderboardCache.instance = new LeaderboardCache();
    }
    return LeaderboardCache.instance;
  }

  get(guildId: string, limit: number = 10): LeaderboardEntry[] | null {
    const entry = this.cache.get(guildId);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > GAME_CONSTANTS.LEADERBOARD_TTL_MS) {
      this.cache.delete(guildId);
      SystemLogger.debug('LeaderboardCache: TTL expired', { guildId });
      return null;
    }

    SystemLogger.debug('LeaderboardCache: HIT', { guildId, ageMs: age });
    return entry.data.slice(0, limit);
  }

  set(guildId: string, data: LeaderboardEntry[]): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };

    this.cache.set(guildId, entry);
    SystemLogger.debug('LeaderboardCache: Cached', { guildId, entries: data.length });
  }

  invalidate(guildId: string): void {
    const existed = this.cache.delete(guildId);
    if (existed) {
      SystemLogger.debug('LeaderboardCache: Invalidated', { guildId });
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    SystemLogger.debug('LeaderboardCache: All invalidated');
  }

  async getWithRefresh(guildId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const cached = this.get(guildId, limit);
    if (cached) {
      return cached;
    }

    const data = await this.queryLeaderboard(guildId, limit);
    this.set(guildId, data);
    return data;
  }

  private async queryLeaderboard(guildId: string, limit: number): Promise<LeaderboardEntry[]> {
    const rows = this.db.run<{
      user_id: string;
      discord_id: string;
      coins: number;
    }>(
      `SELECT u.id as user_id, u.discord_id, u.coins
       FROM users u
       WHERE u.guild_id = ?
       ORDER BY u.coins DESC
       LIMIT ?`,
      [guildId, limit]
    );

    return rows.map(row => ({
      userId: row.user_id,
      discordId: row.discord_id,
      coins: row.coins,
      username: '',
    }));
  }
}

export const leaderboardCache = LeaderboardCache.getInstance();
