import { BotCommand } from '../../../types/command.types';
import { CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { GameOrchestrator } from '../../../application/orchestrator/GameOrchestrator';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { GameError, ERROR_CODES } from '../../../types/errors';
import { GAME_CONSTANTS } from '../../../types/GAME_CONSTANTS';

/**
 * Comando de jugador para enviar una respuesta durante el juego.
 * Aliases: play, p, answer
 */
export class PlayCommand implements BotCommand {
  name = 'play';
  aliases = ['p', 'answer'];
  requiredRole = BotRole.PLAYER;
  cooldown = GAME_CONSTANTS.COOLDOWN_PLAY_MS;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      // Extraer la respuesta del resto de los argumentos
      const answer = ctx.args.join(' ').trim();

      // Validar que hay respuesta
      if (!answer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [EmbedFactory.warning('Escribe tu respuesta: !play [respuesta]') as any],
        });
        return;
      }

      // Delegar al orchestrator
      const orchestrator = GameOrchestrator.getInstance();
      await orchestrator.handlePlay(ctx, answer);
    } catch (error) {
      SystemLogger.error('PlayCommand failed', {
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
        embeds: [EmbedFactory.error('No pudimos procesar tu respuesta. Intenta de nuevo.') as any],
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

      case ERROR_CODES.NOT_IN_SESSION:
        await ctx.reply({
          embeds: [EmbedFactory.warning('No hay ronda activa para responder') as any],
        });
        break;

      case ERROR_CODES.GAME_ALREADY_STARTED:
        await ctx.reply({
          embeds: [EmbedFactory.info('El juego aún no ha empezado') as any],
        });
        break;

      default:
        await ctx.reply({
          embeds: [EmbedFactory.error('Ocurrió un error. Intenta de nuevo.') as any],
        });
    }
  }
}
