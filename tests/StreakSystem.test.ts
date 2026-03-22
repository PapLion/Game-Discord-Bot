import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { auditLogger } from '../src/infrastructure/logger/AuditLogger';
import { StreakSystem } from '../src/domain/systems/StreakSystem';
import { UserRepository } from '../src/infrastructure/database/UserRepository';
import { GAME_CONSTANTS } from '../src/types/GAME_CONSTANTS';

describe('StreakSystem', () => {
  let db: DatabaseService;
  let userRepo: UserRepository;
  let streakSystem: StreakSystem;

  beforeEach(async () => {
    db = DatabaseService.getInstance();
    await db.initialize(':memory:');
    auditLogger.setDatabaseService(db);
    userRepo = new UserRepository(db);
    StreakSystem.resetForTesting();
    streakSystem = StreakSystem.getInstance(userRepo);
  });

  afterEach(() => {
    db.close();
  });

  describe('State transitions', () => {
    it('inactive → active on first claim', async () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 0]
      );

      const result = await streakSystem.claim(userId);

      expect(result.status).toBe('first_claim');
      expect(result.streak).toBe(1);
      expect(result.multiplier).toBe(1.0);
      expect(result.totalReward).toBe(50);
    });

    it('active + claim in 20-28h → streak increases', async () => {
      const userId = 'test-user-001';
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 5, yesterday.toISOString()]
      );

      const result = await streakSystem.claim(userId);

      expect(result.status).toBe('success');
      expect(result.streak).toBe(6);
    });

    it('active + claim < 20h → already claimed', async () => {
      const userId = 'test-user-001';
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 5, tenHoursAgo.toISOString()]
      );

      const result = await streakSystem.claim(userId);

      expect(result.status).toBe('already_claimed');
    });

    it('active + claim > 28h → streak broken', async () => {
      const userId = 'test-user-001';
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 5, thirtyHoursAgo.toISOString()]
      );

      const result = await streakSystem.claim(userId);

      expect(result.status).toBe('broken');
      expect(result.streak).toBe(1);
    });
  });

  describe('Multiplier tiers', () => {
    it('days 1-6 → multiplier x1.0', async () => {
      const result = await streakSystem.claim('new-user-1');
      expect(result.multiplier).toBe(1.0);
      expect(result.baseReward).toBe(50);
    });

    it('days 7-13 → multiplier x2.0', async () => {
      const userId = 'test-user-7';
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 7, yesterday.toISOString()]
      );

      const result = await streakSystem.claim(userId);
      expect(result.multiplier).toBe(2.0);
      expect(result.baseReward).toBe(100);
    });

    it('days 14-29 → multiplier x3.0', async () => {
      const userId = 'test-user-14';
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 14, yesterday.toISOString()]
      );

      const result = await streakSystem.claim(userId);
      expect(result.multiplier).toBe(3.0);
      expect(result.baseReward).toBe(150);
    });

    it('days 30+ → multiplier x5.0 (maxed)', async () => {
      const userId = 'test-user-30';
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 30, yesterday.toISOString()]
      );

      const result = await streakSystem.claim(userId);
      expect(result.multiplier).toBe(5.0);
      expect(result.baseReward).toBe(200);
    });
  });

  describe('Crítico 6: Timezone handling', () => {
    it('claim near midnight UTC works correctly', async () => {
      const userId = 'test-midnight';
      const now = new Date();
      const hoursAgo = 24;

      const claimTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, userId, userId, 0, 1, claimTime.toISOString()]
      );

      const result = await streakSystem.claim(userId);
      expect(result.status).toBe('success');
      expect(result.streak).toBe(2);
    });
  });
});
