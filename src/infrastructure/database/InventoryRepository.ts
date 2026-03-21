import { DatabaseService, getDatabaseService } from './DatabaseService';
import { SystemLogger } from '../logger/SystemLogger';

export interface InventoryEntry {
  id: string;
  itemType: string;
  itemId: string;
  itemName: string;
  rarity?: string;
  gameType?: string;
  expiresAt?: Date;
  obtainedAt: Date;
}

export class InventoryRepository {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db ?? getDatabaseService();
  }

  findUserInventory(userId: string): {
    badges: InventoryEntry[];
    items: InventoryEntry[];
    specialAccess: InventoryEntry[];
  } {
    try {
      const rows = this.db.run<{
        id: string;
        item_type: string;
        item_id: string;
        obtained_at: string;
      }>(
        `SELECT i.id, i.item_type, i.item_id, i.obtained_at
         FROM inventory i
         WHERE i.user_id = ?`,
        [userId]
      );

      const badges: InventoryEntry[] = [];
      const items: InventoryEntry[] = [];
      const specialAccess: InventoryEntry[] = [];

      for (const row of rows) {
        if (row.item_type === 'badge') {
          const badgeInfo = this.db.runOne<{ name: string; rarity: string }>(
            'SELECT name, rarity FROM badges WHERE id = ?',
            [row.item_id]
          );
          badges.push({
            id: row.id,
            itemType: row.item_type,
            itemId: row.item_id,
            itemName: badgeInfo?.name ?? 'Unknown Badge',
            rarity: badgeInfo?.rarity ?? 'common',
            obtainedAt: new Date(row.obtained_at),
          });
        } else if (row.item_type === 'virtual_item') {
          const itemInfo = this.db.runOne<{ name: string; game_type: string }>(
            'SELECT name, game_type FROM virtual_items WHERE id = ?',
            [row.item_id]
          );
          items.push({
            id: row.id,
            itemType: row.item_type,
            itemId: row.item_id,
            itemName: itemInfo?.name ?? 'Unknown Item',
            gameType: itemInfo?.game_type,
            obtainedAt: new Date(row.obtained_at),
          });
        } else if (row.item_type === 'special_access') {
          const accessInfo = this.db.runOne<{ expires_at: string }>(
            'SELECT expires_at FROM special_access WHERE id = ?',
            [row.item_id]
          );
          specialAccess.push({
            id: row.id,
            itemType: row.item_type,
            itemId: row.item_id,
            itemName: row.item_id,
            expiresAt: accessInfo?.expires_at ? new Date(accessInfo.expires_at) : undefined,
            obtainedAt: new Date(row.obtained_at),
          });
        }
      }

      return { badges, items, specialAccess };
    } catch (error) {
      SystemLogger.error('InventoryRepository.findUserInventory failed', { error, userId });
      return { badges: [], items: [], specialAccess: [] };
    }
  }
}
