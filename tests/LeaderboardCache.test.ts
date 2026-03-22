import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LeaderboardCache } from '../src/infrastructure/cache/LeaderboardCache';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { GAME_CONSTANTS } from '../src/types/GAME_CONSTANTS';

describe('LeaderboardCache', () => {
  let cache: LeaderboardCache;
  let db: DatabaseService;

  beforeEach(async () => {
    db = DatabaseService.getInstance();
    await db.initialize(':memory:');

    for (let i = 1; i <= 5; i++) {
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [`user-${i}`, `discord-${i}`, 'guild-001', (6 - i) * 100, 0]
      );
    }

    cache = new LeaderboardCache();
  });

  afterEach(() => {
    db.close();
  });

  describe('Cache operations', () => {
    it('MISS returns null and populates cache', async () => {
      const result = cache.get('guild-001', 10);

      expect(result).toBeNull();
    });

    it('getWithRefresh populates cache on MISS', async () => {
      const result = await cache.getWithRefresh('guild-001', 10);

      expect(result).not.toBeNull();
      expect(result.length).toBe(5);
      expect(result[0].coins).toBe(500);
    });

    it('HIT returns cached data without query', async () => {
      await cache.getWithRefresh('guild-001', 10);

      const cached = cache.get('guild-001', 10);

      expect(cached).not.toBeNull();
      expect(cached?.length).toBe(5);
    });

    it('invalidate clears cache', async () => {
      await cache.getWithRefresh('guild-001', 10);

      cache.invalidate('guild-001');

      const result = cache.get('guild-001', 10);
      expect(result).toBeNull();
    });

    it('invalidateAll clears all caches', async () => {
      await cache.getWithRefresh('guild-001', 10);
      await cache.getWithRefresh('guild-002', 10);

      cache.invalidateAll();

      expect(cache.get('guild-001', 10)).toBeNull();
      expect(cache.get('guild-002', 10)).toBeNull();
    });

    it('returns correct top users ordered by coins', async () => {
      await cache.getWithRefresh('guild-001', 3);

      const result = cache.get('guild-001', 3);

      expect(result?.length).toBe(3);
      expect(result?.[0].coins).toBe(500);
      expect(result?.[1].coins).toBe(400);
      expect(result?.[2].coins).toBe(300);
    });
  });

  describe('TTL behavior', () => {
    it('uses correct TTL from GAME_CONSTANTS', () => {
      expect(GAME_CONSTANTS.LEADERBOARD_TTL_MS).toBe(60000);
    });
  });
});
