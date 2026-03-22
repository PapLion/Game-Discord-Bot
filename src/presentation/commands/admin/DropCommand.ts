import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { prizeDropScheduler } from '../../../infrastructure/scheduler/PrizeDropScheduler';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';

export class DropCommand implements BotCommand {
  name = 'drop';
  aliases: string[] = [];
  requiredRole = BotRole.ADMIN;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    const subcommand = ctx.args[0]?.toLowerCase();

    try {
      switch (subcommand) {
        case 'force':
          await this.handleForce(ctx);
          break;
        case 'pause':
          await this.handlePause(ctx);
          break;
        case 'resume':
          await this.handleResume(ctx);
          break;
        default:
          await this.handleStatus(ctx);
      }
    } catch (error) {
      SystemLogger.error('DropCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
        subcommand,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos procesar el comando. Intenta de nuevo.') as any],
      });
    }
  }

  private async handleForce(ctx: CommandContext): Promise<void> {
    await prizeDropScheduler.triggerImmediateDrop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.success('Drop triggered manually!') as any],
    });
  }

  private async handlePause(ctx: CommandContext): Promise<void> {
    if (prizeDropScheduler.isPausedState()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.warning('Scheduler ya está pausado') as any],
      });
      return;
    }

    prizeDropScheduler.pause();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.success('Prize drop scheduler pausado') as any],
    });
  }

  private async handleResume(ctx: CommandContext): Promise<void> {
    if (!prizeDropScheduler.isPausedState()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.warning('Scheduler no está pausado') as any],
      });
      return;
    }

    prizeDropScheduler.resume();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.success('Prize drop scheduler reanudado') as any],
    });
  }

  private async handleStatus(ctx: CommandContext): Promise<void> {
    const isRunning = prizeDropScheduler.isRunning();
    const isPaused = prizeDropScheduler.isPausedState();

    const status = isRunning
      ? '🟢 Corriendo — drops activos'
      : isPaused
        ? '🟡 Pausado — drops detenidos'
        : '🔴 Detenido';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.info(`**Prize Drop Scheduler**\nEstado: ${status}`) as any],
    });
  }
}
