import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    dbService = DatabaseService.getInstance();
  });

  afterEach(() => {
    dbService.close();
  });

  describe('Singleton Pattern', () => {
    it('getInstance() returns the same instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('returns the same instance across multiple calls', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      const instance3 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('initialize()', () => {
    it('creates all 12 tables on initialization', async () => {
      await dbService.initialize(':memory:');

      const tables = dbService.run<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('game_sessions');
      expect(tableNames).toContain('participation');
      expect(tableNames).toContain('game_winners');
      expect(tableNames).toContain('inventory');
      expect(tableNames).toContain('badges');
      expect(tableNames).toContain('virtual_items');
      expect(tableNames).toContain('special_access');
      expect(tableNames).toContain('prizes');
      expect(tableNames).toContain('pending_prizes');
      expect(tableNames).toContain('redeem_codes');
      expect(tableNames).toContain('audit_log');
      expect(tableNames).toContain('guild_config');
      expect(tableNames).toContain('custom_games');
    });

    it('creates all required indexes', async () => {
      await dbService.initialize(':memory:');

      const indexes = dbService.run<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      );

      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_users_discord_guild');
      expect(indexNames).toContain('idx_participation_session');
      expect(indexNames).toContain('idx_participation_user');
      expect(indexNames).toContain('idx_game_winners_user');
      expect(indexNames).toContain('idx_game_winners_type');
      expect(indexNames).toContain('idx_inventory_user');
      expect(indexNames).toContain('idx_pending_prizes_user');
      expect(indexNames).toContain('idx_pending_prizes_status');
      expect(indexNames).toContain('idx_audit_log_actor');
      expect(indexNames).toContain('idx_game_sessions_guild');
      expect(indexNames).toContain('idx_special_access_user');
    });

    it('isInitialized() returns true after init', async () => {
      expect(dbService.isInitialized()).toBe(false);
      await dbService.initialize(':memory:');
      expect(dbService.isInitialized()).toBe(true);
    });
  });

  describe('Prepared Statements', () => {
    it('prevents SQL injection in queries', async () => {
      await dbService.initialize(':memory:');

      const maliciousInput = "'; DROP TABLE users; --";
      const result = dbService.run('SELECT * FROM users WHERE discord_id = ? AND guild_id = ?', [
        maliciousInput,
        'test_guild',
      ]);

      expect(result).toEqual([]);
      const tables = dbService.run<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      expect(tables.length).toBeGreaterThan(0);
    });

    it('runs parameterized queries correctly', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        100,
      ]);

      const user = dbService.runOne<{
        id: string;
        discord_id: string;
        guild_id: string;
        coins: number;
      }>('SELECT * FROM users WHERE discord_id = ?', ['disc_001']);

      expect(user).toBeDefined();
      expect(user?.coins).toBe(100);
      expect(user?.guild_id).toBe('guild_001');
    });
  });

  describe('run() and runOne()', () => {
    it('run() returns array of results', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        50,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_002',
        'disc_002',
        'guild_001',
        75,
      ]);

      const users = dbService.run<{
        id: string;
        discord_id: string;
        coins: number;
      }>('SELECT * FROM users');

      expect(users).toHaveLength(2);
      expect(users[0].coins).toBe(50);
      expect(users[1].coins).toBe(75);
    });

    it('runOne() returns single result or undefined', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        100,
      ]);

      const found = dbService.runOne('SELECT * FROM users WHERE discord_id = ?', ['disc_001']);
      expect(found).toBeDefined();

      const notFound = dbService.runOne('SELECT * FROM users WHERE discord_id = ?', [
        'nonexistent',
      ]);
      expect(notFound).toBeUndefined();
    });
  });

  describe('execute()', () => {
    it('inserts data and returns affected rows', async () => {
      await dbService.initialize(':memory:');

      const result = dbService.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`,
        ['user_001', 'disc_001', 'guild_001', 100]
      );

      expect(result.changes).toBe(1);
    });

    it('updates data correctly', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        100,
      ]);

      const result = dbService.execute('UPDATE users SET coins = ? WHERE discord_id = ?', [
        200,
        'disc_001',
      ]);

      expect(result.changes).toBe(1);

      const user = dbService.runOne<{ coins: number }>(
        'SELECT coins FROM users WHERE discord_id = ?',
        ['disc_001']
      );
      expect(user?.coins).toBe(200);
    });

    it('deletes data correctly', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        100,
      ]);

      const result = dbService.execute('DELETE FROM users WHERE discord_id = ?', ['disc_001']);

      expect(result.changes).toBe(1);
      const user = dbService.runOne('SELECT * FROM users WHERE discord_id = ?', ['disc_001']);
      expect(user).toBeUndefined();
    });
  });

  describe('transaction()', () => {
    it('rolls back on error', async () => {
      await dbService.initialize(':memory:');

      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user_001',
        'disc_001',
        'guild_001',
        100,
      ]);

      expect(() => {
        dbService.transaction(() => {
          dbService.execute('UPDATE users SET coins = ? WHERE discord_id = ?', [200, 'disc_001']);
          throw new Error('Simulated error');
        });
      }).toThrow();

      const user = dbService.runOne<{ coins: number }>(
        'SELECT coins FROM users WHERE discord_id = ?',
        ['disc_001']
      );
      expect(user?.coins).toBe(100);
    });

    it('commits on success', async () => {
      await dbService.initialize(':memory:');

      dbService.transaction(() => {
        dbService.execute(
          `INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`,
          ['user_001', 'disc_001', 'guild_001', 100]
        );
        dbService.execute(
          `INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`,
          ['user_002', 'disc_002', 'guild_001', 200]
        );
      });

      const users = dbService.run('SELECT * FROM users');
      expect(users).toHaveLength(2);
    });
  });

  describe('close()', () => {
    it('resets initialized state', async () => {
      await dbService.initialize(':memory:');
      expect(dbService.isInitialized()).toBe(true);

      dbService.close();
      expect(dbService.isInitialized()).toBe(false);
    });
  });
});
