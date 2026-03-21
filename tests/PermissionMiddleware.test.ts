import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PermissionMiddleware,
  PermissionMiddlewareContext,
} from '../src/application/middleware/PermissionMiddleware';
import { BotRole } from '../src/domain/players/PermissionService';
import { User } from '../src/types/player.types';
import { BotCommand } from '../src/types/command.types';

const createMockCommand = (requiredRole: BotRole): BotCommand => ({
  name: 'test',
  aliases: [],
  requiredRole:
    requiredRole === BotRole.OWNER
      ? 'OWNER'
      : requiredRole === BotRole.ADMIN
        ? 'ADMIN'
        : requiredRole === BotRole.MODERATOR
          ? 'MODERATOR'
          : requiredRole === BotRole.PLAYER
            ? 'PLAYER'
            : 'BANNED',
  cooldown: 0,
  execute: vi.fn(),
});

const createMockUser = (role: BotRole): User => ({
  id: 'user_001',
  discordId: 'disc_001',
  guildId: 'guild_001',
  coins: 0,
  streak: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMockCtx = (user: User, command: BotCommand): PermissionMiddlewareContext => ({
  userId: user.id,
  discordId: user.discordId,
  guildId: user.guildId,
  channelId: 'channel_001',
  args: [],
  message: null as any,
  reply: vi.fn(),
  user,
  command,
});

describe('PermissionMiddleware', () => {
  describe('PLAYER role restrictions', () => {
    it('blocks PLAYER from executing MODERATOR commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.PLAYER);
      const command = createMockCommand(BotRole.MODERATOR);
      const user = createMockUser(BotRole.PLAYER);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Sin permisos',
              }),
            }),
          ]),
        })
      );
    });

    it('blocks PLAYER from executing ADMIN commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.PLAYER);
      const command = createMockCommand(BotRole.ADMIN);
      const user = createMockUser(BotRole.PLAYER);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('allows PLAYER to execute PLAYER commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.PLAYER);
      const command = createMockCommand(BotRole.PLAYER);
      const user = createMockUser(BotRole.PLAYER);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('MODERATOR role permissions', () => {
    it('allows MODERATOR to execute MODERATOR commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.MODERATOR);
      const command = createMockCommand(BotRole.MODERATOR);
      const user = createMockUser(BotRole.MODERATOR);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows MODERATOR to execute PLAYER commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.MODERATOR);
      const command = createMockCommand(BotRole.PLAYER);
      const user = createMockUser(BotRole.MODERATOR);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks MODERATOR from executing ADMIN commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.MODERATOR);
      const command = createMockCommand(BotRole.ADMIN);
      const user = createMockUser(BotRole.MODERATOR);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('ADMIN role permissions', () => {
    it('allows ADMIN to execute ADMIN commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.ADMIN);
      const command = createMockCommand(BotRole.ADMIN);
      const user = createMockUser(BotRole.ADMIN);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks ADMIN from executing OWNER commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.ADMIN);
      const command = createMockCommand(BotRole.OWNER);
      const user = createMockUser(BotRole.ADMIN);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('OWNER role permissions', () => {
    it('allows OWNER to execute any command', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.OWNER);
      const user = createMockUser(BotRole.OWNER);

      for (const role of [BotRole.PLAYER, BotRole.MODERATOR, BotRole.ADMIN, BotRole.OWNER]) {
        const command = createMockCommand(role);
        const ctx = createMockCtx(user, command);
        const next = vi.fn();

        await middleware.handle(ctx, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('BANNED role', () => {
    it('blocks BANNED from all commands', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.BANNED);
      const command = createMockCommand(BotRole.PLAYER);
      const user = createMockUser(BotRole.BANNED);
      const ctx = createMockCtx(user, command);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('calls next when no command is present', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.PLAYER);
      const user = createMockUser(BotRole.PLAYER);
      const ctx = createMockCtx(user, null as any);
      const next = vi.fn();

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('calls next when no user is present', async () => {
      const middleware = PermissionMiddleware.create(() => BotRole.PLAYER);
      const command = createMockCommand(BotRole.PLAYER);
      const next = vi.fn();

      const ctx: PermissionMiddlewareContext = {
        userId: 'user_001',
        discordId: 'disc_001',
        guildId: 'guild_001',
        channelId: 'channel_001',
        args: [],
        message: null as any,
        reply: vi.fn(),
        user: undefined,
        command,
      };

      await middleware.handle(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
