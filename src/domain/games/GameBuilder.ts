import { DatabaseService, getDatabaseService } from '../../infrastructure/database/DatabaseService';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { GameError, ERROR_CODES } from '../../types/errors';

export interface CustomGameConfig {
  name: string;
  baseType: string;
  rounds: number;
  secondsPerRound: number;
  prizeType: string;
  prizeValue: string;
  questions?: Array<{ question: string; answer: string }>;
}

export interface CustomGameRecord {
  id: string;
  guildId: string;
  name: string;
  baseType: string;
  config: string;
  createdBy: string;
  createdAt: Date;
}

export class GameBuilder {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  build(config: CustomGameConfig, guildId: string, createdBy: string): CustomGameRecord {
    this.validate(config);

    const id = this.generateId();
    const configJson = JSON.stringify({
      rounds: config.rounds,
      secondsPerRound: config.secondsPerRound,
      prizeType: config.prizeType,
      prizeValue: config.prizeValue,
      questions: config.questions ?? [],
    });

    try {
      this.db.execute(
        `INSERT INTO custom_games (id, guild_id, name, base_type, config, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          id,
          guildId,
          config.name.toLowerCase().replace(/\s+/g, ''),
          config.baseType,
          configJson,
          createdBy,
        ]
      );

      SystemLogger.info('GameBuilder: custom game created', {
        id,
        guildId,
        name: config.name,
        baseType: config.baseType,
      });

      const row = this.db.runOne<{
        id: string;
        guild_id: string;
        name: string;
        base_type: string;
        config: string;
        created_by: string;
        created_at: string;
      }>('SELECT * FROM custom_games WHERE id = ?', [id]);

      if (!row) {
        throw new Error('Failed to retrieve created game');
      }

      return {
        id: row.id,
        guildId: row.guild_id,
        name: row.name,
        baseType: row.base_type,
        config: row.config,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        throw new GameError(
          `Ya existe un juego con el nombre "${config.name}"`,
          ERROR_CODES.QUERY_FAILED
        );
      }
      SystemLogger.error('GameBuilder.build failed', { error, config, guildId });
      throw new GameError('No se pudo crear el juego', ERROR_CODES.QUERY_FAILED);
    }
  }

  private validate(config: CustomGameConfig): void {
    if (!config.name || config.name.length === 0) {
      throw new GameError('El nombre del juego es requerido', ERROR_CODES.QUERY_FAILED);
    }

    if (config.name.length > 30) {
      throw new GameError('El nombre debe tener máximo 30 caracteres', ERROR_CODES.QUERY_FAILED);
    }

    const validBaseTypes = ['trivia', 'reaction', 'guessing', 'elimination', 'luck'];
    if (!validBaseTypes.includes(config.baseType.toLowerCase())) {
      throw new GameError(
        `Tipo base inválido. Opciones: ${validBaseTypes.join(', ')}`,
        ERROR_CODES.QUERY_FAILED
      );
    }

    if (config.rounds < 1 || config.rounds > 10) {
      throw new GameError('Las rondas deben estar entre 1 y 10', ERROR_CODES.QUERY_FAILED);
    }

    if (config.secondsPerRound < 10 || config.secondsPerRound > 60) {
      throw new GameError(
        'Los segundos por ronda deben estar entre 10 y 60',
        ERROR_CODES.QUERY_FAILED
      );
    }

    if (config.baseType.toLowerCase() === 'trivia') {
      if (!config.questions || config.questions.length < 5) {
        throw new GameError('Las preguntas de trivia deben ser mínimo 5', ERROR_CODES.QUERY_FAILED);
      }
      if (config.questions.length > 20) {
        throw new GameError(
          'Las preguntas de trivia deben ser máximo 20',
          ERROR_CODES.QUERY_FAILED
        );
      }
    }

    const validPrizeTypes = ['coins', 'badge', 'virtual_item', 'role', 'redeem'];
    if (!validPrizeTypes.includes(config.prizeType.toLowerCase())) {
      throw new GameError(
        `Tipo de premio inválido. Opciones: ${validPrizeTypes.join(', ')}`,
        ERROR_CODES.QUERY_FAILED
      );
    }

    if (config.prizeType.toLowerCase() === 'coins') {
      const amount = parseInt(config.prizeValue, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new GameError(
          'El valor del premio debe ser un número positivo',
          ERROR_CODES.QUERY_FAILED
        );
      }
    }
  }

  private generateId(): string {
    const bytes = Buffer.alloc(16);
    const randomFillSync = require('crypto').randomFillSync;
    randomFillSync(bytes);
    return bytes.toString('hex');
  }

  listCustom(guildId: string): CustomGameRecord[] {
    try {
      const rows = this.db.run<{
        id: string;
        guild_id: string;
        name: string;
        base_type: string;
        config: string;
        created_by: string;
        created_at: string;
      }>('SELECT * FROM custom_games WHERE guild_id = ? ORDER BY created_at DESC', [guildId]);

      return rows.map(row => ({
        id: row.id,
        guildId: row.guild_id,
        name: row.name,
        baseType: row.base_type,
        config: row.config,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      SystemLogger.error('GameBuilder.listCustom failed', { error, guildId });
      return [];
    }
  }
}

export const gameBuilder = new GameBuilder();
