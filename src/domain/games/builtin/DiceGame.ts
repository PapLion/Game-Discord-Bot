import { TextChannel, Guild, Message, EmbedBuilder } from 'discord.js';
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

export class DiceGameStrategy implements GameStrategy {
  readonly gameType: 'dice' = 'dice';
  readonly gameName: string = 'Dice Roll';
  readonly totalRounds: number = 3;
  readonly prizeName: string = '50 Coins';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use DiceGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

interface PlayerRoll {
  discordId: string;
  roll: number;
}

export class DiceGame extends BaseGame {
  private readonly POINTS_PER_WIN: number = 10;
  private playerRolls: Map<string, number> = new Map();
  private roundWinners: PlayerRoll[] = [];

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new DiceGameStrategy();
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

    SystemLogger.info('DiceGame initialized', {
      sessionId: this.sessionId,
    });
  }

  private rollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  protected override async roundLogic(round: number): Promise<void> {
    try {
      this.playerRolls.clear();
      this.roundWinners = [];

      const isFinalRound = round === this.strategy.totalRounds;

      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: '🎲 Everyone type !play to roll the dice!',
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const participants = this.getParticipants();
      const maxAttempts = participants.length;
      let rollsReceived = 0;

      for (let i = 0; i < maxAttempts && rollsReceived < participants.length; i++) {
        const answer = await this.waitForAnswer(5000);
        const answeringDiscordId = this.getAnsweringDiscordId();

        if (
          answer !== null &&
          answeringDiscordId !== null &&
          !this.playerRolls.has(answeringDiscordId)
        ) {
          const roll = this.rollDice();
          this.playerRolls.set(answeringDiscordId, roll);
          rollsReceived++;

          await this.channel.send({
            content: `<@${answeringDiscordId}> rolled **${roll}** 🎲`,
          });
        }
      }

      let highestRoll = 0;
      const winners: PlayerRoll[] = [];

      for (const [discordId, roll] of this.playerRolls.entries()) {
        if (roll > highestRoll) {
          highestRoll = roll;
          winners.length = 0;
          winners.push({ discordId, roll });
        } else if (roll === highestRoll) {
          winners.push({ discordId, roll });
        }
      }

      if (winners.length === 1) {
        const winner = winners[0];
        const participant = this.findParticipantByDiscordId(winner.discordId);

        if (participant) {
          await this.updateScore(participant.userId, this.POINTS_PER_WIN);

          const winnerMention = `<@${participant.discordId}>`;
          await this.sendRoundMessage(
            EmbedFactory.roundResult({
              correct: true,
              winnerMention,
              answer: `Rolled ${winner.roll}`,
              points: this.POINTS_PER_WIN,
              scores: this.getScoreboard(),
            })
          );

          SystemLogger.info('Dice round winner', {
            sessionId: this.sessionId,
            round,
            discordId: participant.discordId,
            roll: winner.roll,
          });
        }
      } else if (winners.length > 1) {
        const mentions = winners.map(w => `<@${w.discordId}>`).join(', ');

        await this.sendRoundMessage(
          EmbedFactory.roundResult({
            correct: false,
            answer: `Tie! All rolled ${highestRoll}`,
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Dice round tie', {
          sessionId: this.sessionId,
          round,
          winners: winners.map(w => w.discordId),
          roll: highestRoll,
        });

        if (isFinalRound) {
          await this.channel.send({
            content: '🔄 Final round tie! One more round to break the tie...',
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('DiceGame.roundLogic failed', {
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
      SystemLogger.info('Dice winner determined', {
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
