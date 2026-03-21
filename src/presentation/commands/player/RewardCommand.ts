import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { prizeSystem } from '../../../domain/prizes/PrizeSystem';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class RewardCommand implements BotCommand {
  name = 'reward';
  aliases = ['claim', 'rewards'];
  requiredRole = BotRole.PLAYER;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const result = await prizeSystem.claimPending(
        ctx.userId,
        ctx.message.channel as import('discord.js').TextChannel
      );

      if (!result.success) {
        if (result.error === 'NO_PENDING_PRIZES') {
          await ctx.reply({
            embeds: [
              EmbedFactory.error(
                'No tienes premios pendientes',
                'Juega y gana para reclamar premios!'
              ) as unknown as import('discord.js').APIEmbed,
            ],
          });
          return;
        }

        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'No pudimos entregar tu premio',
              'Intenta de nuevo mas tarde'
            ) as unknown as import('discord.js').APIEmbed,
          ],
        });
        return;
      }

      await ctx.reply({
        embeds: [
          EmbedFactory.success(
            `Premio reclamado exitosamente! (${result.prizesClaimed} premio(s))`
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    } catch (error) {
      SystemLogger.error('RewardCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'Ocurrio un error al reclamar tu premio'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }
}
