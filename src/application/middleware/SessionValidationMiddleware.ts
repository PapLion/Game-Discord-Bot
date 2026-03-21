import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext } from '../../types/command.types';

export class SessionValidationMiddleware extends BaseMiddleware {
  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    // Stub: se implementa en R-D cuando BaseGame y GameOrchestrator estén listos
    // Por ahora solo pasa al siguiente middleware
    await next();
  }

  static create(): Middleware {
    return new SessionValidationMiddleware();
  }
}
