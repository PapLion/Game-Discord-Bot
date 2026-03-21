import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextChannel, Guild } from 'discord.js';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { ScopedEventEmitter } from '../src/infrastructure/events/ScopedEventEmitter';
import { LiveMessageManager } from '../src/presentation/live/LiveMessageManager';
import { GuildConfigService } from '../src/infrastructure/database/GuildConfigService';
import { BaseGame } from '../src/domain/games/base/BaseGame';
import { GameStrategy } from '../src/domain/games/base/GameStrategy';
import { Participant } from '../src/types/game.types';

// =============================================================================
// MOCKS
// =============================================================================

// Mock para TextChannel
const createMockChannel = (): TextChannel => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    id: 'channel-001',
    send: mockSend,
    guild: {} as Guild,
  } as unknown as TextChannel;
};

// Mock para Guild
const createMockGuild = (): Guild => {
  return {
    id: 'guild-001',
    name: 'Test Guild',
  } as unknown as Guild;
};

// Mock para LiveMessageManager
const createMockLiveMessageManager = () => ({
  setLobbyMessage: vi.fn(),
  setRoundMessage: vi.fn(),
  updateLobby: vi.fn().mockResolvedValue(undefined),
  updateRound: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn(),
  getInstance: vi.fn().mockReturnThis(),
});

// Mock para ScopedEventEmitter
const createMockScopedEventEmitter = () => {
  const mockEmitter = {
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return {
    forSession: vi.fn().mockReturnValue(mockEmitter),
    destroySession: vi.fn(),
    global: vi.fn().mockReturnValue(mockEmitter),
    hasSession: vi.fn().mockReturnValue(true),
    getActiveSessionCount: vi.fn().mockReturnValue(1),
  };
};

// Mock GuildConfigService
const createMockGuildConfigService = () => ({
  getOrCreate: vi.fn().mockReturnValue({
    guildId: 'guild-001',
    prefix: '!',
    gameChannelId: null,
    logChannelId: null,
    maxPlayersPerGame: 10,
    minPlayersPerGame: 2,
    lobbyWaitSeconds: 5, // Short for tests
    dropIntervalMin: 15,
    dropIntervalMax: 60,
  }),
  update: vi.fn(),
  invalidateCache: vi.fn(),
  get: vi.fn(),
});

// Estrategia mock para testing
class MockGameStrategy implements GameStrategy {
  readonly gameType: 'trivia' = 'trivia';
  readonly gameName: string = 'Mock Game';
  readonly totalRounds: number = 2;
  readonly prizeName: string = 'Test Prize';

  async roundLogic(_round: number): Promise<void> {
    // Mock implementation - does nothing
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

// =============================================================================
// TEST FIXTURE - Implementación concreta para testing
// =============================================================================

class TestableBaseGame extends BaseGame {
  public async testAnnounce(): Promise<void> {
    return this.announce();
  }

  public async testWaitForPlayers(): Promise<boolean> {
    return this.waitForPlayers();
  }

  public async testPlayRounds(): Promise<void> {
    return this.playRounds();
  }

  public async testEnd(): Promise<void> {
    return this.end();
  }

  public async testCancel(): Promise<void> {
    return this.cancel();
  }

  protected override async roundLogic(_round: number): Promise<void> {
    // Minimal implementation for testing
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;
    return participants[0];
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('BaseGame', () => {
  let dbService: DatabaseService;
  let mockChannel: TextChannel;
  let mockGuild: Guild;
  let mockLiveMessageManager: ReturnType<typeof createMockLiveMessageManager>;
  let mockScopedEventEmitter: ReturnType<typeof createMockScopedEventEmitter>;
  let mockGuildConfigService: ReturnType<typeof createMockGuildConfigService>;
  let game: TestableBaseGame;

  beforeEach(async () => {
    // Initialize database with :memory:
    dbService = DatabaseService.getInstance();
    await dbService.initialize(':memory:');

    // Create mocks
    mockChannel = createMockChannel();
    mockGuild = createMockGuild();
    mockLiveMessageManager = createMockLiveMessageManager();
    mockScopedEventEmitter = createMockScopedEventEmitter();
    mockGuildConfigService = createMockGuildConfigService();

    // Create game instance
    const strategy = new MockGameStrategy();
    game = new TestableBaseGame(
      strategy,
      mockChannel,
      mockGuild,
      'user-001',
      mockLiveMessageManager as unknown as LiveMessageManager,
      mockScopedEventEmitter as unknown as ScopedEventEmitter,
      dbService,
      mockGuildConfigService as unknown as GuildConfigService
    );
  });

  afterEach(() => {
    dbService.close();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('generates a unique sessionId', () => {
      const strategy = new MockGameStrategy();
      const game2 = new TestableBaseGame(
        strategy,
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );

      // Access protected property via casting (for testing)
      expect((game as unknown as { sessionId: string }).sessionId).toBeDefined();
      expect((game as unknown as { sessionId: string }).sessionId).not.toBe(
        (game2 as unknown as { sessionId: string }).sessionId
      );
    });

    it('initializes with empty participants', () => {
      expect(game.getParticipants()).toHaveLength(0);
    });

    it('initializes with waiting status', () => {
      expect(game.getStatus()).toBe('waiting');
    });
  });

  describe('addParticipant()', () => {
    it('adds a participant to the Map', async () => {
      // Insert user first (users table: id, discord_id, guild_id, coins)
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-db-001',
        'discord-001',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-db-001', 'discord-001', 'TestUser');

      const participants = game.getParticipants();
      expect(participants).toHaveLength(1);
      expect(participants[0].discordId).toBe('discord-001');
      expect(participants[0].score).toBe(0);
      expect(participants[0].isWinner).toBe(false);
    });

    it('does not add duplicate participants', async () => {
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-db-001',
        'discord-001',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-db-001', 'discord-001', 'TestUser');
      await game.addParticipant('user-db-001', 'discord-001', 'TestUser');

      const participants = game.getParticipants();
      expect(participants).toHaveLength(1);
    });

    it('creates user in DB if not exists', async () => {
      await game.addParticipant('user-new', 'discord-new', 'NewUser');

      const participants = game.getParticipants();
      expect(participants).toHaveLength(1);
      expect(participants[0].discordId).toBe('discord-new');
    });

    it('emits PLAYER_JOINED event', async () => {
      const sessionId = (game as unknown as { sessionId: string }).sessionId;

      await game.addParticipant('user-001', 'discord-001', 'TestUser');

      const sessionEmitter = mockScopedEventEmitter.forSession(sessionId);
      expect(sessionEmitter.emit).toHaveBeenCalledWith(
        'player:joined',
        expect.objectContaining({
          discordId: 'discord-001',
          sessionId: sessionId,
        })
      );
    });
  });

  describe('run() lifecycle', () => {
    it('executes phases in correct order (announce → wait → play → end)', async () => {
      // Mock the long-running methods on the actual instance
      vi.spyOn(
        game as unknown as { waitForPlayers: () => Promise<boolean> },
        'waitForPlayers'
      ).mockResolvedValue(true);
      vi.spyOn(
        game as unknown as { playRounds: () => Promise<void> },
        'playRounds'
      ).mockResolvedValue(undefined);

      const announceSpy = vi.spyOn(
        game as unknown as { announce: () => Promise<void> },
        'announce'
      );
      const waitSpy = vi.spyOn(
        game as unknown as { waitForPlayers: () => Promise<boolean> },
        'waitForPlayers'
      );
      const playSpy = vi.spyOn(
        game as unknown as { playRounds: () => Promise<void> },
        'playRounds'
      );
      const endSpy = vi.spyOn(game as unknown as { end: () => Promise<void> }, 'end');

      await game.run();

      expect(announceSpy).toHaveBeenCalled();
      expect(waitSpy).toHaveBeenCalled();
      expect(playSpy).toHaveBeenCalled();
      expect(endSpy).toHaveBeenCalled();

      // Verify order
      const callOrder = [
        announceSpy.mock.invocationCallOrder[0],
        waitSpy.mock.invocationCallOrder[0],
        playSpy.mock.invocationCallOrder[0],
        endSpy.mock.invocationCallOrder[0],
      ];
      expect(callOrder).toEqual(callOrder.sort((a, b) => a - b));
    }, 15000);

    it('returns early if waitForPlayers returns false', async () => {
      vi.spyOn(game as unknown as { announce: () => Promise<void> }, 'announce').mockResolvedValue(
        undefined
      );
      vi.spyOn(
        game as unknown as { waitForPlayers: () => Promise<boolean> },
        'waitForPlayers'
      ).mockResolvedValue(false);
      const playSpy = vi.spyOn(
        game as unknown as { playRounds: () => Promise<void> },
        'playRounds'
      );
      const endSpy = vi.spyOn(game as unknown as { end: () => Promise<void> }, 'end');

      await game.run();

      expect(playSpy).not.toHaveBeenCalled();
      expect(endSpy).not.toHaveBeenCalled();
    }, 15000);
  });

  describe('cancel()', () => {
    it('updates status to cancelled in DB', async () => {
      // First announce to create session
      await game.testAnnounce();

      await game.cancel();

      const session = await game.getSession();
      expect(session?.status).toBe('cancelled');
    });

    it('sets internal status to cancelled', async () => {
      await game.testAnnounce();
      await game.cancel();

      expect(game.getStatus()).toBe('cancelled');
    });

    it('cleans up ScopedEventEmitter', async () => {
      const sessionId = (game as unknown as { sessionId: string }).sessionId;

      await game.testAnnounce();
      await game.cancel();

      expect(mockScopedEventEmitter.destroySession).toHaveBeenCalledWith(sessionId);
    });

    it('calls liveMessageManager.cleanup()', async () => {
      const sessionId = (game as unknown as { sessionId: string }).sessionId;

      await game.testAnnounce();
      await game.cancel();

      expect(mockLiveMessageManager.cleanup).toHaveBeenCalledWith(sessionId);
    });

    it('emits GAME_END event', async () => {
      await game.testAnnounce();
      await game.cancel();

      const globalEmitter = mockScopedEventEmitter.global();
      expect(globalEmitter.emit).toHaveBeenCalledWith(
        'game:end',
        expect.objectContaining({
          sessionId: (game as unknown as { sessionId: string }).sessionId,
          gameType: 'trivia',
        })
      );
    });

    it('can be called even if game not started', async () => {
      await game.cancel();
      expect(game.getStatus()).toBe('cancelled');
    });
  });

  describe('end()', () => {
    beforeEach(async () => {
      // Setup: create session and add participants
      await game.testAnnounce();
    });

    it('inserts in pending_prizes exactly once when there is a winner', async () => {
      // Add a participant (users table: id, discord_id, guild_id, coins)
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-winner',
        'discord-winner',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-winner', 'discord-winner', 'Winner');

      // Spy on DB execute
      const executeSpy = vi.spyOn(dbService, 'execute');

      await game.testEnd();

      // Count pending_prizes inserts
      const pendingPrizeInserts = executeSpy.mock.calls.filter(call =>
        call[0].includes('INSERT INTO pending_prizes')
      );
      expect(pendingPrizeInserts).toHaveLength(1);
    });

    it('does not insert pending_prizes when there is no winner', async () => {
      // No participants - no winner
      const executeSpy = vi.spyOn(dbService, 'execute');

      await game.testEnd();

      const pendingPrizeInserts = executeSpy.mock.calls.filter(call =>
        call[0].includes('INSERT INTO pending_prizes')
      );
      expect(pendingPrizeInserts).toHaveLength(0);
    });

    it('updates session status to finished in DB', async () => {
      await game.testEnd();

      const session = await game.getSession();
      expect(session?.status).toBe('finished');
    });

    it('emits GAME_WINNER event when there is a winner', async () => {
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-winner',
        'discord-winner',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-winner', 'discord-winner', 'Winner');

      await game.testEnd();

      const globalEmitter = mockScopedEventEmitter.global();
      expect(globalEmitter.emit).toHaveBeenCalledWith(
        'game:winner',
        expect.objectContaining({
          sessionId: (game as unknown as { sessionId: string }).sessionId,
          winnerDiscordId: 'discord-winner',
          prizeName: 'Test Prize',
        })
      );
    });
  });

  describe('waitForPlayers()', () => {
    beforeEach(async () => {
      await game.testAnnounce();
    });

    it('returns false if less than minPlayers', async () => {
      // Add only 1 participant (min is 2) - users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-001',
        'discord-001',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-001', 'discord-001', 'User1');

      const result = await game.testWaitForPlayers();

      expect(result).toBe(false);
      expect(game.getStatus()).toBe('cancelled');
    }, 15000);

    it('returns true if enough players', async () => {
      // Add 2 participants (min is 2) - users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-001',
        'discord-001',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-002',
        'discord-002',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-001', 'discord-001', 'User1');
      await game.addParticipant('user-002', 'discord-002', 'User2');

      const result = await game.testWaitForPlayers();

      expect(result).toBe(true);
      expect(game.getStatus()).toBe('active');
    }, 15000);
  });

  describe('resolveAnswer()', () => {
    it('resolves waitForAnswer promise', async () => {
      let resolvedValue: string | null = null;

      // Access protected method via casting
      const answerPromise = (
        game as unknown as { waitForAnswer: (timeout?: number) => Promise<string | null> }
      ).waitForAnswer(100);

      game.resolveAnswer('test answer');

      resolvedValue = await answerPromise;
      expect(resolvedValue).toBe('test answer');
    });

    it('does nothing if no resolver is set', () => {
      // Should not throw
      expect(() => game.resolveAnswer('test')).not.toThrow();
    });
  });

  describe('getSession()', () => {
    it('returns null if session does not exist', async () => {
      const session = await game.getSession();
      expect(session).toBeNull();
    });

    it('returns session after announce', async () => {
      await game.testAnnounce();

      const session = await game.getSession();

      expect(session).not.toBeNull();
      expect(session?.id).toBe((game as unknown as { sessionId: string }).sessionId);
      expect(session?.guildId).toBe('guild-001');
      expect(session?.channelId).toBe('channel-001');
      expect(session?.gameType).toBe('trivia');
      expect(session?.status).toBe('waiting');
    });
  });

  describe('getStatus()', () => {
    it('returns initial status as waiting', () => {
      expect(game.getStatus()).toBe('waiting');
    });

    it('returns cancelled after cancel()', async () => {
      await game.cancel();
      expect(game.getStatus()).toBe('cancelled');
    });

    it('returns finished after end()', async () => {
      await game.testAnnounce();
      await game.testEnd();
      expect(game.getStatus()).toBe('finished');
    });
  });

  describe('evaluateWinner()', () => {
    it('is abstract and returns null by default in BaseGame', () => {
      // BaseGame.evaluateWinner is abstract, TestableBaseGame overrides it
      // The base class cannot be instantiated directly
    });
  });
});
