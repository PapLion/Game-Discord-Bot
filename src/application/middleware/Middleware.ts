import { CommandContext } from '../../types/command.types';

export interface Middleware {
  handle(ctx: CommandContext, next: () => Promise<void>): Promise<void>;
}

export abstract class BaseMiddleware implements Middleware {
  abstract handle(ctx: CommandContext, next: () => Promise<void>): Promise<void>;
}
