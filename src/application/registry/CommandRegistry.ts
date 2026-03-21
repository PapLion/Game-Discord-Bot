import { Message } from 'discord.js';
import { BotCommand, CommandContext } from '../../types/command.types';
import { User } from '../../types/player.types';
import { BotRole } from '../../domain/players/PermissionService';
import { IUserRepository, UserRepository } from '../../infrastructure/database/UserRepository';
import {
  GuildConfigService,
  getGuildConfigService,
} from '../../infrastructure/database/GuildConfigService';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';
import { Middleware } from '../middleware/Middleware';
import { PermissionMiddleware } from '../middleware/PermissionMiddleware';
import { CooldownMiddleware } from '../middleware/CooldownMiddleware';
import { AntiCheatMiddleware } from '../middleware/AntiCheatMiddleware';
import { SessionValidationMiddleware } from '../middleware/SessionValidationMiddleware';
import { EmbedFactory } from '../../presentation/embeds/EmbedFactory';
import { Guild } from 'discord.js';
import { StartCommand } from '../../presentation/commands/admin/StartCommand';
import { JoinCommand } from '../../presentation/commands/player/JoinCommand';
import { PlayCommand } from '../../presentation/commands/player/PlayCommand';
import { RewardCommand } from '../../presentation/commands/player/RewardCommand';
import { ScoreCommand } from '../../presentation/commands/player/ScoreCommand';
import { LeaderboardCommand } from '../../presentation/commands/player/LeaderboardCommand';
import { InventoryCommand } from '../../presentation/commands/player/InventoryCommand';
import { HistoryCommand } from '../../presentation/commands/player/HistoryCommand';
import { DailyCommand } from '../../presentation/commands/player/DailyCommand';
import { GamesCommand } from '../../presentation/commands/player/GamesCommand';

export interface CommandRegistryDeps {
  userRepository: IUserRepository;
  guildConfigService: GuildConfigService;
  getUserRole: (user: User, guild?: Guild) => BotRole;
}

export class CommandRegistry {
  private commands: Map<string, BotCommand> = new Map();
  private middlewareChain: Middleware[] = [];
  private userRepo: IUserRepository;
  private guildConfigService: GuildConfigService;
  private getUserRole: (user: User, guild?: Guild) => BotRole;

  constructor(deps?: Partial<CommandRegistryDeps>) {
    this.userRepo = deps?.userRepository ?? new UserRepository();
    this.guildConfigService = deps?.guildConfigService ?? getGuildConfigService();
    this.getUserRole = deps?.getUserRole ?? (() => BotRole.PLAYER);

    this.registerDefaultMiddleware();
    this.registerGameCommands();
  }

  private registerDefaultMiddleware(): void {
    this.middlewareChain = [
      PermissionMiddleware.create((user: User) => this.getUserRole(user)),
      CooldownMiddleware.create(),
      AntiCheatMiddleware.create(),
      SessionValidationMiddleware.create(),
    ];
  }

  private registerGameCommands(): void {
    this.register(new StartCommand());
    this.register(new JoinCommand());
    this.register(new PlayCommand());
    this.register(new RewardCommand());
    this.register(new ScoreCommand());
    this.register(new LeaderboardCommand());
    this.register(new InventoryCommand());
    this.register(new HistoryCommand());
    this.register(new DailyCommand());
    this.register(new GamesCommand());
  }

  register(command: BotCommand): void {
    this.commands.set(command.name.toLowerCase(), command);

    for (const alias of command.aliases) {
      this.commands.set(alias.toLowerCase(), command);
    }

    SystemLogger.debug('Command registered', { command: command.name, aliases: command.aliases });
  }

  registerMiddleware(middleware: Middleware): void {
    this.middlewareChain.push(middleware);
  }

  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const content = message.content.slice(1);
    const parts = content.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) return;

    try {
      const guildId = message.guild?.id ?? 'dm';
      const user = await this.userRepo.findOrCreate(message.author.id, guildId);
      const config =
        guildId !== 'dm'
          ? this.guildConfigService.getOrCreate(guildId)
          : {
              prefix: '!',
              guildId: 'dm',
              gameChannelId: null,
              logChannelId: null,
              maxPlayersPerGame: 10,
              minPlayersPerGame: 2,
              lobbyWaitSeconds: 30,
              dropIntervalMin: 15,
              dropIntervalMax: 60,
            };

      const ctx: CommandContext & { user: User; command: BotCommand } = {
        userId: user.id,
        discordId: message.author.id,
        guildId,
        channelId: message.channelId,
        args,
        message,
        user,
        command,
        reply: async options => {
          await message.reply(options);
        },
      };

      await this.executeWithChain(ctx, command);
    } catch (error) {
      SystemLogger.error('Command execution failed', {
        error,
        command: commandName,
        userId: message.author.id,
        guildId: message.guild?.id,
      });

      const errorEmbed = EmbedFactory.error(
        'No pudimos procesar tu comando. Intenta de nuevo.',
        'Si el problema persiste, contacta a un admin.'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await message.reply({ embeds: [errorEmbed as any] }).catch(() => {});
    }
  }

  private async executeWithChain(
    ctx: CommandContext & { user: User; command: BotCommand },
    command: BotCommand
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewareChain.length) {
        const middleware = this.middlewareChain[index++];
        await middleware.handle(ctx, next);
      } else {
        await command.execute(ctx);
      }
    };

    await next();
  }

  getCommand(name: string): BotCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  getAllCommands(): BotCommand[] {
    const uniqueCommands = new Set(this.commands.values());
    return Array.from(uniqueCommands);
  }
}

export const createCommandRegistry = (deps?: Partial<CommandRegistryDeps>): CommandRegistry => {
  return new CommandRegistry(deps);
};
