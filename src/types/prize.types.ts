export type PrizeType = 'coins' | 'role' | 'badge' | 'redeem' | 'virtual_item' | 'special_access';

export type PrizeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Prize {
  id: string;
  name: string;
  type: PrizeType;
  value: string;
  rarity: PrizeRarity;
}

export interface DeliveryResult {
  success: boolean;
  error?: Error;
  fallbackUsed?: boolean;
}

export interface WinnerDMData {
  userId: string;
  userMention: string;
  gameName: string;
  prizeName: string;
  rewardDescription: string;
  sessionId: string;
}
