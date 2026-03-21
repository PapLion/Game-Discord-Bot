import { ScoreRepository } from '../../infrastructure/database/ScoreRepository';
import { leaderboardCache } from '../../infrastructure/cache/LeaderboardCache';
import { GameType } from '../../types/game.types';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

export interface UpdateAfterGameData {
  sessionId: string;
  winnerId: string;
  guildId: string;
  gameType: GameType;
  score: number;
  prizeId?: string;
}

export class ScoreService {
  private static instance: ScoreService;
  private scoreRepo: ScoreRepository;

  private constructor(scoreRepo?: ScoreRepository) {
    this.scoreRepo = scoreRepo ?? new ScoreRepository();
  }

  static getInstance(scoreRepo?: ScoreRepository): ScoreService {
    if (!ScoreService.instance) {
      ScoreService.instance = new ScoreService(scoreRepo);
    }
    return ScoreService.instance;
  }

  async updateAfterGame(data: UpdateAfterGameData): Promise<string> {
    try {
      const winnerId = this.scoreRepo.insertGameWinner({
        sessionId: data.sessionId,
        userId: data.winnerId,
        gameType: data.gameType,
        score: data.score,
        prizeId: data.prizeId,
      });

      leaderboardCache.invalidate(data.guildId);

      SystemLogger.info('ScoreService: Game winner recorded', {
        winnerId: data.winnerId,
        sessionId: data.sessionId,
        gameType: data.gameType,
      });

      return winnerId;
    } catch (error) {
      SystemLogger.error('ScoreService.updateAfterGame failed', {
        error,
        data,
      });
      throw error;
    }
  }

  getScoreRepository(): ScoreRepository {
    return this.scoreRepo;
  }
}

export const scoreService = ScoreService.getInstance();
