import { describe, it, expect, beforeEach } from 'vitest';
import { AntiCheatService } from '../src/domain/systems/AntiCheatService';
import { GAME_CONSTANTS } from '../src/types/GAME_CONSTANTS';

describe('AntiCheatService', () => {
  let antiCheat: AntiCheatService;

  beforeEach(() => {
    antiCheat = new AntiCheatService();
  });

  describe('Speed detection', () => {
    it('response < 80ms is rejected', () => {
      const userId = 'fast-user';
      const now = Date.now();

      const result1 = antiCheat.recordResponse(userId, now);
      expect(result1).toBe(true);

      const result2 = antiCheat.recordResponse(userId, now + 50);
      expect(result2).toBe(false);
    });

    it('response >= 80ms is accepted', () => {
      const userId = 'normal-user';
      const now = Date.now();

      const result1 = antiCheat.recordResponse(userId, now);
      expect(result1).toBe(true);

      const result2 = antiCheat.recordResponse(userId, now + 100);
      expect(result2).toBe(true);
    });

    it('isTooFast returns true for fast responses', () => {
      const userId = 'fast-user';
      const now = Date.now();

      antiCheat.recordResponse(userId, now);
      antiCheat.recordResponse(userId, now + 50);
      antiCheat.recordResponse(userId, now + 100);

      expect(antiCheat.isTooFast(userId)).toBe(true);
    });
  });

  describe('Flagging system', () => {
    it('single flag does not block user', () => {
      const userId = 'user-1';
      antiCheat.flagSuspicious(userId, 'Test reason 1');

      expect(antiCheat.isSuspicious(userId)).toBe(false);
      expect(antiCheat.getWarningCount(userId)).toBe(1);
    });

    it('3 flags triggers ban', () => {
      const userId = 'user-3';
      antiCheat.flagSuspicious(userId, 'Test reason 1');
      antiCheat.flagSuspicious(userId, 'Test reason 2');
      antiCheat.flagSuspicious(userId, 'Test reason 3');

      expect(antiCheat.isSuspicious(userId)).toBe(true);
      expect(antiCheat.isBanned(userId)).toBe(true);
    });
  });

  describe('Ban system', () => {
    it('banned user is blocked', () => {
      const userId = 'banned-user';
      antiCheat.flagSuspicious(userId, 'Reason 1');
      antiCheat.flagSuspicious(userId, 'Reason 2');
      antiCheat.flagSuspicious(userId, 'Reason 3');

      expect(antiCheat.isBanned(userId)).toBe(true);
    });

    it('resetUser clears all data', () => {
      const userId = 'user-reset';
      antiCheat.flagSuspicious(userId, 'Reason 1');
      antiCheat.flagSuspicious(userId, 'Reason 2');
      antiCheat.recordResponse(userId, Date.now());

      antiCheat.resetUser(userId);

      expect(antiCheat.isSuspicious(userId)).toBe(false);
      expect(antiCheat.isBanned(userId)).toBe(false);
      expect(antiCheat.getWarningCount(userId)).toBe(0);
    });
  });

  describe('Crítico 4: Inhumane detection', () => {
    it('detects response < MIN_REACTION_MS', () => {
      const userId = 'cheater';
      const now = Date.now();

      expect(GAME_CONSTANTS.MIN_REACTION_MS).toBe(80);

      for (let i = 0; i < 10; i++) {
        antiCheat.recordResponse(userId, now + i * 50);
      }

      expect(antiCheat.isTooFast(userId)).toBe(true);
    });
  });
});
