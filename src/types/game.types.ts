export type GameType =
  | 'trivia'
  | 'reaction'
  | 'math'
  | 'wordpuzzle'
  | 'dice'
  | 'spinwheel'
  | 'guessing'
  | 'elimination'
  | 'tournament'
  | 'eventtrivia'
  | 'highstakes'
  | 'midnightdrop'
  | 'bossbattle';

export type GameStatus = 'waiting' | 'active' | 'finished' | 'cancelled';

export interface GameSession {
  id: string;
  guildId: string;
  channelId: string;
  gameType: GameType;
  status: GameStatus;
  startedBy: string;
  createdAt: Date;
  endedAt?: Date;
}

export interface Participant {
  userId: string;
  discordId: string;
  score: number;
  isWinner: boolean;
  joinedAt: Date;
}

export interface GameContext {
  session: GameSession;
  participants: Participant[];
  currentRound: number;
  totalRounds: number;
}
