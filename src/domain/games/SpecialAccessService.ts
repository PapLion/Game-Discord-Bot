import { DatabaseService, getDatabaseService } from '../../infrastructure/database/DatabaseService';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { GameError, ERROR_CODES } from '../../types/errors';

interface SpecialAccessRow {
  id: string;
  user_id: string;
  game_id: string | null;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
}

export class SpecialAccessService {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  validateSpecialAccess(userId: string, gameType: string): boolean {
    try {
      const now = new Date().toISOString();

      const access = this.db.runOne<SpecialAccessRow>(
        `SELECT * FROM special_access 
         WHERE user_id = ? 
         AND (game_id = ? OR game_id IS NULL)
         AND (expires_at IS NULL OR expires_at > ?)
         LIMIT 1`,
        [userId, gameType, now]
      );

      if (access) {
        SystemLogger.info('Special access validated', {
          userId,
          gameType,
          expiresAt: access.expires_at,
        });
        return true;
      }

      SystemLogger.warn('Special access denied', {
        userId,
        gameType,
        reason: 'No valid access found or expired',
      });
      return false;
    } catch (error) {
      SystemLogger.error('SpecialAccessService.validateSpecialAccess failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        gameType,
      });
      return false;
    }
  }

  hasValidAccessOrThrow(userId: string, gameType: string): void {
    if (!this.validateSpecialAccess(userId, gameType)) {
      throw new GameError(
        'No tienes acceso a este juego especial. Contacta a un admin para obtener special_access.',
        ERROR_CODES.INSUFFICIENT_ROLE
      );
    }
  }
}

export const specialAccessService = new SpecialAccessService();
