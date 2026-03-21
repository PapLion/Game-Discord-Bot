export class BotError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'BotError';
  }
}

export class GameError extends BotError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'GameError';
  }
}

export class PrizeError extends BotError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'PrizeError';
  }
}

export class AuthError extends BotError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AuthError';
  }
}

export class DatabaseError extends BotError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'DatabaseError';
  }
}

export const ERROR_CODES = {
  NO_ACTIVE_SESSION: 'GAME_001',
  SESSION_FULL: 'GAME_002',
  GAME_ALREADY_STARTED: 'GAME_003',
  NOT_IN_SESSION: 'GAME_004',
  INSUFFICIENT_PLAYERS: 'GAME_005',

  NO_PENDING_PRIZES: 'PRIZE_001',
  REDEEM_CODE_CLAIMED: 'PRIZE_002',
  REDEEM_CODE_EXPIRED: 'PRIZE_003',
  NO_CODES_AVAILABLE: 'PRIZE_004',
  DM_FAILED: 'PRIZE_005',

  INSUFFICIENT_ROLE: 'AUTH_001',
  BANNED: 'AUTH_002',
  COOLDOWN_ACTIVE: 'AUTH_003',

  QUERY_FAILED: 'DB_001',
  MIGRATION_FAILED: 'DB_002',
} as const;
