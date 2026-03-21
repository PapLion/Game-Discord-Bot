import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { InventoryRepository } from '../../../infrastructure/database/InventoryRepository';
import { UserRepository } from '../../../infrastructure/database/UserRepository';

export class InventoryCommand implements BotCommand {
  name = 'inventory';
  aliases = ['inv', 'items'];
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

      const inventoryRepo = new InventoryRepository();
      const inventory = inventoryRepo.findUserInventory(user.id);

      const username = ctx.message.mentions.users.first()?.username ?? ctx.message.author.username;

      await ctx.reply({
        embeds: [
          EmbedFactory.inventory({
            userMention: username,
            badges: inventory.badges.map(b => ({
              name: b.itemName,
              rarity: b.rarity,
              obtainedAt: this.formatDate(b.obtainedAt),
            })),
            items: inventory.items.map(i => ({
              name: i.itemName,
              gameType: i.gameType ?? 'general',
              obtainedAt: this.formatDate(i.obtainedAt),
            })),
            specialAccess: inventory.specialAccess.map(a => ({
              name: a.itemName,
              expiresAt: a.expiresAt ? this.formatDate(a.expiresAt) : 'Never',
            })),
          }) as unknown as import('discord.js').APIEmbed,
        ],
      });
    } catch (error) {
      SystemLogger.error('InventoryCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'No pudimos mostrar el inventario'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }

  private getTargetUser(ctx: CommandContext): string {
    const mention = ctx.message.mentions.users.first();
    return mention?.id ?? ctx.discordId;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'today';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }
}
