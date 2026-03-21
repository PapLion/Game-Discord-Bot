import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext, BotCommand } from '../../types/command.types';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';

export interface CooldownMiddlewareContext extends CommandContext {
  command?: BotCommand;
}

export class CooldownMiddleware extends BaseMiddleware {
  private cooldowns: Map<string, number> = new Map();

  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    const extendedCtx = ctx as CooldownMiddlewareContext;
    const command = extendedCtx.command;

    if (!command) {
      await next();
      return;
    }

    const cooldown = command.cooldown;
    if (cooldown <= 0) {
      await next();
      return;
    }

    const key = `${ctx.userId}:${command.name}`;
    const lastUsed = this.cooldowns.get(key);
    const now = Date.now();

    if (lastUsed !== undefined) {
      const elapsed = now - lastUsed;
      if (elapsed < cooldown) {
        const remaining = cooldown - elapsed;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({ embeds: [EmbedFactory.cooldown(remaining) as any] });
        return;
      }
    }

    this.cooldowns.set(key, now);
    await next();
  }

  getRemainingCooldown(userId: string, commandName: string): number {
    const key = `${userId}:${commandName}`;
    const lastUsed = this.cooldowns.get(key);
    if (lastUsed === undefined) return 0;
    return Math.max(0, lastUsed + 2000 - Date.now());
  }

  clearCooldown(userId: string, commandName: string): void {
    this.cooldowns.delete(`${userId}:${commandName}`);
  }

  static create(): Middleware {
    return new CooldownMiddleware();
  }
}
