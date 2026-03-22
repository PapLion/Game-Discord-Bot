import { Client, TextChannel, MessageReaction, User } from 'discord.js';
import { GAME_CONSTANTS } from '../../types/GAME_CONSTANTS';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { SystemLogger } from '../logger/SystemLogger';
import { CoinsAdapter } from '../../domain/prizes/adapters/CoinsAdapter';
import { auditLogger } from '../logger/AuditLogger';
import { UserRepository } from '../database/UserRepository';

interface DropPrize {
  name: string;
  value: string;
  coinsAmount: number;
}

const DROP_PRIZES: DropPrize[] = [
  { name: '50 Coins', value: '50', coinsAmount: 50 },
  { name: '100 Coins', value: '100', coinsAmount: 100 },
  { name: '150 Coins', value: '150', coinsAmount: 150 },
  { name: '200 Coins', value: '200', coinsAmount: 200 },
];

export class PrizeDropScheduler {
  private static instance: PrizeDropScheduler;
  private client: Client | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isPaused = false;
  private pendingDropTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private coinsAdapter = new CoinsAdapter();
  private userRepo = new UserRepository();

  private constructor() {}

  static getInstance(): PrizeDropScheduler {
    if (!PrizeDropScheduler.instance) {
      PrizeDropScheduler.instance = new PrizeDropScheduler();
    }
    return PrizeDropScheduler.instance;
  }

  setClient(client: Client): void {
    this.client = client;
  }

  start(): void {
    if (this.timeoutId !== null) {
      SystemLogger.debug('PrizeDropScheduler already running');
      return;
    }
    this.scheduleNextDrop();
    SystemLogger.info('PrizeDropScheduler started');
  }

  pause(): void {
    this.isPaused = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    SystemLogger.info('PrizeDropScheduler paused');
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.scheduleNextDrop();
    SystemLogger.info('PrizeDropScheduler resumed');
  }

  isRunning(): boolean {
    return this.timeoutId !== null && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  async triggerImmediateDrop(): Promise<void> {
    if (!this.client) {
      SystemLogger.error('PrizeDropScheduler: client not set');
      return;
    }
    await this.executeDrop();
  }

  private scheduleNextDrop(): void {
    if (this.isPaused) return;

    const minMs = GAME_CONSTANTS.DROP_INTERVAL_MIN_MS;
    const maxMs = GAME_CONSTANTS.DROP_INTERVAL_MAX_MS;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

    this.timeoutId = setTimeout(() => {
      this.executeDrop().catch(error => {
        SystemLogger.error('PrizeDropScheduler executeDrop failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, delay);

    SystemLogger.debug('PrizeDropScheduler next drop scheduled', {
      delayMs: delay,
      delayMinutes: Math.round(delay / 60000),
    });
  }

  private async executeDrop(): Promise<void> {
    if (!this.client || this.isPaused) return;

    const allGuilds = this.client.guilds.cache;
    if (allGuilds.size === 0) {
      this.scheduleNextDrop();
      return;
    }

    const prize = DROP_PRIZES[Math.floor(Math.random() * DROP_PRIZES.length)];

    for (const guild of allGuilds.values()) {
      const config = await this.getGuildConfig(guild.id);
      if (!config) continue;

      const gameChannelId = config.game_channel_id;
      if (!gameChannelId) continue;

      const channel = guild.channels.cache.get(gameChannelId);
      if (!channel || !('send' in channel)) continue;

      const textChannel = channel as TextChannel;
      await this.sendDropMessage(textChannel, prize);
    }

    this.scheduleNextDrop();
  }

  private async sendDropMessage(channel: TextChannel, prize: DropPrize): Promise<void> {
    if (!this.client) return;

    const collectorFilter = (reaction: MessageReaction, user: User) => {
      return reaction.emoji.name === '🎁' && !user.bot;
    };

    try {
      const message = await channel.send({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeds: [
          EmbedFactory.prizeDrop({
            prizeName: prize.name,
            prizeDescription: 'Quick reflexes needed!',
            reactionEmoji: '🎁',
            timeoutSeconds: GAME_CONSTANTS.DROP_REACTION_WINDOW_MS / 1000,
          }) as any,
        ],
      });

      await message.react('🎁');

      this.pendingDropTimeoutId = setTimeout(async () => {
        await this.handleDropTimeout(message, channel);
      }, GAME_CONSTANTS.DROP_REACTION_WINDOW_MS);

      const reactionCollector = message.createReactionCollector({
        filter: collectorFilter,
        time: GAME_CONSTANTS.DROP_REACTION_WINDOW_MS,
        max: 1,
      });

      reactionCollector.on('collect', async (_reaction, user) => {
        if (this.pendingDropTimeoutId) {
          clearTimeout(this.pendingDropTimeoutId);
          this.pendingDropTimeoutId = null;
        }
        reactionCollector.stop();
        await this.handleDropWinner(channel, user, prize);
      });

      reactionCollector.on('end', () => {
        if (this.pendingDropTimeoutId) {
          clearTimeout(this.pendingDropTimeoutId);
          this.pendingDropTimeoutId = null;
        }
      });
    } catch (error) {
      SystemLogger.error('PrizeDropScheduler.sendDropMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        channelId: channel.id,
      });
    }
  }

  private async handleDropWinner(
    channel: TextChannel,
    user: User,
    prize: DropPrize
  ): Promise<void> {
    if (!this.client) return;

    try {
      const guild = channel.guild;
      const member = guild.members.cache.get(user.id) ?? (await guild.members.fetch(user.id));
      if (!member) return;

      const userRecord = await this.findOrCreateUser(user.id, guild.id);
      if (!userRecord) return;

      await this.coinsAdapter.deliver(userRecord.id, {
        id: `drop-${Date.now()}`,
        name: prize.name,
        type: 'coins',
        value: prize.value,
        rarity: 'common',
      });

      auditLogger.logPrizeAwarded(userRecord.id, 'coins', prize.value);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await channel.send({
        embeds: [
          EmbedFactory.prizeDropWinner({
            winnerMention: member.user.toString(),
            prizeName: prize.name,
            prizeDescription: 'Drop prize awarded!',
          }) as any,
        ],
      });

      SystemLogger.info('PrizeDropScheduler winner awarded', {
        userId: userRecord.id,
        discordId: user.id,
        prize: prize.name,
        channelId: channel.id,
      });
    } catch (error) {
      SystemLogger.error('PrizeDropScheduler handleDropWinner failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
      });
    }
  }

  private async handleDropTimeout(
    message: MessageReaction['message'],
    channel: TextChannel
  ): Promise<void> {
    if (message.deletable) {
      try {
        await message.delete();
      } catch {
        // ignore
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await channel.send({
        embeds: [EmbedFactory.prizeDropExpired() as any],
      });
    } catch (error) {
      SystemLogger.error('PrizeDropScheduler handleDropTimeout failed', {
        error: error instanceof Error ? error.message : String(error),
        channelId: channel.id,
      });
    }
  }

  private async getGuildConfig(guildId: string): Promise<{
    game_channel_id: string | null;
    drop_interval_min: number;
    drop_interval_max: number;
  } | null> {
    try {
      const { DatabaseService } = await import('../database/DatabaseService');
      const db = DatabaseService.getInstance();
      const row = db.runOne<{
        game_channel_id: string | null;
        drop_interval_min: number;
        drop_interval_max: number;
      }>(
        'SELECT game_channel_id, drop_interval_min, drop_interval_max FROM guild_config WHERE guild_id = ?',
        [guildId]
      );
      return row ?? null;
    } catch {
      return null;
    }
  }

  private async findOrCreateUser(
    discordId: string,
    guildId: string
  ): Promise<{ id: string } | null> {
    try {
      return await this.userRepo.findOrCreate(discordId, guildId);
    } catch (error) {
      SystemLogger.error('PrizeDropScheduler findOrCreateUser failed', {
        error: error instanceof Error ? error.message : String(error),
        discordId,
        guildId,
      });
      return null;
    }
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.pendingDropTimeoutId !== null) {
      clearTimeout(this.pendingDropTimeoutId);
      this.pendingDropTimeoutId = null;
    }
    this.isPaused = false;
    SystemLogger.info('PrizeDropScheduler stopped');
  }
}

export const prizeDropScheduler = PrizeDropScheduler.getInstance();
