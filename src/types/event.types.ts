import { GameType } from './game.types';
import { Prize } from './prize.types';

export interface GameWinnerEvent {
  sessionId: string;
  userId: string;
  gameType: GameType;
  prize: Prize;
  guildId: string;
}

export interface DropWinnerEvent {
  userId: string;
  prize: Prize;
  guildId: string;
  channelId: string;
}

export interface SessionStartedEvent {
  sessionId: string;
  gameType: GameType;
  channelId: string;
  guildId: string;
}

export interface SessionEndedEvent {
  sessionId: string;
  reason: 'finished' | 'cancelled' | 'no_players';
}

export interface RoundStartEvent {
  sessionId: string;
  roundNumber: number;
  question?: string;
}

export interface RoundEndEvent {
  sessionId: string;
  roundNumber: number;
  winnerId?: string;
  scores: Record<string, number>;
}
