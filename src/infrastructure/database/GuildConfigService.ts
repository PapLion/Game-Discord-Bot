import { DatabaseService, getDatabaseService } from './DatabaseService';
import { SystemLogger } from '../logger/SystemLogger';
import { DatabaseError, ERROR_CODES } from '../../types/errors';

export interface GuildConfig {
  guildId: string;
  prefix: string;
  gameChannelId: string | null;
  logChannelId: string | null;
  maxPlayersPerGame: number;
  minPlayersPerGame: number;
  lobbyWaitSeconds: number;
  dropIntervalMin: number; // minutos
  dropIntervalMax: number; // minutos
}

interface GuildConfigRow {
  guild_id: string;
  prefix: string;
  game_channel_id: string | null;
  log_channel_id: string | null;
  max_players_per_game: number;
  min_players_per_game: number;
  lobby_wait_seconds: number;
  drop_interval_min: number;
  drop_interval_max: number;
}

const DEFAULT_CONFIG: Omit<GuildConfig, 'guildId'> = {
  prefix: '!',
  gameChannelId: null,
  logChannelId: null,
  maxPlayersPerGame: 10,
  minPlayersPerGame: 2,
  lobbyWaitSeconds: 30,
  dropIntervalMin: 15,
  dropIntervalMax: 60,
};

export class GuildConfigService {
  private db: DatabaseService;
  private cache: Map<string, GuildConfig> = new Map();

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  private mapRowToConfig(row: GuildConfigRow): GuildConfig {
    return {
      guildId: row.guild_id,
      prefix: row.prefix,
      gameChannelId: row.game_channel_id,
      logChannelId: row.log_channel_id,
      maxPlayersPerGame: row.max_players_per_game,
      minPlayersPerGame: row.min_players_per_game,
      lobbyWaitSeconds: row.lobby_wait_seconds,
      dropIntervalMin: row.drop_interval_min,
      dropIntervalMax: row.drop_interval_max,
    };
  }

  getOrCreate(guildId: string): GuildConfig {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    try {
      const row = this.db.runOne<GuildConfigRow>('SELECT * FROM guild_config WHERE guild_id = ?', [
        guildId,
      ]);

      if (row) {
        const config = this.mapRowToConfig(row);
        this.cache.set(guildId, config);
        return config;
      }

      const newConfig = this.createDefault(guildId);
      return newConfig;
    } catch (error) {
      SystemLogger.error('GuildConfigService.getOrCreate failed', { error, guildId });
      throw new DatabaseError('Failed to get guild config', ERROR_CODES.QUERY_FAILED);
    }
  }

  private createDefault(guildId: string): GuildConfig {
    const config: GuildConfig = {
      guildId,
      ...DEFAULT_CONFIG,
    };

    try {
      this.db.execute(
        `INSERT OR IGNORE INTO guild_config 
         (guild_id, prefix, game_channel_id, log_channel_id, 
          max_players_per_game, min_players_per_game, lobby_wait_seconds,
          drop_interval_min, drop_interval_max)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          config.prefix,
          config.gameChannelId,
          config.logChannelId,
          config.maxPlayersPerGame,
          config.minPlayersPerGame,
          config.lobbyWaitSeconds,
          config.dropIntervalMin,
          config.dropIntervalMax,
        ]
      );

      this.cache.set(guildId, config);
      SystemLogger.info('Guild config created with defaults', { guildId });
      return config;
    } catch (error) {
      SystemLogger.error('GuildConfigService.createDefault failed', { error, guildId });
      throw new DatabaseError('Failed to create guild config', ERROR_CODES.QUERY_FAILED);
    }
  }

  update(guildId: string, updates: Partial<GuildConfig>): GuildConfig {
    const current = this.getOrCreate(guildId);
    const updated: GuildConfig = { ...current, ...updates };

    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (updates.prefix !== undefined) {
        setClauses.push('prefix = ?');
        values.push(updates.prefix);
      }
      if (updates.gameChannelId !== undefined) {
        setClauses.push('game_channel_id = ?');
        values.push(updates.gameChannelId);
      }
      if (updates.logChannelId !== undefined) {
        setClauses.push('log_channel_id = ?');
        values.push(updates.logChannelId);
      }
      if (updates.maxPlayersPerGame !== undefined) {
        setClauses.push('max_players_per_game = ?');
        values.push(updates.maxPlayersPerGame);
      }
      if (updates.minPlayersPerGame !== undefined) {
        setClauses.push('min_players_per_game = ?');
        values.push(updates.minPlayersPerGame);
      }
      if (updates.lobbyWaitSeconds !== undefined) {
        setClauses.push('lobby_wait_seconds = ?');
        values.push(updates.lobbyWaitSeconds);
      }
      if (updates.dropIntervalMin !== undefined) {
        setClauses.push('drop_interval_min = ?');
        values.push(updates.dropIntervalMin);
      }
      if (updates.dropIntervalMax !== undefined) {
        setClauses.push('drop_interval_max = ?');
        values.push(updates.dropIntervalMax);
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(guildId);

        this.db.execute(
          `UPDATE guild_config SET ${setClauses.join(', ')} WHERE guild_id = ?`,
          values
        );
      }

      this.cache.set(guildId, updated);
      SystemLogger.info('Guild config updated', { guildId, updates });
      return updated;
    } catch (error) {
      SystemLogger.error('GuildConfigService.update failed', { error, guildId, updates });
      throw new DatabaseError('Failed to update guild config', ERROR_CODES.QUERY_FAILED);
    }
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }

  get(guildId: string): GuildConfig | undefined {
    return this.cache.get(guildId);
  }
}

export const getGuildConfigService = (): GuildConfigService => {
  return new GuildConfigService();
};
