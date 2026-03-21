import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { leaderboardCache } from '../../../infrastructure/cache/LeaderboardCache';

export class LeaderboardCommand implements BotCommand {
  name = 'leaderboard';
  aliases = ['top', 'ranking', 'lb'];
  requiredRole = BotRole.PLAYER;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const startTime = Date.now();
      const entries = await leaderboardCache.getWithRefresh(ctx.guildId, 10);
      const responseTime = Date.now() - startTime;

      const leaderboardEntries = entries.map((entry, index) => ({
        position: index + 1,
        mention: `<@${entry.discordId}>`,
        value: entry.coins,
      }));

      const timeAgo = this.formatTimeAgo(responseTime);

      await ctx.reply({
        embeds: [
          EmbedFactory.leaderboard({
            entries: leaderboardEntries,
            updatedAgo: timeAgo,
          }) as unknown as import('discord.js').APIEmbed,
        ],
      });

      SystemLogger.debug('LeaderboardCommand executed', {
        guildId: ctx.guildId,
        responseTimeMs: responseTime,
        entries: entries.length,
      });
    } catch (error) {
      SystemLogger.error('LeaderboardCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'No pudimos mostrar el ranking'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }

  private formatTimeAgo(ms: number): string {
    if (ms < 5) return 'ahora mismo';
    if (ms < 1000) return `${ms}ms`;
    return `${Math.floor(ms / 1000)}s`;
  }
}
