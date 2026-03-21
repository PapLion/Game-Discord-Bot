import { DatabaseService, getDatabaseService } from '../database/DatabaseService';
import { GameType } from '../../types/game.types';
import { DatabaseError, ERROR_CODES } from '../../types/errors';
import { SystemLogger } from '../logger/SystemLogger';
import { randomFillSync } from 'crypto';

export interface GameWinnerRow {
  id: string;
  session_id: string;
  user_id: string;
  game_type: string;
  prize_id: string | null;
  score: number;
  won_at: string;
}

export interface UserStats {
  wins: number;
  gamesPlayed: number;
  winrate: number;
  favoriteGame: GameType;
  streak: number;
}

export interface RecentWin {
  gameType: GameType;
  score: number;
  wonAt: Date;
  prizeName: string;
}

export interface IScoreRepository {
  findTopUsers(
    guildId: string,
    limit: number
  ): Array<{ userId: string; discordId: string; coins: number }>;
  findUserStats(userId: string): UserStats | null;
  insertGameWinner(data: {
    sessionId: string;
    userId: string;
    gameType: GameType;
    score: number;
    prizeId?: string;
  }): string;
  findRecentWins(userId: string, limit: number): RecentWin[];
  findUserWinsCount(userId: string): number;
  incrementUserWins(userId: string): void;
  incrementGamesPlayed(userId: string): void;
}

export class ScoreRepository implements IScoreRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  findTopUsers(
    guildId: string,
    limit: number
  ): Array<{ userId: string; discordId: string; coins: number }> {
    try {
      const rows = this.db.run<{ id: string; discord_id: string; coins: number }>(
        `SELECT u.id, u.discord_id, u.coins
         FROM users u
         WHERE u.guild_id = ?
         ORDER BY u.coins DESC
         LIMIT ?`,
        [guildId, limit]
      );

      return rows.map(row => ({
        userId: row.id,
        discordId: row.discord_id,
        coins: row.coins,
      }));
    } catch (error) {
      SystemLogger.error('ScoreRepository.findTopUsers failed', { error, guildId, limit });
      throw new DatabaseError('Failed to find top users', ERROR_CODES.QUERY_FAILED);
    }
  }

  findUserStats(userId: string): UserStats | null {
    try {
      const userRow = this.db.runOne<{ streak: number }>('SELECT streak FROM users WHERE id = ?', [
        userId,
      ]);

      if (!userRow) {
        return null;
      }

      const winsCount = this.findUserWinsCount(userId);

      const participationRows = this.db.run<{ total_games: number }>(
        'SELECT COUNT(*) as total_games FROM participation WHERE user_id = ?',
        [userId]
      );
      const gamesPlayed = participationRows[0]?.total_games ?? 0;

      const winrate = gamesPlayed > 0 ? Math.round((winsCount / gamesPlayed) * 100) : 0;

      const favoriteGameRow = this.db.runOne<{ game_type: string; count: number }>(
        `SELECT game_type, COUNT(*) as count
         FROM game_winners
         WHERE user_id = ?
         GROUP BY game_type
         ORDER BY count DESC
         LIMIT 1`,
        [userId]
      );

      const favoriteGame: GameType = (favoriteGameRow?.game_type as GameType) ?? 'trivia';

      return {
        wins: winsCount,
        gamesPlayed,
        winrate,
        favoriteGame,
        streak: userRow.streak,
      };
    } catch (error) {
      SystemLogger.error('ScoreRepository.findUserStats failed', { error, userId });
      throw new DatabaseError('Failed to find user stats', ERROR_CODES.QUERY_FAILED);
    }
  }

  insertGameWinner(data: {
    sessionId: string;
    userId: string;
    gameType: GameType;
    score: number;
    prizeId?: string;
  }): string {
    try {
      const id = this.generateId();

      this.db.execute(
        `INSERT INTO game_winners (id, session_id, user_id, game_type, prize_id, score, won_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, data.sessionId, data.userId, data.gameType, data.prizeId ?? null, data.score]
      );

      SystemLogger.debug('ScoreRepository: Game winner inserted', {
        id,
        sessionId: data.sessionId,
        userId: data.userId,
        gameType: data.gameType,
      });

      return id;
    } catch (error) {
      SystemLogger.error('ScoreRepository.insertGameWinner failed', { error, data });
      throw new DatabaseError('Failed to insert game winner', ERROR_CODES.QUERY_FAILED);
    }
  }

  findRecentWins(userId: string, limit: number): RecentWin[] {
    try {
      const rows = this.db.run<GameWinnerRow>(
        `SELECT gw.game_type, gw.score, gw.won_at, p.name as prize_name
         FROM game_winners gw
         LEFT JOIN prizes p ON gw.prize_id = p.id
         WHERE gw.user_id = ?
         ORDER BY gw.won_at DESC
         LIMIT ?`,
        [userId, limit]
      );

      return rows.map(row => ({
        gameType: row.game_type as GameType,
        score: row.score,
        wonAt: new Date(row.won_at),
        prizeName: row.prize_id
          ? ((rows as unknown as { prize_name?: string }).prize_name ?? 'Prize')
          : 'Coins',
      }));
    } catch (error) {
      SystemLogger.error('ScoreRepository.findRecentWins failed', { error, userId, limit });
      throw new DatabaseError('Failed to find recent wins', ERROR_CODES.QUERY_FAILED);
    }
  }

  findUserWinsCount(userId: string): number {
    try {
      const row = this.db.runOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM game_winners WHERE user_id = ?',
        [userId]
      );
      return row?.count ?? 0;
    } catch (error) {
      SystemLogger.error('ScoreRepository.findUserWinsCount failed', { error, userId });
      return 0;
    }
  }

  incrementUserWins(userId: string): void {
    try {
      this.db.execute('UPDATE users SET updated_at = datetime("now") WHERE id = ?', [userId]);
    } catch (error) {
      SystemLogger.error('ScoreRepository.incrementUserWins failed', { error, userId });
    }
  }

  incrementGamesPlayed(userId: string): void {
    try {
      // games_played is tracked via participation table
      // This method is a placeholder for potential future use
    } catch (error) {
      SystemLogger.error('ScoreRepository.incrementGamesPlayed failed', { error, userId });
    }
  }

  private generateId(): string {
    const bytes = Buffer.alloc(16);
    randomFillSync(bytes);
    return bytes.toString('hex');
  }
}
