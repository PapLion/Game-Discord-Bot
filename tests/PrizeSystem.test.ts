import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { auditLogger } from '../src/infrastructure/logger/AuditLogger';
import { PrizeRepository } from '../src/domain/prizes/PrizeRepository';
import { CoinsAdapter } from '../src/domain/prizes/adapters/CoinsAdapter';
import { BadgeAdapter } from '../src/domain/prizes/adapters/BadgeAdapter';
import { RedeemCodeService } from '../src/domain/systems/RedeemCodeService';
import { UserRepository } from '../src/infrastructure/database/UserRepository';
import type { TextChannel } from 'discord.js';

describe('PrizeSystem', () => {
  let db: DatabaseService;
  let prizeRepo: PrizeRepository;
  let coinsAdapter: CoinsAdapter;
  let badgeAdapter: BadgeAdapter;
  let redeemService: RedeemCodeService;
  let userRepo: UserRepository;

  beforeEach(async () => {
    db = DatabaseService.getInstance();
    await db.initialize(':memory:');
    auditLogger.setDatabaseService(db);

    prizeRepo = new PrizeRepository(db);
    coinsAdapter = new CoinsAdapter();
    badgeAdapter = new BadgeAdapter();
    redeemService = new RedeemCodeService();
    userRepo = new UserRepository(db);

    const userId = 'test-user-001';
    db.execute(
      `INSERT INTO users (id, discord_id, guild_id, coins, streak, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [userId, 'discord-001', 'guild-001', 0, 0]
    );
  });

  afterEach(() => {
    db.close();
  });

  describe('CoinsAdapter', () => {
    it('delivers coins to user balance', async () => {
      const userId = 'test-user-001';
      const initialUser = await userRepo.findByDiscordId('discord-001', 'guild-001');
      expect(initialUser?.coins).toBe(0);

      const prize = {
        id: '1',
        name: '100 Coins',
        type: 'coins' as const,
        value: '100',
        rarity: 'common' as const,
      };
      await coinsAdapter.deliver(userId, prize);

      const updatedUser = await userRepo.findByDiscordId('discord-001', 'guild-001');
      expect(updatedUser?.coins).toBe(100);
    });

    it('canDeliver always returns true for coins', async () => {
      const prize = {
        id: '1',
        name: 'Test',
        type: 'coins' as const,
        value: '100',
        rarity: 'common' as const,
      };
      const result = await coinsAdapter.canDeliver('user-id', prize);
      expect(result).toBe(true);
    });
  });

  describe('BadgeAdapter', () => {
    it('inserts badge into inventory', async () => {
      const userId = 'test-user-001';
      const prize = {
        id: '1',
        name: 'Test Badge',
        type: 'badge' as const,
        value: 'badge-001',
        rarity: 'rare' as const,
      };

      await badgeAdapter.deliver(userId, prize);

      const items = db.run<{ id: string; user_id: string; item_type: string; item_id: string }>(
        'SELECT * FROM inventory WHERE user_id = ?',
        [userId]
      );

      expect(items.length).toBe(1);
      expect(items[0].item_type).toBe('badge');
      expect(items[0].item_id).toBe('badge-001');
    });
  });

  describe('RedeemCodeService — Optimistic Locking', () => {
    it('claims a redeem code successfully', async () => {
      db.execute(
        `INSERT INTO redeem_codes (id, code, status, version, created_at)
         VALUES (?, ?, 'available', 0, datetime('now'))`,
        ['code-001', 'CODE123']
      );

      const result = await redeemService.claimCodeForUser('test-user-001');

      expect(result.success).toBe(true);
      expect(result.code).toBe('CODE123');
      expect(result.codeId).toBe('code-001');

      const code = db.runOne<{ status: string; claimed_by: string }>(
        'SELECT status, claimed_by FROM redeem_codes WHERE id = ?',
        ['code-001']
      );
      expect(code?.status).toBe('claimed');
      expect(code?.claimed_by).toBe('test-user-001');
    });

    it('Crítico 2: concurrent claims — only one wins', async () => {
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        ['user-1', 'discord-user1', 'guild-001', 0, 0]
      );
      db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        ['user-2', 'discord-user2', 'guild-001', 0, 0]
      );

      db.execute(
        `INSERT INTO redeem_codes (id, code, status, version, created_at)
         VALUES (?, ?, 'available', 0, datetime('now'))`,
        ['code-race-001', 'RACECODE']
      );

      const claim1 = await redeemService.claimCodeForUser('user-1');
      const claim2 = await redeemService.claimCodeForUser('user-2');

      const successClaims = [claim1, claim2].filter(r => r.success && !r.fallbackUsed);
      expect(successClaims.length).toBe(1);

      const fallbackClaims = [claim1, claim2].filter(r => r.fallbackUsed);
      expect(fallbackClaims.length).toBe(1);
      expect(fallbackClaims[0].fallbackAmount).toBe(100);
    });

    it('Crítico 8: no codes available → fallback coins', async () => {
      const userId = 'test-user-001';
      const initialUser = await userRepo.findByDiscordId('discord-001', 'guild-001');
      expect(initialUser?.coins).toBe(0);

      const result = await redeemService.claimCodeForUser(userId);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.fallbackAmount).toBe(100);

      const updatedUser = await userRepo.findByDiscordId('discord-001', 'guild-001');
      expect(updatedUser?.coins).toBe(100);
    });

    it('version increments after claim', async () => {
      db.execute(
        `INSERT INTO redeem_codes (id, code, status, version, created_at)
         VALUES (?, ?, 'available', 5, datetime('now'))`,
        ['code-002', 'VERSIONTEST']
      );

      const result = await redeemService.claimCodeForUser('test-user-001');
      expect(result.success).toBe(true);

      const code = db.runOne<{ version: number }>('SELECT version FROM redeem_codes WHERE id = ?', [
        'code-002',
      ]);
      expect(code?.version).toBe(6);
    });
  });

  describe('PrizeRepository', () => {
    it('finds pending prizes for user', () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO pending_prizes (id, user_id, prize_type, prize_value, status, created_at)
         VALUES (?, ?, 'coins', '100', 'pending', datetime('now'))`,
        ['pending-001', userId]
      );

      const pending = prizeRepo.findPendingByUser(userId);
      expect(pending.length).toBe(1);
      expect(pending[0].prize_type).toBe('coins');
      expect(pending[0].status).toBe('pending');
    });

    it('marks prize as claimed', () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO pending_prizes (id, user_id, prize_type, prize_value, status, created_at)
         VALUES (?, ?, 'coins', '100', 'pending', datetime('now'))`,
        ['pending-002', userId]
      );

      prizeRepo.markAsClaimed('pending-002');

      const prize = prizeRepo.findById('pending-002');
      expect(prize?.status).toBe('claimed');
      expect(prize?.claimed_at).not.toBeNull();
    });

    it('increments attempts on failure', () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO pending_prizes (id, user_id, prize_type, prize_value, status, attempts, created_at)
         VALUES (?, ?, 'coins', '100', 'pending', 0, datetime('now'))`,
        ['pending-003', userId]
      );

      prizeRepo.incrementAttempts('pending-003');

      const prize = prizeRepo.findById('pending-003');
      expect(prize?.attempts).toBe(1);
    });

    it('marks prize as failed after max attempts', () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO pending_prizes (id, user_id, prize_type, prize_value, status, attempts, created_at)
         VALUES (?, ?, 'coins', '100', 'pending', 3, datetime('now'))`,
        ['pending-004', userId]
      );

      prizeRepo.markAsFailed('pending-004');

      const prize = prizeRepo.findById('pending-004');
      expect(prize?.status).toBe('failed');
    });
  });

  describe('Crítico 9: AuditLogger — Prize Actions', () => {
    it('logs prize_awarded when coins delivered', async () => {
      const userId = 'test-user-001';
      const prize = {
        id: '1',
        name: '100 Coins',
        type: 'coins' as const,
        value: '100',
        rarity: 'common' as const,
      };
      await coinsAdapter.deliver(userId, prize);

      const auditLogs = db.run<{ action: string; target_id: string }>(
        "SELECT action, target_id FROM audit_log WHERE action = 'prize_awarded'"
      );

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.some(log => log.target_id === userId)).toBe(true);
    });

    it('logs prize_awarded when badge delivered', async () => {
      const userId = 'test-user-001';
      const prize = {
        id: '1',
        name: 'Test Badge',
        type: 'badge' as const,
        value: 'badge-001',
        rarity: 'rare' as const,
      };
      await badgeAdapter.deliver(userId, prize);

      const auditLogs = db.run<{ action: string; target_id: string }>(
        "SELECT action, target_id FROM audit_log WHERE action = 'prize_awarded'"
      );

      const badgeLogs = auditLogs.filter(log => log.target_id === userId);
      expect(badgeLogs.length).toBeGreaterThan(0);
    });

    it('logs code_claimed when redeem code claimed via RedeemAdapter', async () => {
      db.execute(
        `INSERT INTO redeem_codes (id, code, status, version, created_at)
         VALUES (?, ?, 'available', 0, datetime('now'))`,
        ['audit-code-001', 'AUDITCODE']
      );

      const { RedeemAdapter } = await import('../src/domain/prizes/adapters/RedeemAdapter');
      const redeemAdapter = new RedeemAdapter();
      const prize = {
        id: '1',
        name: 'Redeem Code',
        type: 'redeem' as const,
        value: 'CODE',
        rarity: 'common' as const,
      };
      await redeemAdapter.deliver('test-user-001', prize);

      const auditLogs = db.run<{ action: string; target_id: string }>(
        "SELECT action, target_id FROM audit_log WHERE action = 'code_claimed'"
      );

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].target_id).toBe('audit-code-001');
    });

    it('logs prize_claimed when PrizeSystem claims prize', async () => {
      const userId = 'test-user-001';
      db.execute(
        `INSERT INTO pending_prizes (id, user_id, prize_type, prize_value, status, created_at)
         VALUES (?, ?, 'coins', '100', 'pending', datetime('now'))`,
        ['audit-pending-001', userId]
      );

      const { PrizeSystem } = await import('../src/domain/prizes/PrizeSystem');
      const prizeSystem = new PrizeSystem();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({}),
      } as unknown as TextChannel;

      await prizeSystem.claimPending(userId, mockChannel);

      const auditLogs = db.run<{ action: string; target_id: string }>(
        "SELECT action, target_id FROM audit_log WHERE action = 'prize_claimed'"
      );

      expect(auditLogs.some(log => log.target_id === 'audit-pending-001')).toBe(true);
    });
  });
});
