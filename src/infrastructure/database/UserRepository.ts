import { DatabaseService, getDatabaseService } from '../../infrastructure/database/DatabaseService';
import { User } from '../../types/player.types';
import { DatabaseError, ERROR_CODES } from '../../types/errors';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { randomFillSync } from 'crypto';

interface UserRow {
  id: string;
  discord_id: string;
  guild_id: string;
  coins: number;
  streak: number;
  last_daily: string | null;
  created_at: string;
  updated_at: string;
}

export interface IUserRepository {
  findByDiscordId(discordId: string, guildId: string): Promise<User | null>;
  upsert(user: Partial<User>): Promise<User>;
  updateCoins(userId: string, amount: number): Promise<void>;
  updateStreak(userId: string, streak: number, lastDaily: Date): Promise<void>;
  findOrCreate(discordId: string, guildId: string): Promise<User>;
}

export class UserRepository implements IUserRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      discordId: row.discord_id,
      guildId: row.guild_id,
      coins: row.coins,
      streak: row.streak,
      lastDaily: row.last_daily ? new Date(row.last_daily) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findByDiscordId(discordId: string, guildId: string): Promise<User | null> {
    try {
      const row = this.db.runOne<UserRow>(
        'SELECT * FROM users WHERE discord_id = ? AND guild_id = ?',
        [discordId, guildId]
      );
      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      SystemLogger.error('UserRepository.findByDiscordId failed', { error, discordId, guildId });
      throw new DatabaseError('Failed to find user', ERROR_CODES.QUERY_FAILED);
    }
  }

  async upsert(user: Partial<User>): Promise<User> {
    try {
      const now = new Date().toISOString();

      if (!user.id) {
        user.id = this.generateId();
      }

      const existing = await this.findByDiscordId(user.discordId!, user.guildId!);

      if (existing) {
        this.db.execute(
          `UPDATE users SET 
            coins = COALESCE(?, coins),
            streak = COALESCE(?, streak),
            last_daily = COALESCE(?, last_daily),
            updated_at = ?
          WHERE id = ?`,
          [
            user.coins ?? null,
            user.streak ?? null,
            user.lastDaily ? user.lastDaily.toISOString() : null,
            now,
            existing.id,
          ]
        );
        return { ...existing, ...user, updatedAt: new Date(now) };
      }

      this.db.execute(
        `INSERT INTO users (id, discord_id, guild_id, coins, streak, last_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.discordId,
          user.guildId,
          user.coins ?? 0,
          user.streak ?? 0,
          user.lastDaily ? user.lastDaily.toISOString() : null,
          now,
          now,
        ]
      );

      return {
        id: user.id,
        discordId: user.discordId!,
        guildId: user.guildId!,
        coins: user.coins ?? 0,
        streak: user.streak ?? 0,
        lastDaily: user.lastDaily,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
    } catch (error) {
      SystemLogger.error('UserRepository.upsert failed', { error, user });
      throw new DatabaseError('Failed to upsert user', ERROR_CODES.QUERY_FAILED);
    }
  }

  async updateCoins(userId: string, amount: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.execute('UPDATE users SET coins = coins + ?, updated_at = ? WHERE id = ?', [
        amount,
        now,
        userId,
      ]);
    } catch (error) {
      SystemLogger.error('UserRepository.updateCoins failed', { error, userId, amount });
      throw new DatabaseError('Failed to update coins', ERROR_CODES.QUERY_FAILED);
    }
  }

  async updateStreak(userId: string, streak: number, lastDaily: Date): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.execute('UPDATE users SET streak = ?, last_daily = ?, updated_at = ? WHERE id = ?', [
        streak,
        lastDaily.toISOString(),
        now,
        userId,
      ]);
    } catch (error) {
      SystemLogger.error('UserRepository.updateStreak failed', { error, userId, streak });
      throw new DatabaseError('Failed to update streak', ERROR_CODES.QUERY_FAILED);
    }
  }

  async findOrCreate(discordId: string, guildId: string): Promise<User> {
    const existing = await this.findByDiscordId(discordId, guildId);
    if (existing) {
      return existing;
    }

    const newUser: Partial<User> = {
      id: this.generateId(),
      discordId,
      guildId,
      coins: 0,
      streak: 0,
    };

    return this.upsert(newUser);
  }

  private generateId(): string {
    const bytes = Buffer.alloc(16);
    randomFillSync(bytes);
    return bytes.toString('hex');
  }
}
