import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext } from '../../types/command.types';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { GameOrchestrator } from '../orchestrator/GameOrchestrator';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

const SESSION_REQUIRED_COMMANDS = ['play', 'join'];

export class SessionValidationMiddleware extends BaseMiddleware {
  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    const commandName = ctx.args[0]?.toLowerCase() ?? '';
    const requiresSession = SESSION_REQUIRED_COMMANDS.includes(commandName);

    if (!requiresSession) {
      await next();
      return;
    }

    const orchestrator = GameOrchestrator.getInstance();
    const activeSession = orchestrator.getActiveSession(ctx.guildId);

    if (!activeSession) {
      SystemLogger.debug('SessionValidationMiddleware: No active session', {
        guildId: ctx.guildId,
        command: commandName,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error('No active game in this server', 'Wait for an admin to start a game'),
        ] as any,
      });
      return;
    }

    await next();
  }

  static create(): Middleware {
    return new SessionValidationMiddleware();
  }
}
