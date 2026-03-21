import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BaseGame } from '../base/BaseGame';
import { GameStrategy } from '../base/GameStrategy';
import { Participant } from '../../../types/game.types';
import { GAME_CONSTANTS } from '../../../types/GAME_CONSTANTS';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';

interface WordList {
  words: string[];
}

export class WordPuzzleGameStrategy implements GameStrategy {
  readonly gameType: 'wordpuzzle' = 'wordpuzzle';
  readonly gameName: string = 'Word Puzzle';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '50 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use WordPuzzleGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class WordPuzzleGame extends BaseGame {
  private wordList: string[] = [];
  private currentWord: string = '';
  private correctAnswer: string | null = null;
  private readonly POINTS_PER_CORRECT: number = 10;
  private attemptedParticipants: Set<string> = new Set();

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new WordPuzzleGameStrategy();
    super(
      strategy,
      channel,
      guild,
      startedBy,
      liveMessageManager,
      eventEmitter,
      db,
      guildConfigService
    );

    this.loadWordList();
    this.shuffleWordList();

    SystemLogger.info('WordPuzzleGame initialized', {
      sessionId: this.sessionId,
      wordCount: this.wordList.length,
    });
  }

  private loadWordList(): void {
    try {
      const wordlistPath = join(process.cwd(), 'config', 'wordlist.json');
      const content = readFileSync(wordlistPath, 'utf-8');
      const data: WordList = JSON.parse(content);
      this.wordList = data.words || [];
    } catch (error) {
      SystemLogger.error('Failed to load wordlist', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.wordList = ['default', 'words', 'fallback'];
    }
  }

  private shuffleWordList(): void {
    for (let i = this.wordList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.wordList[i], this.wordList[j]] = [this.wordList[j], this.wordList[i]];
    }
  }

  private scrambleWord(word: string): string {
    const chars = word.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const scrambled = chars.join('');
    if (scrambled === word && word.length > 1) {
      return this.scrambleWord(word);
    }
    return scrambled;
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      this.attemptedParticipants.clear();

      const wordIndex = (round - 1) % this.wordList.length;
      this.currentWord = this.wordList[wordIndex];
      this.correctAnswer = this.currentWord.toLowerCase();

      const scrambled = this.scrambleWord(this.currentWord);

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `📖 Unscramble: **${scrambled.toUpperCase()}**`,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const maxAttempts = this.getParticipants().length * 3;
      let winnerFound = false;

      for (let attempt = 0; attempt < maxAttempts && !winnerFound; attempt++) {
        const answer = await this.waitForAnswer(5000);
        const answeringDiscordId = this.getAnsweringDiscordId();

        if (answer === null || answeringDiscordId === null) {
          break;
        }

        if (this.attemptedParticipants.has(answeringDiscordId)) {
          continue;
        }

        this.attemptedParticipants.add(answeringDiscordId);

        const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

        if (isCorrect) {
          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, this.POINTS_PER_CORRECT);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendRoundMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: this.currentWord,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('Word puzzle round winner', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              word: this.currentWord,
            });

            winnerFound = true;
          }
        }
      }

      if (!winnerFound) {
        await this.sendRoundMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.currentWord,
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Word puzzle round timeout', { sessionId: this.sessionId, round });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('WordPuzzleGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) return null;

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('Word puzzle winner determined', {
        sessionId: this.sessionId,
        winnerDiscordId: winner.discordId,
        score: winner.score,
      });
    }

    return winner ?? null;
  }

  protected getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  protected findParticipantByDiscordId(discordId: string): Participant | undefined {
    return this.getParticipants().find(p => p.discordId === discordId);
  }

  protected async sendRoundMessage(embed: EmbedBuilder): Promise<Message> {
    return this.channel.send({
      embeds: [embed as any] as Parameters<typeof this.channel.send>[0] extends { embeds?: infer E }
        ? { embeds: E }
        : never,
    });
  }
}
