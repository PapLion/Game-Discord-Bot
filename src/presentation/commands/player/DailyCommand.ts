import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { dailyRewardService } from '../../../domain/systems/DailyRewardService';

export class DailyCommand implements BotCommand {
  name = 'daily';
  aliases = ['claim', 'streak'];
  requiredRole = BotRole.PLAYER;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const result = await dailyRewardService.claimDaily(ctx.discordId);

      if (result.wasBroken) {
        await ctx.reply({
          embeds: [
            EmbedFactory.streakBroken({
              previousStreak: result.streak > 1 ? result.streak - 1 : 0,
              baseReward: result.baseReward,
            }) as unknown as import('discord.js').APIEmbed,
          ],
        });
        return;
      }

      if (!result.claimed) {
        const nextClaim = await dailyRewardService.getTimeUntilNextClaim(ctx.discordId);
        await ctx.reply({
          embeds: [
            EmbedFactory.dailyAlreadyClaimed({
              streak: result.streak,
              nextClaimIn: nextClaim ?? '20 hours',
            }) as unknown as import('discord.js').APIEmbed,
          ],
        });
        return;
      }

      await ctx.reply({
        embeds: [
          EmbedFactory.dailyClaim({
            streak: result.streak,
            baseReward: result.baseReward,
            bonusReward: result.bonusReward,
            multiplier: result.multiplier,
            totalReward: result.totalReward,
          }) as unknown as import('discord.js').APIEmbed,
        ],
      });

      SystemLogger.info('DailyCommand: Reward claimed', {
        userId: ctx.userId,
        streak: result.streak,
        reward: result.totalReward,
      });
    } catch (error) {
      SystemLogger.error('DailyCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'No pudimos procesar tu recompensa diaria'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }
}
