import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { UserRepository } from '../src/infrastructure/database/UserRepository';

describe('UserRepository', () => {
  let dbService: DatabaseService;
  let userRepo: UserRepository;

  beforeEach(async () => {
    dbService = DatabaseService.getInstance();
    await dbService.initialize(':memory:');
    userRepo = new UserRepository(dbService);
  });

  afterEach(() => {
    dbService.close();
  });

  describe('findByDiscordId', () => {
    it('returns null when user does not exist', async () => {
      const user = await userRepo.findByDiscordId('nonexistent', 'guild_001');
      expect(user).toBeNull();
    });

    it('returns user when exists', async () => {
      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
        streak: 5,
      });

      const user = await userRepo.findByDiscordId('disc_001', 'guild_001');
      expect(user).not.toBeNull();
      expect(user?.discordId).toBe('disc_001');
      expect(user?.guildId).toBe('guild_001');
      expect(user?.coins).toBe(100);
      expect(user?.streak).toBe(5);
    });

    it('is scoped by guildId', async () => {
      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
      });

      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_002',
        coins: 200,
      });

      const user1 = await userRepo.findByDiscordId('disc_001', 'guild_001');
      const user2 = await userRepo.findByDiscordId('disc_001', 'guild_002');

      expect(user1?.coins).toBe(100);
      expect(user2?.coins).toBe(200);
    });
  });

  describe('upsert', () => {
    it('creates new user with default values', async () => {
      const user = await userRepo.upsert({
        discordId: 'disc_new',
        guildId: 'guild_001',
      });

      expect(user.discordId).toBe('disc_new');
      expect(user.guildId).toBe('guild_001');
      expect(user.coins).toBe(0);
      expect(user.streak).toBe(0);
    });

    it('updates existing user', async () => {
      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
        streak: 5,
      });

      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 200,
      });

      const user = await userRepo.findByDiscordId('disc_001', 'guild_001');
      expect(user?.coins).toBe(200);
      expect(user?.streak).toBe(5);
    });

    it('generates id if not provided', async () => {
      const user = await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
      });

      expect(user.id).toBeDefined();
      expect(user.id.length).toBeGreaterThan(0);
    });
  });

  describe('findOrCreate', () => {
    it('creates user if does not exist', async () => {
      const user = await userRepo.findOrCreate('disc_new', 'guild_001');

      expect(user.discordId).toBe('disc_new');
      expect(user.guildId).toBe('guild_001');
      expect(user.coins).toBe(0);
    });

    it('returns existing user if exists', async () => {
      await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
      });

      const user = await userRepo.findOrCreate('disc_001', 'guild_001');

      expect(user.coins).toBe(100);
    });
  });

  describe('updateCoins', () => {
    it('adds coins to user balance', async () => {
      const user = await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
      });

      await userRepo.updateCoins(user.id, 50);

      const updated = await userRepo.findByDiscordId('disc_001', 'guild_001');
      expect(updated?.coins).toBe(150);
    });

    it('handles negative amounts', async () => {
      const user = await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        coins: 100,
      });

      await userRepo.updateCoins(user.id, -30);

      const updated = await userRepo.findByDiscordId('disc_001', 'guild_001');
      expect(updated?.coins).toBe(70);
    });
  });

  describe('updateStreak', () => {
    it('updates streak and lastDaily', async () => {
      const user = await userRepo.upsert({
        discordId: 'disc_001',
        guildId: 'guild_001',
        streak: 5,
      });

      const now = new Date();
      await userRepo.updateStreak(user.id, 6, now);

      const updated = await userRepo.findByDiscordId('disc_001', 'guild_001');
      expect(updated?.streak).toBe(6);
      expect(updated?.lastDaily).toBeDefined();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('prevents SQL injection in discordId', async () => {
      const maliciousId = "'; DROP TABLE users; --";

      await userRepo.findOrCreate(maliciousId, 'guild_001');

      const tables = dbService.run<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      expect(tables.length).toBeGreaterThan(0);
    });

    it('prevents SQL injection in guildId', async () => {
      const maliciousGuild = "'; DROP TABLE users; --";

      await userRepo.findOrCreate('disc_001', maliciousGuild);

      const tables = dbService.run<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      expect(tables.length).toBeGreaterThan(0);
    });
  });
});
