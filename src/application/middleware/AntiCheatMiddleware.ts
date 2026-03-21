import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext } from '../../types/command.types';

export class AntiCheatMiddleware extends BaseMiddleware {
  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    // Stub: se implementa en R-G con AntiCheatService real
    // Por ahora solo pasa al siguiente middleware
    await next();
  }

  static create(): Middleware {
    return new AntiCheatMiddleware();
  }
}
