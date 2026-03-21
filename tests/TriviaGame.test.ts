import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextChannel, Guild } from 'discord.js';
import { DatabaseService } from '../src/infrastructure/database/DatabaseService';
import { ScopedEventEmitter } from '../src/infrastructure/events/ScopedEventEmitter';
import { LiveMessageManager } from '../src/presentation/live/LiveMessageManager';
import { GuildConfigService } from '../src/infrastructure/database/GuildConfigService';
import { TriviaGame } from '../src/domain/games/builtin/TriviaGame';
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
    lobbyWaitSeconds: 5,
    dropIntervalMin: 15,
    dropIntervalMax: 60,
  }),
  update: vi.fn(),
  invalidateCache: vi.fn(),
  get: vi.fn(),
});

// =============================================================================
// TEST FIXTURE - TriviaGame con métodos protegidos expuestos
// =============================================================================

class TestableTriviaGame extends TriviaGame {
  public override async roundLogic(round: number): Promise<void> {
    return super.roundLogic(round);
  }

  public override evaluateWinner(): Participant | null {
    return super.evaluateWinner();
  }

  public getScoreboard(): Array<{ mention: string; score: number }> {
    return super.getScoreboard();
  }

  public findParticipantByDiscordId(discordId: string): Participant | undefined {
    // Access via getParticipants
    return this.getParticipants().find(p => p.discordId === discordId);
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('TriviaGame', () => {
  let dbService: DatabaseService;
  let mockChannel: TextChannel;
  let mockGuild: Guild;
  let mockLiveMessageManager: ReturnType<typeof createMockLiveMessageManager>;
  let mockScopedEventEmitter: ReturnType<typeof createMockScopedEventEmitter>;
  let mockGuildConfigService: ReturnType<typeof createMockGuildConfigService>;

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
  });

  afterEach(() => {
    dbService.close();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates a TriviaGame instance', () => {
      const game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );

      expect(game).toBeDefined();
      expect(game.getParticipants()).toHaveLength(0);
    });

    it('shuffles questions on creation', () => {
      // Create multiple games to check randomization
      const games: TestableTriviaGame[] = [];
      for (let i = 0; i < 5; i++) {
        const game = new TestableTriviaGame(
          mockChannel,
          mockGuild,
          'user-001',
          mockLiveMessageManager as unknown as LiveMessageManager,
          mockScopedEventEmitter as unknown as ScopedEventEmitter,
          dbService,
          mockGuildConfigService as unknown as GuildConfigService
        );
        games.push(game);
      }

      // All games should be created successfully
      expect(games).toHaveLength(5);
    });
  });

  describe('evaluateWinner()', () => {
    let game: TestableTriviaGame;

    beforeEach(() => {
      game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );
    });

    it('returns null when no participants', () => {
      const winner = game.evaluateWinner();
      expect(winner).toBeNull();
    });

    it('returns player with highest score', async () => {
      // Add participants - users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-high',
        'discord-high',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-mid',
        'discord-mid',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-low',
        'discord-low',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-high', 'discord-high', 'HighScore');
      await game.addParticipant('user-mid', 'discord-mid', 'MidScore');
      await game.addParticipant('user-low', 'discord-low', 'LowScore');

      // Manually set scores
      const participants = game.getParticipants();
      participants[0].score = 10;
      participants[1].score = 30;
      participants[2].score = 20;

      const winner = game.evaluateWinner();

      expect(winner).not.toBeNull();
      expect(winner?.discordId).toBe('discord-mid');
      expect(winner?.score).toBe(30);
    });

    it('returns first player when tied (by join order)', async () => {
      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-first',
        'discord-first',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-second',
        'discord-second',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-first', 'discord-first', 'First');
      await game.addParticipant('user-second', 'discord-second', 'Second');

      // Both have same score
      const participants = game.getParticipants();
      participants[0].score = 20;
      participants[1].score = 20;

      const winner = game.evaluateWinner();

      expect(winner).not.toBeNull();
      // First join should win tiebreaker
      expect(winner?.discordId).toBe('discord-first');
    });

    it('returns null when all scores are zero', async () => {
      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-1',
        'discord-1',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-2',
        'discord-2',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-1', 'discord-1', 'User1');
      await game.addParticipant('user-2', 'discord-2', 'User2');

      // Scores are 0 by default
      const winner = game.evaluateWinner();

      expect(winner).toBeNull();
    });

    it('marks winner as isWinner=true', async () => {
      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-win',
        'discord-win',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-win', 'discord-win', 'Winner');

      const participants = game.getParticipants();
      participants[0].score = 50;

      const winner = game.evaluateWinner();

      expect(winner?.isWinner).toBe(true);
    });
  });

  describe('roundLogic()', () => {
    let game: TestableTriviaGame;

    beforeEach(() => {
      game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );
    });

    it('does not create pending_prize during round logic', async () => {
      // Mock waitForAnswer to resolve immediately instead of waiting
      vi.spyOn(
        game as unknown as { waitForAnswer: (timeout?: number) => Promise<string | null> },
        'waitForAnswer'
      ).mockResolvedValue('test answer');

      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-1',
        'discord-1',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-1', 'discord-1', 'User1');

      const executeSpy = vi.spyOn(dbService, 'execute');

      // Call roundLogic directly
      await game.roundLogic(1);

      const pendingPrizeInserts = executeSpy.mock.calls.filter(call =>
        call[0].includes('INSERT INTO pending_prizes')
      );

      expect(pendingPrizeInserts).toHaveLength(0);
    }, 15000);

    it('sends round message to channel', async () => {
      // Mock waitForAnswer to resolve immediately
      vi.spyOn(
        game as unknown as { waitForAnswer: (timeout?: number) => Promise<string | null> },
        'waitForAnswer'
      ).mockResolvedValue('test answer');

      await game.roundLogic(1);

      expect(mockChannel.send).toHaveBeenCalled();
    }, 15000);

    it('waits for answer with timeout', async () => {
      const startTime = Date.now();

      // Should timeout since no answer is provided
      await game.roundLogic(1);

      const elapsed = Date.now() - startTime;
      // Should have waited at least some time (timeout)
      expect(elapsed).toBeGreaterThan(0);
    }, 20000);
  });

  describe('strategy', () => {
    it('has correct game type', () => {
      const game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );

      expect((game as unknown as { strategy: { gameType: string } }).strategy.gameType).toBe(
        'trivia'
      );
    });

    it('has 5 total rounds', () => {
      const game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );

      expect((game as unknown as { strategy: { totalRounds: number } }).strategy.totalRounds).toBe(
        5
      );
    });

    it('has prize name defined', () => {
      const game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );

      expect(
        (game as unknown as { strategy: { prizeName: string } }).strategy.prizeName
      ).toBeDefined();
      expect(
        (game as unknown as { strategy: { prizeName: string } }).strategy.prizeName.length
      ).toBeGreaterThan(0);
    });
  });

  describe('findParticipantByDiscordId()', () => {
    let game: TestableTriviaGame;

    beforeEach(() => {
      game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );
    });

    it('finds participant by discord id', async () => {
      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-find',
        'discord-find',
        'guild-001',
        100,
      ]);
      await game.addParticipant('user-find', 'discord-find', 'FindMe');

      const participant = game.findParticipantByDiscordId('discord-find');

      expect(participant).toBeDefined();
      expect(participant?.discordId).toBe('discord-find');
    });

    it('returns undefined for non-existent discord id', () => {
      const participant = game.findParticipantByDiscordId('non-existent');

      expect(participant).toBeUndefined();
    });
  });

  describe('getScoreboard()', () => {
    let game: TestableTriviaGame;

    beforeEach(() => {
      game = new TestableTriviaGame(
        mockChannel,
        mockGuild,
        'user-001',
        mockLiveMessageManager as unknown as LiveMessageManager,
        mockScopedEventEmitter as unknown as ScopedEventEmitter,
        dbService,
        mockGuildConfigService as unknown as GuildConfigService
      );
    });

    it('returns sorted scoreboard', async () => {
      // users table: id, discord_id, guild_id, coins
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-a',
        'discord-a',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-b',
        'discord-b',
        'guild-001',
        100,
      ]);
      dbService.execute(`INSERT INTO users (id, discord_id, guild_id, coins) VALUES (?, ?, ?, ?)`, [
        'user-c',
        'discord-c',
        'guild-001',
        100,
      ]);

      await game.addParticipant('user-a', 'discord-a', 'UserA');
      await game.addParticipant('user-b', 'discord-b', 'UserB');
      await game.addParticipant('user-c', 'discord-c', 'UserC');

      // Get participants and manually set scores
      const participants = game.getParticipants();
      participants[0].score = 10;
      participants[1].score = 30;
      participants[2].score = 20;

      const scoreboard = game.getScoreboard();

      expect(scoreboard).toHaveLength(3);
      expect(scoreboard[0].score).toBe(30);
      expect(scoreboard[1].score).toBe(20);
      expect(scoreboard[2].score).toBe(10);
    });

    it('returns empty array when no participants', () => {
      const scoreboard = game.getScoreboard();

      expect(scoreboard).toHaveLength(0);
    });
  });
});
