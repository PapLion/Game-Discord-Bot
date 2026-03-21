import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CooldownMiddleware,
  CooldownMiddlewareContext,
} from '../src/application/middleware/CooldownMiddleware';
import { BotCommand } from '../src/types/command.types';
import { BotRole } from '../src/domain/players/PermissionService';

const createMockCommand = (name: string, cooldown: number): BotCommand => ({
  name,
  aliases: [],
  requiredRole: BotRole.PLAYER,
  cooldown,
  execute: vi.fn(),
});

const createMockCtx = (userId: string, command: BotCommand): CooldownMiddlewareContext => ({
  userId,
  discordId: 'disc_001',
  guildId: 'guild_001',
  channelId: 'channel_001',
  args: [],
  message: null as any,
  reply: vi.fn(),
  command,
});

describe('CooldownMiddleware', () => {
  describe('first command execution', () => {
    it('allows first command execution', async () => {
      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx = createMockCtx('user_001', command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('cooldown enforcement', () => {
    it('blocks second command within cooldown period', async () => {
      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx1 = createMockCtx('user_001', command);
      const ctx2 = createMockCtx('user_001', command);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);
      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).not.toHaveBeenCalled();
      expect(ctx2.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '⏱️ Cooldown activo',
              }),
            }),
          ]),
        })
      );
    });

    it('allows command after cooldown expires', async () => {
      vi.useFakeTimers();

      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx1 = createMockCtx('user_001', command);
      const ctx2 = createMockCtx('user_001', command);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);

      vi.advanceTimersByTime(2000);

      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('tracks cooldowns separately per command', async () => {
      const middleware = new CooldownMiddleware();
      const command1 = createMockCommand('test1', 2000);
      const command2 = createMockCommand('test2', 2000);
      const ctx1 = createMockCtx('user_001', command1);
      const ctx2 = createMockCtx('user_001', command2);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);
      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });

    it('tracks cooldowns separately per user', async () => {
      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx1 = createMockCtx('user_001', command);
      const ctx2 = createMockCtx('user_002', command);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);
      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('zero cooldown', () => {
    it('allows all executions when cooldown is 0', async () => {
      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 0);
      const ctx1 = createMockCtx('user_001', command);
      const ctx2 = createMockCtx('user_001', command);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);
      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('getRemainingCooldown', () => {
    it('returns 0 when no cooldown is active', () => {
      const middleware = new CooldownMiddleware();
      const remaining = middleware.getRemainingCooldown('user_001', 'test');
      expect(remaining).toBe(0);
    });

    it('returns remaining time when cooldown is active', async () => {
      vi.useFakeTimers();

      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx = createMockCtx('user_001', command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      vi.advanceTimersByTime(500);

      const remaining = middleware.getRemainingCooldown('user_001', 'test');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1500);

      vi.useRealTimers();
    });
  });

  describe('clearCooldown', () => {
    it('clears cooldown for specific user and command', async () => {
      const middleware = new CooldownMiddleware();
      const command = createMockCommand('test', 2000);
      const ctx1 = createMockCtx('user_001', command);
      const ctx2 = createMockCtx('user_001', command);
      const next1 = vi.fn();
      const next2 = vi.fn();

      await middleware.handle(ctx1, next1);
      middleware.clearCooldown('user_001', 'test');
      await middleware.handle(ctx2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('calls next when no command is present', async () => {
      const middleware = new CooldownMiddleware();
      const ctx = createMockCtx('user_001', null as any);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
