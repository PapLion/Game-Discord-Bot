import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
import { BaseGame } from '../base/BaseGame';
import { GameStrategy } from '../base/GameStrategy';
import { Participant } from '../../../types/game.types';
import { GAME_CONSTANTS } from '../../../types/constants';
import { EmbedFactory } from '../../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { LiveMessageManager } from '../../../presentation/live/LiveMessageManager';
import { ScopedEventEmitter } from '../../../infrastructure/events/ScopedEventEmitter';
import { DatabaseService } from '../../../infrastructure/database/DatabaseService';
import { GuildConfigService } from '../../../infrastructure/database/GuildConfigService';

export class EliminationGameStrategy implements GameStrategy {
  readonly gameType: 'elimination' = 'elimination';
  readonly gameName: string = 'Elimination';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '100 Coins + Rare Badge';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use EliminationGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class PlayerPool implements Iterable<Participant> {
  private players: Map<string, Participant> = new Map();

  add(player: Participant): void {
    this.players.set(player.userId, player);
  }

  remove(userId: string): boolean {
    return this.players.delete(userId);
  }

  has(userId: string): boolean {
    return this.players.has(userId);
  }

  get(userId: string): Participant | undefined {
    return this.players.get(userId);
  }

  getAll(): Participant[] {
    return Array.from(this.players.values());
  }

  getActiveCount(): number {
    return this.players.size;
  }

  [Symbol.iterator](): Iterator<Participant> {
    return this.players.values();
  }

  iterator(): Iterator<Participant> {
    return this[Symbol.iterator]();
  }
}

const ELIMINATION_QUESTIONS = [
  'What is 5 + 3?',
  'What is 12 - 4?',
  'What is 6 × 7?',
  'What is 20 ÷ 4?',
  'What is 9 + 9?',
] as const;

export class EliminationGame extends BaseGame {
  private playerPool: PlayerPool;
  private currentQuestion: string = '';
  private correctAnswer: string = '';
  private eliminatedThisRound: string | null = null;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new EliminationGameStrategy();
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

    this.playerPool = new PlayerPool();

    SystemLogger.info('EliminationGame initialized', {
      sessionId: this.sessionId,
    });
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      this.eliminatedThisRound = null;

      const questionIndex = (round - 1) % ELIMINATION_QUESTIONS.length;
      const q = ELIMINATION_QUESTIONS[questionIndex];
      this.currentQuestion = q;

      const answers: Record<string, string> = {
        'What is 5 + 3?': '8',
        'What is 12 - 4?': '8',
        'What is 6 × 7?': '42',
        'What is 20 ÷ 4?': '5',
        'What is 9 + 9?': '18',
      };
      this.correctAnswer = answers[q] || '0';

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `🗡️ ${q} — Answer correctly to survive!`,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const activePlayers = this.playerPool.getActiveCount();

      if (activePlayers <= 1) {
        return;
      }

      let correctAnswerer: { discordId: string; userId: string } | null = null;

      const maxAttempts = activePlayers * 2;
      for (let attempt = 0; attempt < maxAttempts && !correctAnswerer; attempt++) {
        const answer = await this.waitForAnswer(5000);
        const answeringDiscordId = this.getAnsweringDiscordId();

        if (answer === null || answeringDiscordId === null) {
          break;
        }

        const participant = this.findParticipantByDiscordId(answeringDiscordId);
        if (!participant || !this.playerPool.has(participant.userId)) {
          continue;
        }

        if (answer.toLowerCase().trim() === this.correctAnswer.toLowerCase()) {
          correctAnswerer = {
            discordId: answeringDiscordId,
            userId: participant.userId,
          };
        }
      }

      if (correctAnswerer) {
        const participant = this.playerPool.get(correctAnswerer.userId);
        if (participant) {
          await this.updateScore(participant.userId, 10);

          const winnerMention = `<@${participant.discordId}>`;
          await this.sendRoundMessage(
            EmbedFactory.roundResult({
              correct: true,
              winnerMention,
              answer: this.correctAnswer,
              points: 10,
              scores: this.getScoreboard(),
            })
          );

          SystemLogger.info('Elimination round survivor', {
            sessionId: this.sessionId,
            round,
            discordId: participant.discordId,
            remaining: this.playerPool.getActiveCount(),
          });
        }
      } else {
        const activePlayersList = this.playerPool.getAll();
        if (activePlayersList.length > 0) {
          const toEliminate =
            activePlayersList[Math.floor(Math.random() * activePlayersList.length)];
          this.playerPool.remove(toEliminate.userId);
          this.eliminatedThisRound = toEliminate.discordId;

          const eliminatedMention = `<@${toEliminate.discordId}>`;
          await this.sendRoundMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: `${eliminatedMention} was eliminated!`,
              scores: this.getScoreboard(),
            })
          );

          SystemLogger.info('Elimination round - player eliminated', {
            sessionId: this.sessionId,
            round,
            eliminatedDiscordId: toEliminate.discordId,
            remaining: this.playerPool.getActiveCount(),
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('EliminationGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  public async addParticipant(userId: string, discordId: string, _username: string): Promise<void> {
    await super.addParticipant(userId, discordId, _username);

    const participant = this.participants.get(userId);
    if (participant) {
      this.playerPool.add(participant);
    }
  }

  protected override evaluateWinner(): Participant | null {
    const activePlayers = this.playerPool.getAll();

    if (activePlayers.length === 0) {
      return null;
    }

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.isWinner = true;

      const fullParticipant = this.participants.get(winner.userId);
      if (fullParticipant) {
        fullParticipant.isWinner = true;
      }

      SystemLogger.info('Elimination winner determined', {
        sessionId: this.sessionId,
        winnerDiscordId: winner.discordId,
      });

      return winner;
    }

    const sorted = [...this.participants.values()].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) return null;

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
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
