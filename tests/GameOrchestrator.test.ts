import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameRegistry } from '../src/infrastructure/plugins/GameRegistry';
import { GameStrategy } from '../src/domain/games/base/GameStrategy';
import { GameType } from '../src/types/game.types';

// =============================================================================
// TEST HELPERS - Create mock strategies with valid GameType
// =============================================================================

const createMockStrategy = (gameType: GameType): GameStrategy => ({
  gameType,
  gameName: `${gameType} Game`,
  totalRounds: 3,
  prizeName: `${gameType} Prize`,
  roundLogic: vi.fn().mockResolvedValue(undefined),
  evaluateWinner: vi.fn().mockReturnValue(null),
});

// =============================================================================
// TESTS
// =============================================================================

describe('GameRegistry', () => {
  let registry: GameRegistry;

  beforeEach(() => {
    registry = new GameRegistry();
  });

  describe('register()', () => {
    it('registers a game strategy', () => {
      const mockStrategy = createMockStrategy('trivia');

      registry.register(mockStrategy);

      expect(registry.has('trivia')).toBe(true);
    });

    it('does not register duplicate game type', () => {
      const mockStrategy1 = createMockStrategy('reaction');
      const mockStrategy2 = createMockStrategy('reaction');

      registry.register(mockStrategy1);
      registry.register(mockStrategy2);

      const retrieved = registry.get('reaction');
      expect(retrieved?.gameName).toBe('reaction Game');
    });
  });

  describe('get()', () => {
    it('returns undefined for non-existent game type', () => {
      const result = registry.get('nonexistent' as GameType);
      expect(result).toBeUndefined();
    });

    it('returns registered strategy', () => {
      const mockStrategy = createMockStrategy('math');

      registry.register(mockStrategy);

      const result = registry.get('math');
      expect(result).toBeDefined();
      expect(result?.gameName).toBe('math Game');
    });
  });

  describe('getAll()', () => {
    it('returns empty array when no games registered', () => {
      const result = registry.getAll();
      expect(result).toHaveLength(0);
    });

    it('returns all registered strategies', () => {
      const mockStrategy1 = createMockStrategy('dice');
      const mockStrategy2 = createMockStrategy('guessing');

      registry.register(mockStrategy1);
      registry.register(mockStrategy2);

      const result = registry.getAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('has()', () => {
    it('returns false for non-existent game', () => {
      expect(registry.has('nonexistent' as GameType)).toBe(false);
    });

    it('returns true for registered game', () => {
      const mockStrategy = createMockStrategy('spinwheel');

      registry.register(mockStrategy);

      expect(registry.has('spinwheel')).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('removes registered game', () => {
      const mockStrategy = createMockStrategy('elimination');

      registry.register(mockStrategy);
      expect(registry.has('elimination')).toBe(true);

      registry.unregister('elimination');
      expect(registry.has('elimination')).toBe(false);
    });

    it('does nothing when removing non-existent game', () => {
      expect(() => registry.unregister('nonexistent' as GameType)).not.toThrow();
    });
  });

  describe('getGameNames()', () => {
    it('returns empty array when no games', () => {
      const names = registry.getGameNames();
      expect(names).toHaveLength(0);
    });

    it('returns names of all registered games', () => {
      const mockStrategy1 = createMockStrategy('tournament');
      const mockStrategy2 = createMockStrategy('eventtrivia');

      registry.register(mockStrategy1);
      registry.register(mockStrategy2);

      const names = registry.getGameNames();
      expect(names).toContain('tournament Game');
      expect(names).toContain('eventtrivia Game');
    });
  });

  describe('getGameInfo()', () => {
    it('returns info for all registered games', () => {
      const mockStrategy = createMockStrategy('highstakes');

      registry.register(mockStrategy);

      const info = registry.getGameInfo();
      expect(info).toHaveLength(1);
      expect(info[0]).toEqual({
        type: 'highstakes',
        name: 'highstakes Game',
        rounds: 3,
        prize: 'highstakes Prize',
      });
    });
  });
});
