import { BotCommand } from '../../../types/command.types';
import { CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { GameOrchestrator } from '../../../application/orchestrator/GameOrchestrator';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { GameError, ERROR_CODES } from '../../../types/errors';

/**
 * Comando de administración para iniciar un juego.
 * Solo moderators y superiores pueden usar este comando.
 */
export class StartCommand implements BotCommand {
  name = 'start';
  aliases = ['s'];
  requiredRole = BotRole.MODERATOR;
  cooldown = 0; // Sin cooldown para admins

  async execute(ctx: CommandContext): Promise<void> {
    try {
      // Extraer el tipo de juego del primer argumento
      const gameTypeInput = ctx.args[0]?.toLowerCase();

      // Validar que se proporcionó el tipo de juego
      if (!gameTypeInput) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [EmbedFactory.error('Uso: !start [tipo]', 'Ejemplo: !start trivia') as any],
        });
        return;
      }

      // Delegar al orchestrator
      const orchestrator = GameOrchestrator.getInstance();
      await orchestrator.startGame(ctx, gameTypeInput);
    } catch (error) {
      SystemLogger.error('StartCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
        args: ctx.args,
      });

      // Manejar GameError con embed apropiado
      if (error instanceof GameError) {
        await this.handleGameError(ctx, error);
        return;
      }

      // Error genérico
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos iniciar el juego. Intenta de nuevo.') as any],
      });
    }
  }

  /**
   * Maneja errores específicos de juego con embeds apropiados.
   */
  private async handleGameError(ctx: CommandContext, error: GameError): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embed = (e: ReturnType<typeof EmbedFactory.error>): any => e;

    switch (error.code) {
      case ERROR_CODES.GAME_ALREADY_STARTED:
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'Ya hay un juego activo en este servidor',
              'Espera a que termine o usa !cancel para cancelarlo'
            ) as any,
          ],
        });
        break;

      case ERROR_CODES.QUERY_FAILED:
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              `Tipo de juego no reconocido o no disponible: "${ctx.args[0]}"`,
              'Usa !games list para ver los juegos disponibles'
            ) as any,
          ],
        });
        break;

      default:
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'Ocurrió un error al iniciar el juego',
              'Intenta de nuevo o contacta a un admin'
            ) as any,
          ],
        });
    }
  }
}
