import { Client } from 'discord.js';
import { DatabaseService } from '../database/DatabaseService';
import { SystemLogger } from '../logger/SystemLogger';

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export class HealthCheck {
  private static instance: HealthCheck;
  private client: Client | null = null;
  private periodicTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  static getInstance(): HealthCheck {
    if (!HealthCheck.instance) {
      HealthCheck.instance = new HealthCheck();
    }
    return HealthCheck.instance;
  }

  setClient(client: Client): void {
    this.client = client;
  }

  async checkOnStartup(): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];

    const db = DatabaseService.getInstance();
    if (!db.isInitialized()) {
      errors.push('Database not initialized');
    } else {
      try {
        db.runOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM game_sessions');
      } catch {
        errors.push('Database tables not accessible');
      }
    }

    if (!this.client || !this.client.isReady()) {
      errors.push('Bot not logged in');
    } else {
      try {
        const ping = this.client.ws.ping;
        if (ping > 1000) {
          SystemLogger.warn('HealthCheck: Discord API latency high', { pingMs: ping });
        }
      } catch {
        errors.push('Cannot check Discord API ping');
      }
    }

    const ok = errors.length === 0;
    if (ok) {
      SystemLogger.info('HealthCheck: startup check passed');
    } else {
      SystemLogger.error('HealthCheck: startup check failed', { errors });
    }

    return { ok, errors };
  }

  async checkPeriodic(): Promise<void> {
    const errors: string[] = [];

    const db = DatabaseService.getInstance();
    if (!db.isInitialized()) {
      errors.push('Database not initialized');
    } else {
      try {
        const start = Date.now();
        db.runOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM game_sessions');
        const duration = Date.now() - start;
        if (duration > 100) {
          SystemLogger.warn('HealthCheck: DB query slow', { durationMs: duration });
        }
      } catch {
        errors.push('Database query failed');
      }
    }

    if (this.client && this.client.isReady()) {
      try {
        const ping = this.client.ws.ping;
        if (ping > 500) {
          SystemLogger.warn('HealthCheck: Discord API latency high', { pingMs: ping });
        }
      } catch {
        errors.push('Cannot check Discord API ping');
      }
    }

    if (errors.length > 0) {
      SystemLogger.error('HealthCheck: periodic check failed', { errors });
    }

    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.periodicTimeoutId = setTimeout(() => {
      this.checkPeriodic().catch(error => {
        SystemLogger.error('HealthCheck periodic failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.scheduleNext();
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  startPeriodic(): void {
    if (this.periodicTimeoutId !== null) {
      return;
    }
    this.scheduleNext();
    SystemLogger.info('HealthCheck: periodic checks started', {
      intervalMs: HEALTH_CHECK_INTERVAL_MS,
    });
  }

  stop(): void {
    if (this.periodicTimeoutId !== null) {
      clearTimeout(this.periodicTimeoutId);
      this.periodicTimeoutId = null;
      SystemLogger.info('HealthCheck: periodic checks stopped');
    }
  }
}

export const healthCheck = HealthCheck.getInstance();
