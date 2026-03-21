import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext } from '../../types/command.types';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { antiCheatService } from '../../domain/systems/AntiCheatService';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

export class AntiCheatMiddleware extends BaseMiddleware {
  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    const userId = ctx.userId;

    if (antiCheatService.isBanned(userId)) {
      SystemLogger.warn('AntiCheatMiddleware: Blocked banned user', { userId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.warning(
            'You are in timeout for suspicious behavior. Try again in 5 minutes.'
          ),
        ] as any,
      });
      return;
    }

    if (antiCheatService.isSuspicious(userId)) {
      SystemLogger.warn('AntiCheatMiddleware: Blocked suspicious user', { userId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.warning(
            `Suspicious behavior detected. Warning ${antiCheatService.getWarningCount(userId)}/3`
          ),
        ] as any,
      });
      return;
    }

    if (antiCheatService.isTooFast(userId)) {
      const warningCount = antiCheatService.getWarningCount(userId);
      SystemLogger.warn('AntiCheatMiddleware: Fast response warning', { userId, warningCount });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.warning(`Your response was too fast. Warning ${warningCount}/3`),
        ] as any,
      });
      return;
    }

    await next();
  }

  static create(): Middleware {
    return new AntiCheatMiddleware();
  }
}
