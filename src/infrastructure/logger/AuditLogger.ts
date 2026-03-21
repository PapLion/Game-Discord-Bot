import { DatabaseService } from '../database/DatabaseService';
import { SystemLogger } from './SystemLogger';
import crypto from 'crypto';

export type AuditAction =
  | 'prize_awarded'
  | 'prize_claimed'
  | 'prize_pending_created'
  | 'admin_reward'
  | 'code_loaded'
  | 'code_claimed'
  | 'game_started'
  | 'game_cancelled'
  | 'ban_applied'
  | 'config_changed'
  | 'prize_confirmed';

export interface AuditEntry {
  action: AuditAction;
  actorId: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  manuallyConfirmed?: boolean;
  confirmedBy?: string;
}

class AuditLogger {
  private static instance: AuditLogger;
  private dbService: DatabaseService | null = null;

  private constructor() {}

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  setDatabaseService(db: DatabaseService): void {
    this.dbService = db;
  }

  log(entry: AuditEntry): string | null {
    const id = this.generateId();

    if (this.dbService && this.dbService.isInitialized()) {
      try {
        this.dbService.execute(
          `INSERT INTO audit_log (id, action, actor_id, target_id, metadata, manually_confirmed, confirmed_by, confirmed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            entry.action,
            entry.actorId,
            entry.targetId ?? null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.manuallyConfirmed ? 1 : 0,
            entry.confirmedBy ?? null,
            entry.confirmedBy ? new Date().toISOString() : null,
          ]
        );
      } catch (error) {
        SystemLogger.error('AuditLogger failed to write', { error, entry });
      }
    } else {
      SystemLogger.debug('AuditLogger: DB not initialized, logging to console', { entry });
    }

    SystemLogger.info(`Audit: ${entry.action}`, {
      action: entry.action,
      actorId: entry.actorId,
      targetId: entry.targetId,
      metadata: entry.metadata,
    });

    return id;
  }

  logPrizeAwarded(
    userId: string,
    prizeType: string,
    prizeValue: string,
    sessionId?: string
  ): string | null {
    return this.log({
      action: 'prize_awarded',
      actorId: 'system',
      targetId: userId,
      metadata: { prizeType, prizeValue, sessionId },
    });
  }

  logPrizeClaimed(userId: string, pendingPrizeId: string): string | null {
    return this.log({
      action: 'prize_claimed',
      actorId: userId,
      targetId: pendingPrizeId,
    });
  }

  logAdminReward(
    adminId: string,
    targetUserId: string,
    prize: Record<string, unknown>
  ): string | null {
    return this.log({
      action: 'admin_reward',
      actorId: adminId,
      targetId: targetUserId,
      metadata: { prize },
    });
  }

  logCodeLoaded(adminId: string, codesCount: number): string | null {
    return this.log({
      action: 'code_loaded',
      actorId: adminId,
      metadata: { codesCount },
    });
  }

  logCodeClaimed(userId: string, codeId: string): string | null {
    return this.log({
      action: 'code_claimed',
      actorId: userId,
      targetId: codeId,
    });
  }

  logGameStarted(adminId: string, gameType: string, sessionId: string): string | null {
    return this.log({
      action: 'game_started',
      actorId: adminId,
      targetId: sessionId,
      metadata: { gameType },
    });
  }

  logGameCancelled(reason: string, sessionId: string): string | null {
    return this.log({
      action: 'game_cancelled',
      actorId: 'system',
      targetId: sessionId,
      metadata: { reason },
    });
  }

  logBanApplied(userId: string, reason: string, duration?: string): string | null {
    return this.log({
      action: 'ban_applied',
      actorId: 'system',
      targetId: userId,
      metadata: { reason, duration },
    });
  }

  logConfigChanged(
    adminId: string,
    key: string,
    oldValue: unknown,
    newValue: unknown
  ): string | null {
    return this.log({
      action: 'config_changed',
      actorId: adminId,
      metadata: { key, oldValue, newValue },
    });
  }

  logPrizeConfirmed(adminId: string, auditLogId: string): string | null {
    return this.log({
      action: 'prize_confirmed',
      actorId: adminId,
      targetId: auditLogId,
    });
  }

  confirmPending(auditLogId: string, confirmedBy: string): void {
    if (this.dbService && this.dbService.isInitialized()) {
      try {
        this.dbService.execute(
          `UPDATE audit_log SET manually_confirmed = 1, confirmed_by = ?, confirmed_at = ?
           WHERE id = ?`,
          [confirmedBy, new Date().toISOString(), auditLogId]
        );
      } catch (error) {
        SystemLogger.error('AuditLogger confirmPending failed', { error, auditLogId });
      }
    }
  }

  private generateId(): string {
    const bytes = new Uint8Array(16);
    crypto.randomFillSync(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const auditLogger = AuditLogger.getInstance();
