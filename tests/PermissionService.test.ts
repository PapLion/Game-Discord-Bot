import { describe, it, expect } from 'vitest';
import {
  BotRole,
  hasPermission,
  canStartGame,
  getRoleFromDiscordRoles,
  getRoleName,
  ROLE_HIERARCHY,
} from '../src/domain/players/PermissionService';

describe('PermissionService', () => {
  describe('BotRole enum', () => {
    it('has correct hierarchy values', () => {
      expect(BotRole.OWNER).toBe(5);
      expect(BotRole.ADMIN).toBe(4);
      expect(BotRole.MODERATOR).toBe(3);
      expect(BotRole.PLAYER).toBe(2);
      expect(BotRole.BANNED).toBe(1);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('is ordered from lowest to highest privilege', () => {
      expect(ROLE_HIERARCHY).toEqual([
        BotRole.BANNED,
        BotRole.PLAYER,
        BotRole.MODERATOR,
        BotRole.ADMIN,
        BotRole.OWNER,
      ]);
    });
  });

  describe('hasPermission', () => {
    it('PLAYER can execute PLAYER commands', () => {
      expect(hasPermission(BotRole.PLAYER, BotRole.PLAYER)).toBe(true);
    });

    it('PLAYER cannot execute MODERATOR commands', () => {
      expect(hasPermission(BotRole.PLAYER, BotRole.MODERATOR)).toBe(false);
    });

    it('MODERATOR can execute PLAYER commands', () => {
      expect(hasPermission(BotRole.MODERATOR, BotRole.PLAYER)).toBe(true);
    });

    it('MODERATOR can execute MODERATOR commands', () => {
      expect(hasPermission(BotRole.MODERATOR, BotRole.MODERATOR)).toBe(true);
    });

    it('MODERATOR cannot execute ADMIN commands', () => {
      expect(hasPermission(BotRole.MODERATOR, BotRole.ADMIN)).toBe(false);
    });

    it('ADMIN can execute MODERATOR commands', () => {
      expect(hasPermission(BotRole.ADMIN, BotRole.MODERATOR)).toBe(true);
    });

    it('ADMIN cannot execute OWNER commands', () => {
      expect(hasPermission(BotRole.ADMIN, BotRole.OWNER)).toBe(false);
    });

    it('OWNER can execute any command', () => {
      expect(hasPermission(BotRole.OWNER, BotRole.ADMIN)).toBe(true);
      expect(hasPermission(BotRole.OWNER, BotRole.MODERATOR)).toBe(true);
      expect(hasPermission(BotRole.OWNER, BotRole.PLAYER)).toBe(true);
    });

    it('BANNED cannot execute any command', () => {
      expect(hasPermission(BotRole.BANNED, BotRole.PLAYER)).toBe(false);
      expect(hasPermission(BotRole.BANNED, BotRole.MODERATOR)).toBe(false);
    });
  });

  describe('canStartGame', () => {
    it('returns true for MODERATOR', () => {
      expect(canStartGame(BotRole.MODERATOR)).toBe(true);
    });

    it('returns true for ADMIN', () => {
      expect(canStartGame(BotRole.ADMIN)).toBe(true);
    });

    it('returns true for OWNER', () => {
      expect(canStartGame(BotRole.OWNER)).toBe(true);
    });

    it('returns false for PLAYER', () => {
      expect(canStartGame(BotRole.PLAYER)).toBe(false);
    });

    it('returns false for BANNED', () => {
      expect(canStartGame(BotRole.BANNED)).toBe(false);
    });
  });

  describe('getRoleFromDiscordRoles', () => {
    it('returns OWNER for SERVER_OWNER', () => {
      expect(getRoleFromDiscordRoles(['SERVER_OWNER'])).toBe(BotRole.OWNER);
    });

    it('returns OWNER for OWNER_ROLE', () => {
      expect(getRoleFromDiscordRoles(['OWNER_ROLE'])).toBe(BotRole.OWNER);
    });

    it('returns ADMIN for ADMIN', () => {
      expect(getRoleFromDiscordRoles(['ADMIN'])).toBe(BotRole.ADMIN);
    });

    it('returns ADMIN for ADMIN_ROLE', () => {
      expect(getRoleFromDiscordRoles(['ADMIN_ROLE'])).toBe(BotRole.ADMIN);
    });

    it('returns MODERATOR for MODERATOR', () => {
      expect(getRoleFromDiscordRoles(['MODERATOR'])).toBe(BotRole.MODERATOR);
    });

    it('returns MODERATOR for MOD', () => {
      expect(getRoleFromDiscordRoles(['MOD'])).toBe(BotRole.MODERATOR);
    });

    it('returns BANNED for BANNED', () => {
      expect(getRoleFromDiscordRoles(['BANNED'])).toBe(BotRole.BANNED);
    });

    it('returns PLAYER when no role matches', () => {
      expect(getRoleFromDiscordRoles(['RANDOM_ROLE'])).toBe(BotRole.PLAYER);
    });

    it('returns PLAYER for empty array', () => {
      expect(getRoleFromDiscordRoles([])).toBe(BotRole.PLAYER);
    });
  });

  describe('getRoleName', () => {
    it('returns correct names for each role', () => {
      expect(getRoleName(BotRole.OWNER)).toBe('Owner');
      expect(getRoleName(BotRole.ADMIN)).toBe('Admin');
      expect(getRoleName(BotRole.MODERATOR)).toBe('Moderator');
      expect(getRoleName(BotRole.PLAYER)).toBe('Player');
      expect(getRoleName(BotRole.BANNED)).toBe('Banned');
    });
  });
});
