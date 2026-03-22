import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database/DatabaseService';
import { SystemLogger } from '../logger/SystemLogger';

const BACKUP_DIR = './data';
const MAX_BACKUPS = 7;

function getMillisecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function getBackupDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class BackupScheduler {
  private static instance: BackupScheduler;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private dbPath: string = '';

  private constructor() {}

  static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  start(): void {
    if (this.timeoutId !== null) {
      SystemLogger.debug('BackupScheduler already running');
      return;
    }

    const db = DatabaseService.getInstance();
    const configuredPath = process.env.DB_PATH ?? './data/games.db';
    this.dbPath = configuredPath;

    const delay = getMillisecondsUntilMidnightUTC();
    SystemLogger.info('BackupScheduler started', {
      nextBackupInMs: delay,
      nextBackupInHours: Math.round((delay / 3600000) * 10) / 10,
    });

    this.timeoutId = setTimeout(() => {
      this.executeBackup();
      this.scheduleNext();
    }, delay);
  }

  private scheduleNext(): void {
    const delay = getMillisecondsUntilMidnightUTC();
    this.timeoutId = setTimeout(() => {
      this.executeBackup();
      this.scheduleNext();
    }, delay);
  }

  private executeBackup(): void {
    if (!this.dbPath) {
      this.dbPath = process.env.DB_PATH ?? './data/games.db';
    }

    const sourcePath = this.dbPath;
    if (!fs.existsSync(sourcePath)) {
      SystemLogger.warn('BackupScheduler: source DB not found', { path: sourcePath });
      return;
    }

    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      const dateStr = getBackupDateString();
      const backupFileName = `games.db.backup-${dateStr}`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      fs.copyFileSync(sourcePath, backupPath);

      this.cleanupOldBackups();

      SystemLogger.info('BackupScheduler: backup completed', {
        backupPath,
        sourcePath,
      });
    } catch (error) {
      SystemLogger.error('BackupScheduler: backup failed', {
        error: error instanceof Error ? error.message : String(error),
        sourcePath,
      });
    }
  }

  private cleanupOldBackups(): void {
    try {
      if (!fs.existsSync(BACKUP_DIR)) return;

      const files = fs.readdirSync(BACKUP_DIR);
      const backupFiles = files
        .filter(f => f.startsWith('games.db.backup-') && f.endsWith(''))
        .map(f => ({
          name: f,
          path: path.join(BACKUP_DIR, f),
          mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (backupFiles.length > MAX_BACKUPS) {
        const toDelete = backupFiles.slice(MAX_BACKUPS);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
          SystemLogger.info('BackupScheduler: old backup deleted', { file: file.name });
        }
      }
    } catch (error) {
      SystemLogger.error('BackupScheduler: cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      SystemLogger.info('BackupScheduler stopped');
    }
  }
}

export const backupScheduler = BackupScheduler.getInstance();
