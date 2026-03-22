import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext, BotCommand } from '../../types/command.types';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { BotRole, hasPermission, getRoleName } from '../../domain/players/PermissionService';
import { User } from '../../types/player.types';

export interface PermissionMiddlewareContext extends CommandContext {
  user?: User;
  command?: BotCommand;
}

export interface PermissionMiddlewareDeps {
  getUserRole: (user: User, guild?: import('discord.js').Guild) => Promise<BotRole> | BotRole;
}

const parseRoleString = (roleStr: string): BotRole => {
  const upper = roleStr.toUpperCase();
  switch (upper) {
    case 'OWNER':
      return BotRole.OWNER;
    case 'ADMIN':
      return BotRole.ADMIN;
    case 'MODERATOR':
      return BotRole.MODERATOR;
    case 'PLAYER':
      return BotRole.PLAYER;
    case 'BANNED':
      return BotRole.BANNED;
    default:
      const num = parseInt(roleStr, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        return num as BotRole;
      }
      return BotRole.PLAYER;
  }
};

export class PermissionMiddleware extends BaseMiddleware {
  private getUserRole: (
    user: User,
    guild?: import('discord.js').Guild
  ) => Promise<BotRole> | BotRole;

  constructor(deps: PermissionMiddlewareDeps) {
    super();
    this.getUserRole = deps.getUserRole;
  }

  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    const extendedCtx = ctx as PermissionMiddlewareContext;
    const command = extendedCtx.command;

    if (!command) {
      await next();
      return;
    }

    const user = extendedCtx.user;
    if (!user) {
      await next();
      return;
    }

    const guild = ctx.message?.guild ?? undefined;
    const userRole = await this.getUserRole(user, guild);
    const requiredRole = command.requiredRole;

    if (!hasPermission(userRole, requiredRole)) {
      const requiredRoleName = getRoleName(requiredRole);
      const embed = EmbedFactory.noPermission(requiredRoleName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({ embeds: [embed as any] });
      return;
    }

    await next();
  }

  static create(
    getUserRole: (user: User, guild?: import('discord.js').Guild) => Promise<BotRole> | BotRole
  ): Middleware {
    return new PermissionMiddleware({ getUserRole });
  }
}
