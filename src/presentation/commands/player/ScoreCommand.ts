import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { scoreService } from '../../../domain/systems/ScoreService';
import { UserRepository } from '../../../infrastructure/database/UserRepository';

export class ScoreCommand implements BotCommand {
  name = 'score';
  aliases = ['profile', 'stats'];
  requiredRole = BotRole.PLAYER;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const targetDiscordId = this.getTargetUser(ctx);
      const userRepo = new UserRepository();
      const user = await userRepo.findByDiscordId(targetDiscordId, ctx.guildId);

      if (!user) {
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'Usuario no encontrado',
              'El usuario no ha interactuado con el bot'
            ) as unknown as import('discord.js').APIEmbed,
          ],
        });
        return;
      }

      const stats = scoreService.getScoreRepository().findUserStats(user.id);
      const recentWins = scoreService.getScoreRepository().findRecentWins(user.id, 3);

      const username = ctx.message.mentions.users.first()?.username ?? ctx.message.author.username;

      const recentWinsFormatted = recentWins.map(w => ({
        gameName: this.formatGameName(w.gameType),
        prize: w.prizeName,
        timeAgo: this.formatTimeAgo(w.wonAt),
      }));

      await ctx.reply({
        embeds: [
          EmbedFactory.score({
            userMention: username,
            coins: user.coins,
            wins: stats?.wins ?? 0,
            gamesPlayed: stats?.gamesPlayed ?? 0,
            streak: user.streak,
            winrate: stats?.winrate ?? 0,
            favoriteGame: this.formatGameName(stats?.favoriteGame ?? 'trivia'),
            recentWins: recentWinsFormatted,
          }) as unknown as import('discord.js').APIEmbed,
        ],
      });
    } catch (error) {
      SystemLogger.error('ScoreCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'No pudimos mostrar el perfil'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }

  private getTargetUser(ctx: CommandContext): string {
    const mention = ctx.message.mentions.users.first();
    return mention?.id ?? ctx.discordId;
  }

  private formatGameName(gameType: string): string {
    const names: Record<string, string> = {
      trivia: 'Trivia',
      reaction: 'Reaction',
      math: 'Math',
      wordpuzzle: 'Word Puzzle',
      dice: 'Dice',
      spinwheel: 'Spin Wheel',
      guessing: 'Guessing',
      elimination: 'Elimination',
    };
    return names[gameType] ?? gameType;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  }
}
