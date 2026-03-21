import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { randomUUID } from 'crypto';

/**
 * Servicio para crear registros de premios pendientes (pending_prizes).
 *
 * ÚNICAMENTE se usa desde BaseGame.end() — el ÚNICO punto de entrega de premio.
 *
 * La Regla G-O establece:
 * - "Premio se entrega UNA VEZ por sesión completa — no por ronda."
 * - "BaseGame.end() es el ÚNICO punto de entrega de premio."
 */
export class PendingPrizeService {
  /**
   * Crea un registro de premio pendiente en la base de datos.
   *
   * @param db - Servicio de base de datos
   * @param winnerUserId - ID del usuario ganador en la DB
   * @param sessionId - ID de la sesión del juego
   * @param prizeType - Tipo de premio (ej: 'coins', 'badge', etc.)
   * @param prizeValue - Valor del premio (ej: '100', 'special_item')
   * @returns El ID del pending_prize creado
   */
  public static async createPending(
    db: DatabaseService,
    winnerUserId: string,
    sessionId: string,
    prizeType: string,
    prizeValue: string
  ): Promise<string> {
    try {
      // Generar UUID único para el pending_prize
      const id = randomUUID();

      // INSERT en pending_prizes usando prepared statement
      db.execute(
        `INSERT INTO pending_prizes 
          (id, user_id, session_id, prize_id, prize_type, prize_value, status, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [id, winnerUserId, sessionId, prizeType, prizeValue]
      );

      // Loguear en audit log
      auditLogger.log({
        action: 'prize_pending_created',
        actorId: 'system',
        targetId: winnerUserId,
        metadata: {
          pendingPrizeId: id,
          sessionId,
          prizeType,
          prizeValue,
        },
      });

      SystemLogger.info('Pending prize created', {
        pendingPrizeId: id,
        winnerUserId,
        sessionId,
        prizeType,
        prizeValue,
      });

      return id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      SystemLogger.error('PendingPrizeService.createPending failed', {
        winnerUserId,
        sessionId,
        prizeType,
        prizeValue,
        error: errorMessage,
      });
      throw error;
    }
  }
}
