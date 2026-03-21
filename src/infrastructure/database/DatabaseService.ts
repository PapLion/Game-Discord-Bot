import Database from 'better-sqlite3';
import { DatabaseError, ERROR_CODES } from '../../types/errors';
import { SystemLogger } from '../logger/SystemLogger';

const MIGRATIONS_DIR = './src/infrastructure/database/migrations';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(dbPath?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    const path = dbPath ?? process.env.DB_PATH ?? './data/games.db';
    const dbDir = path.substring(0, path.lastIndexOf('/') || path.lastIndexOf('\\'));

    if (dbDir) {
      const fs = require('fs');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }

    try {
      this.db = new Database(path);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      await this.runMigrations();
      this.initialized = true;
      SystemLogger.info('DatabaseService initialized', { path });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(
        `Failed to initialize database: ${message}`,
        ERROR_CODES.MIGRATION_FAILED
      );
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized', ERROR_CODES.QUERY_FAILED);
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL UNIQUE,
          applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const fs = require('fs');
      const path = require('path');
      const migrationsDir = MIGRATIONS_DIR;

      if (!fs.existsSync(migrationsDir)) {
        SystemLogger.warn('Migrations directory not found', { migrationsDir });
        return;
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');
        const applied = this.db
          .prepare('SELECT name FROM schema_migrations WHERE name = ?')
          .get(migrationName);

        if (!applied) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          this.db.exec(sql);
          this.db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migrationName);
          SystemLogger.info('Migration applied', { migration: migrationName });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(`Migration failed: ${message}`, ERROR_CODES.MIGRATION_FAILED);
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new DatabaseError('Database not initialized', ERROR_CODES.QUERY_FAILED);
    }
    return this.db;
  }

  run<T>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) {
      throw new DatabaseError('Database not initialized', ERROR_CODES.QUERY_FAILED);
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('Database query failed', { sql, params, error: message });
      throw new DatabaseError(`Query failed: ${message}`, ERROR_CODES.QUERY_FAILED);
    }
  }

  runOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const results = this.run<T>(sql, params);
    return results[0];
  }

  execute(sql: string, params: unknown[] = []): Database.RunResult {
    if (!this.db) {
      throw new DatabaseError('Database not initialized', ERROR_CODES.QUERY_FAILED);
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('Database execute failed', { sql, params, error: message });
      throw new DatabaseError(`Execute failed: ${message}`, ERROR_CODES.QUERY_FAILED);
    }
  }

  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new DatabaseError('Database not initialized', ERROR_CODES.QUERY_FAILED);
    }

    try {
      return this.db.transaction(fn)();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DatabaseError(`Transaction failed: ${message}`, ERROR_CODES.QUERY_FAILED);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      SystemLogger.info('DatabaseService closed');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const getDatabaseService = (): DatabaseService => {
  return DatabaseService.getInstance();
};
