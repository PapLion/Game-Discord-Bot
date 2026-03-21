import { describe, it, expect } from 'vitest';
import { EmbedFactory } from '../src/presentation/embeds/EmbedFactory';
import { EMBED_COLORS } from '../src/types/constants';

describe('EmbedFactory', () => {
  describe('game lifecycle', () => {
    it('gameAnnounce uses GAME_ANNOUNCE color', () => {
      const embed = EmbedFactory.gameAnnounce({
        gameType: 'trivia',
        gameName: 'Trivia Challenge',
        prize: '100 coins',
        startedBy: '@Admin',
        maxPlayers: 10,
        lobbyWaitSeconds: 30,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.GAME_ANNOUNCE);
      expect(embed.data.title).toContain('TRIVIA CHALLENGE');
    });

    it('gameLobby uses LOBBY color', () => {
      const embed = EmbedFactory.gameLobby({
        gameType: 'trivia',
        gameName: 'Trivia',
        players: [{ mention: '@Player1' }, { mention: '@Player2' }],
        totalPlayers: 2,
        maxPlayers: 10,
        countdown: 15,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.LOBBY);
      expect(embed.data.title).toContain('LOBBY');
    });

    it('roundStart uses ROUND_START color', () => {
      const embed = EmbedFactory.roundStart({
        roundNumber: 1,
        totalRounds: 5,
        question: 'What is 2+2?',
        timeoutSeconds: 15,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.ROUND_START);
      expect(embed.data.title).toContain('RONDA 1');
    });

    it('roundResult uses ROUND_RESULT color for correct answers', () => {
      const embed = EmbedFactory.roundResult({
        correct: true,
        winnerMention: '@Player1',
        answer: 'Tokio',
        points: 10,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.ROUND_RESULT);
    });

    it('roundTimeout uses ROUND_TIMEOUT color', () => {
      const embed = EmbedFactory.roundTimeout({
        correctAnswer: 'Tokio',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.ROUND_TIMEOUT);
      expect(embed.data.title).toContain('Tiempo agotado');
    });

    it('gameEnd uses GAME_END color', () => {
      const embed = EmbedFactory.gameEnd({
        gameName: 'Trivia',
        winnerMention: '@Player1',
        finalScore: 30,
        rankings: [
          { mention: '@Player1', score: 30, position: 1 },
          { mention: '@Player2', score: 20, position: 2 },
        ],
        prizeName: '100 coins',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.GAME_END);
      expect(embed.data.title).toContain('TERMINADO');
    });
  });

  describe('prize embeds', () => {
    it('winnerDM uses WINNER_DM color', () => {
      const embed = EmbedFactory.winnerDM({
        userMention: '@Player1',
        gameName: 'Trivia Challenge',
        prizeName: '100 Coins',
        rewardDescription: 'Rare Badge',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.WINNER_DM);
      expect(embed.data.title).toContain('You Won!');
    });

    it('winnerChannel uses WINNER_DM color', () => {
      const embed = EmbedFactory.winnerChannel({
        userMention: '@Player1',
        gameName: 'Trivia Challenge',
        prizeName: '100 Coins',
        rewardDescription: 'Rare Badge',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.WINNER_DM);
    });

    it('prizeDrop uses PRIZE_DROP color', () => {
      const embed = EmbedFactory.prizeDrop({
        prizeName: '200 Coins',
        prizeDescription: 'Quick reflexes needed!',
        reactionEmoji: '🎁',
        timeoutSeconds: 30,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.PRIZE_DROP);
      expect(embed.data.title).toContain('PRIZE DROP');
    });

    it('prizeDropWinner uses PRIZE_DROP color', () => {
      const embed = EmbedFactory.prizeDropWinner({
        winnerMention: '@Player1',
        prizeName: '200 Coins',
        prizeDescription: 'Fast hands!',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.PRIZE_DROP);
    });

    it('prizeDropExpired uses WARNING color', () => {
      const embed = EmbedFactory.prizeDropExpired();

      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });
  });

  describe('player command embeds', () => {
    it('score uses SCORE color', () => {
      const embed = EmbedFactory.score({
        userMention: '@Player1',
        coins: 1250,
        wins: 23,
        gamesPlayed: 47,
        streak: 5,
        winrate: 48,
        favoriteGame: 'Trivia',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.SCORE);
    });

    it('leaderboard uses LEADERBOARD color', () => {
      const embed = EmbedFactory.leaderboard({
        entries: [
          { position: 1, mention: '@Player1', value: 3450 },
          { position: 2, mention: '@Player2', value: 2890 },
        ],
        updatedAgo: '12s',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.LEADERBOARD);
    });

    it('inventory uses INVENTORY color', () => {
      const embed = EmbedFactory.inventory({
        userMention: '@Player1',
        badges: [{ name: 'Week Warrior', obtainedAt: '3d', rarity: 'rare' }],
        items: [],
        specialAccess: [],
      });

      expect(embed.data.color).toBe(EMBED_COLORS.INVENTORY);
    });

    it('history uses HISTORY color', () => {
      const embed = EmbedFactory.history({
        userMention: '@Player1',
        totalWins: 23,
        wins: [{ gameName: 'Trivia', prize: '100 coins', timeAgo: '2h' }],
      });

      expect(embed.data.color).toBe(EMBED_COLORS.HISTORY);
    });

    it('gamesList uses INFO color', () => {
      const embed = EmbedFactory.gamesList({
        builtin: [{ name: 'trivia', duration: '3-5min', rewards: '💰+🏅' }],
        special: [],
      });

      expect(embed.data.color).toBe(EMBED_COLORS.INFO);
    });

    it('gamesInfo uses INFO color', () => {
      const embed = EmbedFactory.gamesInfo({
        name: 'Trivia',
        description: 'Answer questions!',
        duration: '3-5min',
        minPlayers: 2,
        maxPlayers: 10,
        rounds: 5,
        prize: '100 coins',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.INFO);
    });
  });

  describe('daily/streak embeds', () => {
    it('dailyClaim uses DAILY_REWARD color', () => {
      const embed = EmbedFactory.dailyClaim({
        streak: 7,
        baseReward: 150,
        bonusReward: 100,
        multiplier: 3.0,
        totalReward: 750,
        badgeName: 'Week Warrior',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.DAILY_REWARD);
    });

    it('dailyAlreadyClaimed uses WARNING color', () => {
      const embed = EmbedFactory.dailyAlreadyClaimed({
        streak: 7,
        nextClaimIn: '14h 23m',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });

    it('streakBroken uses WARNING color', () => {
      const embed = EmbedFactory.streakBroken({
        previousStreak: 7,
        baseReward: 50,
      });

      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });
  });

  describe('admin embeds', () => {
    it('prizesPending uses ADMIN color', () => {
      const embed = EmbedFactory.prizesPending({
        prizes: [
          {
            id: '001',
            mention: '@Player1',
            prizeName: 'Redeem Code',
            gameName: 'Trivia',
            timeAgo: '2h',
          },
        ],
      });

      expect(embed.data.color).toBe(EMBED_COLORS.ADMIN);
    });

    it('codesLoaded uses SUCCESS color', () => {
      const embed = EmbedFactory.codesLoaded(15);

      expect(embed.data.color).toBe(EMBED_COLORS.SUCCESS);
    });

    it('customGameCreated uses SUCCESS color', () => {
      const embed = EmbedFactory.customGameCreated({
        name: 'Movie Trivia',
        baseType: 'Trivia',
        config: '5 rounds, 20s',
        prize: '200 coins',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.SUCCESS);
    });

    it('customGameSummary uses ADMIN color', () => {
      const embed = EmbedFactory.customGameSummary({
        name: 'Movie Trivia',
        baseType: 'Trivia',
        config: '5 rounds, 20s',
        prize: '200 coins',
      });

      expect(embed.data.color).toBe(EMBED_COLORS.ADMIN);
    });
  });

  describe('system embeds', () => {
    it('error uses ERROR color', () => {
      const embed = EmbedFactory.error('Something went wrong', 'Try again');

      expect(embed.data.color).toBe(EMBED_COLORS.ERROR);
      expect(embed.data.title).toContain('Error');
    });

    it('warning uses WARNING color', () => {
      const embed = EmbedFactory.warning('Be careful');

      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });

    it('success uses SUCCESS color', () => {
      const embed = EmbedFactory.success('Operation complete');

      expect(embed.data.color).toBe(EMBED_COLORS.SUCCESS);
    });

    it('info uses INFO color', () => {
      const embed = EmbedFactory.info('Here is some info');

      expect(embed.data.color).toBe(EMBED_COLORS.INFO);
    });

    it('cooldown uses WARNING color', () => {
      const embed = EmbedFactory.cooldown(1500);

      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
      expect(embed.data.title).toContain('Cooldown');
    });

    it('noPermission uses ERROR color', () => {
      const embed = EmbedFactory.noPermission('Admin');

      expect(embed.data.color).toBe(EMBED_COLORS.ERROR);
      expect(embed.data.title).toContain('Sin permisos');
    });
  });

  describe('EMBED_COLORS consistency', () => {
    it('all colors are defined as hex numbers', () => {
      const colorKeys = Object.keys(EMBED_COLORS);

      for (const key of colorKeys) {
        const color = EMBED_COLORS[key as keyof typeof EMBED_COLORS];
        expect(typeof color).toBe('number');
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThanOrEqual(0xffffff);
      }
    });

    it('gameAnnounce uses EMBED_COLORS.GAME_ANNOUNCE', () => {
      const embed = EmbedFactory.gameAnnounce({
        gameType: 'trivia',
        gameName: 'Test',
        prize: 'test',
        startedBy: 'test',
        maxPlayers: 10,
        lobbyWaitSeconds: 30,
      });
      expect(embed.data.color).toBe(EMBED_COLORS.GAME_ANNOUNCE);
    });

    it('error uses EMBED_COLORS.ERROR', () => {
      const embed = EmbedFactory.error('test');
      expect(embed.data.color).toBe(EMBED_COLORS.ERROR);
    });

    it('noPermission uses EMBED_COLORS.ERROR', () => {
      const embed = EmbedFactory.noPermission('Admin');
      expect(embed.data.color).toBe(EMBED_COLORS.ERROR);
    });
  });
});
