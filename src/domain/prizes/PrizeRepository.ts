import { DatabaseService, getDatabaseService } from '../../infrastructure/database/DatabaseService';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

export interface PendingPrizeRow {
  id: string;
  user_id: string;
  session_id: string | null;
  prize_id: string | null;
  prize_type: string;
  prize_value: string;
  status: 'pending' | 'claimed' | 'expired' | 'failed';
  attempts: number;
  last_attempt: string | null;
  created_at: string;
  claimed_at: string | null;
  expires_at: string | null;
}

export interface RedeemCodeRow {
  id: string;
  code: string;
  prize_id: string | null;
  status: 'available' | 'claimed' | 'expired';
  claimed_by: string | null;
  claimed_at: string | null;
  version: number;
  expires_at: string | null;
  created_at: string;
}

export interface IPrizeRepository {
  findPendingByUser(userId: string): PendingPrizeRow[];
  findById(id: string): PendingPrizeRow | undefined;
  markAsClaimed(id: string): void;
  markAsFailed(id: string): void;
  incrementAttempts(id: string): void;
  findAvailableRedeemCode(): RedeemCodeRow | undefined;
  claimRedeemCode(codeId: string, userId: string, currentVersion: number): boolean;
  getRedeemCodeById(codeId: string): RedeemCodeRow | undefined;
  getUserDiscordId(userId: string): string | undefined;
  insertInventoryItem(userId: string, itemType: string, itemId: string): void;
  insertSpecialAccess(
    userId: string,
    gameId: string | null,
    grantedBy: string,
    expiresAt: string | null
  ): void;
}

export class PrizeRepository implements IPrizeRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  findPendingByUser(userId: string): PendingPrizeRow[] {
    try {
      return this.db.run<PendingPrizeRow>(
        'SELECT * FROM pending_prizes WHERE user_id = ? AND status = ? ORDER BY created_at ASC',
        [userId, 'pending']
      );
    } catch (error) {
      SystemLogger.error('PrizeRepository.findPendingByUser failed', { error, userId });
      return [];
    }
  }

  findById(id: string): PendingPrizeRow | undefined {
    try {
      return this.db.runOne<PendingPrizeRow>('SELECT * FROM pending_prizes WHERE id = ?', [id]);
    } catch (error) {
      SystemLogger.error('PrizeRepository.findById failed', { error, id });
      return undefined;
    }
  }

  markAsClaimed(id: string): void {
    try {
      this.db.execute(
        "UPDATE pending_prizes SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );
    } catch (error) {
      SystemLogger.error('PrizeRepository.markAsClaimed failed', { error, id });
    }
  }

  markAsFailed(id: string): void {
    try {
      this.db.execute("UPDATE pending_prizes SET status = 'failed' WHERE id = ?", [id]);
    } catch (error) {
      SystemLogger.error('PrizeRepository.markAsFailed failed', { error, id });
    }
  }

  incrementAttempts(id: string): void {
    try {
      this.db.execute(
        'UPDATE pending_prizes SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (error) {
      SystemLogger.error('PrizeRepository.incrementAttempts failed', { error, id });
    }
  }

  findAvailableRedeemCode(): RedeemCodeRow | undefined {
    try {
      const code = this.db.runOne<RedeemCodeRow>(
        "SELECT * FROM redeem_codes WHERE status = 'available' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) ORDER BY RANDOM() LIMIT 1"
      );
      return code;
    } catch (error) {
      SystemLogger.error('PrizeRepository.findAvailableRedeemCode failed', { error });
      return undefined;
    }
  }

  claimRedeemCode(codeId: string, userId: string, currentVersion: number): boolean {
    try {
      const result = this.db.execute(
        'UPDATE redeem_codes SET status = ?, claimed_by = ?, claimed_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND version = ?',
        ['claimed', userId, codeId, currentVersion]
      );
      return result.changes > 0;
    } catch (error) {
      SystemLogger.error('PrizeRepository.claimRedeemCode failed', { error, codeId, userId });
      return false;
    }
  }

  getRedeemCodeById(codeId: string): RedeemCodeRow | undefined {
    try {
      return this.db.runOne<RedeemCodeRow>('SELECT * FROM redeem_codes WHERE id = ?', [codeId]);
    } catch (error) {
      SystemLogger.error('PrizeRepository.getRedeemCodeById failed', { error, codeId });
      return undefined;
    }
  }

  getUserDiscordId(userId: string): string | undefined {
    try {
      const row = this.db.runOne<{ discord_id: string }>(
        'SELECT discord_id FROM users WHERE id = ?',
        [userId]
      );
      return row?.discord_id;
    } catch (error) {
      SystemLogger.error('PrizeRepository.getUserDiscordId failed', { error, userId });
      return undefined;
    }
  }

  insertInventoryItem(userId: string, itemType: string, itemId: string): void {
    try {
      const id = require('crypto').randomUUID();
      this.db.execute(
        'INSERT INTO inventory (id, user_id, item_type, item_id, obtained_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [id, userId, itemType, itemId]
      );
    } catch (error) {
      SystemLogger.error('PrizeRepository.insertInventoryItem failed', {
        error,
        userId,
        itemType,
        itemId,
      });
      throw error;
    }
  }

  insertSpecialAccess(
    userId: string,
    gameId: string | null,
    grantedBy: string,
    expiresAt: string | null
  ): void {
    try {
      const id = require('crypto').randomUUID();
      this.db.execute(
        'INSERT INTO special_access (id, user_id, game_id, granted_by, granted_at, expires_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
        [id, userId, gameId, grantedBy, expiresAt]
      );
    } catch (error) {
      SystemLogger.error('PrizeRepository.insertSpecialAccess failed', { error, userId, gameId });
      throw error;
    }
  }
}

export const getPrizeRepository = (): PrizeRepository => {
  return new PrizeRepository();
};
