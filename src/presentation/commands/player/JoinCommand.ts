import { BotCommand } from '../../../types/command.types';
import { CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { GameOrchestrator } from '../../../application/orchestrator/GameOrchestrator';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { GameError, ERROR_CODES } from '../../../types/errors';
import { GAME_CONSTANTS } from '../../../types/GAME_CONSTANTS';

/**
 * Comando de jugador para unirse a un juego activo.
 * Cualquier jugador puede usar este comando.
 */
export class JoinCommand implements BotCommand {
  name = 'join';
  aliases = ['j'];
  requiredRole = BotRole.PLAYER;
  cooldown = GAME_CONSTANTS.COOLDOWN_JOIN_MS;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      // Delegar al orchestrator
      const orchestrator = GameOrchestrator.getInstance();
      await orchestrator.joinGame(ctx);
    } catch (error) {
      SystemLogger.error('JoinCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      // Manejar GameError con embed apropiado
      if (error instanceof GameError) {
        await this.handleGameError(ctx, error);
        return;
      }

      // Error genérico
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos agregarte al juego. Intenta de nuevo.') as any],
      });
    }
  }

  /**
   * Maneja errores específicos de juego con embeds apropiados.
   */
  private async handleGameError(ctx: CommandContext, error: GameError): Promise<void> {
    switch (error.code) {
      case ERROR_CODES.NO_ACTIVE_SESSION:
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'No hay ningún juego activo en este momento',
              'Usa !games list para ver opciones'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) as any,
          ],
        });
        break;

      case ERROR_CODES.SESSION_FULL:
        await ctx.reply({
          embeds: [EmbedFactory.error('El lobby está lleno', 'Espera el próximo juego') as any],
        });
        break;

      case ERROR_CODES.GAME_ALREADY_STARTED:
        await ctx.reply({
          embeds: [
            EmbedFactory.error('El juego ya está en curso', 'Espera la próxima ronda') as any,
          ],
        });
        break;

      case ERROR_CODES.NOT_IN_SESSION:
        await ctx.reply({
          embeds: [EmbedFactory.warning('No puedes unirte en este momento') as any],
        });
        break;

      default:
        await ctx.reply({
          embeds: [EmbedFactory.error('Ocurrió un error. Intenta de nuevo.') as any],
        });
    }
  }
}
