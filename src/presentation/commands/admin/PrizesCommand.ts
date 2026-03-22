import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import {
  DatabaseService,
  getDatabaseService,
} from '../../../infrastructure/database/DatabaseService';

interface PendingPrizeRow {
  id: string;
  user_id: string;
  prize_type: string;
  prize_value: string;
  status: string;
  created_at: string;
  session_id: string;
  discord_id: string | null;
}

export class PrizesCommand implements BotCommand {
  name = 'prizes';
  aliases: string[] = [];
  requiredRole = BotRole.ADMIN;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    const subcommand = ctx.args[0]?.toLowerCase();

    try {
      switch (subcommand) {
        case 'pending':
          await this.handlePending(ctx);
          break;
        case 'confirm':
          await this.handleConfirm(ctx);
          break;
        default:
          await this.handleHelp(ctx);
      }
    } catch (error) {
      SystemLogger.error('PrizesCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos procesar el comando. Intenta de nuevo.') as any],
      });
    }
  }

  private async handlePending(ctx: CommandContext): Promise<void> {
    const db = getDatabaseService();

    const rows = db.run<PendingPrizeRow>(
      `SELECT pp.id, pp.user_id, pp.prize_type, pp.prize_value, 
              pp.status, pp.created_at, pp.session_id,
              u.discord_id
       FROM pending_prizes pp
       LEFT JOIN users u ON u.id = pp.user_id
       WHERE pp.status = 'pending'
       ORDER BY pp.created_at DESC
       LIMIT 20`
    );

    const parsed = rows.map(row => {
      const timeAgo = this.formatTimeAgo(new Date(row.created_at));

      return {
        id: row.id,
        mention: `<@${row.discord_id || row.user_id}>`,
        prizeName: row.prize_value,
        gameName: row.prize_type,
        timeAgo,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.prizesPending({ prizes: parsed }) as any],
    });
  }

  private async handleConfirm(ctx: CommandContext): Promise<void> {
    const id = ctx.args[1];

    if (!id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error('Uso: !prizes confirm [id]', 'El id es el número del premio') as any,
        ],
      });
      return;
    }

    const db = getDatabaseService();

    const row = db.runOne<{ id: string; manually_confirmed: number }>(
      'SELECT id, manually_confirmed FROM audit_log WHERE id = ?',
      [id]
    );

    if (!row) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error(`No se encontró el registro con id: ${id}`) as any],
      });
      return;
    }

    if (row.manually_confirmed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.warning('Este premio ya fue confirmado anteriormente') as any],
      });
      return;
    }

    auditLogger.confirmPending(id, ctx.userId);
    auditLogger.logPrizeConfirmed(ctx.userId, id);

    SystemLogger.info('PrizesCommand: prize confirmed', {
      adminId: ctx.userId,
      auditLogId: id,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.success(`Premio #${id} marcado como entregado`) as any],
    });
  }

  private async handleHelp(ctx: CommandContext): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [
        EmbedFactory.info(
          '**Comandos de premios:**\n' +
            '• `!prizes pending` — Lista de premios pendientes de entrega\n' +
            '• `!prizes confirm [id]` — Marcar premio como entregado'
        ) as any,
      ],
    });
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}min`;
    return 'ahora';
  }
}
