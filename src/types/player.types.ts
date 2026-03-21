import { GameType } from './game.types';

export interface User {
  id: string;
  discordId: string;
  guildId: string;
  coins: number;
  streak: number;
  lastDaily?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameWinner {
  id: string;
  sessionId: string;
  userId: string;
  gameType: GameType;
  prizeId?: string;
  score: number;
  wonAt: Date;
}

export interface InventoryItem {
  id: string;
  userId: string;
  itemType: 'badge' | 'virtual_item' | 'special_access';
  itemId: string;
  obtainedAt: Date;
}
