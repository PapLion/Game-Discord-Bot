import { BaseMiddleware, Middleware } from './Middleware';
import { CommandContext } from '../../types/command.types';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';

const WINDOW_MS = 60 * 1000;
const MAX_COMMANDS_PER_GUILD = 30;

interface GuildRateData {
  timestamps: number[];
}

export class RateLimitMiddleware extends BaseMiddleware {
  private static instance: RateLimitMiddleware;
  private guildWindows: Map<string, GuildRateData> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): RateLimitMiddleware {
    if (!RateLimitMiddleware.instance) {
      RateLimitMiddleware.instance = new RateLimitMiddleware();
    }
    return RateLimitMiddleware.instance;
  }

  async handle(ctx: CommandContext, next: () => Promise<void>): Promise<void> {
    const guildId = ctx.guildId;
    if (guildId === 'dm') {
      await next();
      return;
    }

    const now = Date.now();
    let guildData = this.guildWindows.get(guildId);

    if (!guildData) {
      guildData = { timestamps: [] };
      this.guildWindows.set(guildId, guildData);
    }

    guildData.timestamps = guildData.timestamps.filter(ts => now - ts < WINDOW_MS);

    if (guildData.timestamps.length >= MAX_COMMANDS_PER_GUILD) {
      const retryAfter = Math.ceil((guildData.timestamps[0] + WINDOW_MS - now) / 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.warning(
            `Too many commands from this server. Retry in ${retryAfter}s.`
          ) as any,
        ],
      });
      return;
    }

    guildData.timestamps.push(now);
    await next();
  }

  resetGuild(guildId: string): void {
    this.guildWindows.delete(guildId);
  }

  clear(): void {
    this.guildWindows.clear();
  }
}
