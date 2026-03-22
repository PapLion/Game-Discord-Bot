import 'dotenv/config';
import { Client, GatewayIntentBits, Guild, TextChannel } from 'discord.js';
import { DatabaseService } from './infrastructure/database/DatabaseService';
import { SystemLogger } from './infrastructure/logger/SystemLogger';
import { auditLogger } from './infrastructure/logger/AuditLogger';
import { CommandRegistry, createCommandRegistry } from './application/registry/CommandRegistry';
import { GuildConfigService } from './infrastructure/database/GuildConfigService';
import { prizeSystem } from './domain/prizes/PrizeSystem';
import { dmSystem } from './domain/prizes/DMSystem';
import { healthCheck } from './infrastructure/health/HealthCheck';
import { backupScheduler } from './infrastructure/scheduler/BackupScheduler';
import { prizeDropScheduler } from './infrastructure/scheduler/PrizeDropScheduler';
import { EmbedFactory } from './presentation/embeds/EmbedFactory';
import { getRoleFromDiscordRoles, BotRole } from './domain/players/PermissionService';
import { User } from './types/player.types';

const SHUTDOWN_TIMEOUT_MS = 10000;

interface SessionRow {
  id: string;
  guild_id: string;
  channel_id: string;
  game_type: string;
  status: string;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let commandRegistry: CommandRegistry;
let guildConfigService: GuildConfigService;
let isShuttingDown = false;

async function getUserRole(user: User, guild?: Guild): Promise<BotRole> {
  if (!guild) {
    SystemLogger.warn('getUserRole: no guild', { userId: user?.id });
    return BotRole.PLAYER;
  }

  SystemLogger.info('getUserRole called', {
    userId: user?.id,
    discordId: user?.discordId,
    guildOwnerId: guild.ownerId,
  });

  if (guild.ownerId === user.discordId) {
    SystemLogger.info('getUserRole: user is owner');
    return BotRole.OWNER;
  }

  try {
    const member =
      guild.members.cache.get(user.discordId) ?? (await guild.members.fetch(user.discordId));

    SystemLogger.info('getUserRole: member roles', {
      roles: member?.roles.cache.map(r => r.name),
    });

    if (!member) return BotRole.PLAYER;
    const roleNames = member.roles.cache.map(r => r.name);
    const role = getRoleFromDiscordRoles(roleNames);
    SystemLogger.info('getUserRole: resolved role', { role });
    return role;
  } catch (error) {
    SystemLogger.error('getUserRole: fetch failed', { error });
    return BotRole.PLAYER;
  }
}

async function validateEnv(): Promise<void> {
  if (!process.env.BOT_TOKEN?.trim()) {
    SystemLogger.error('Missing required env var: BOT_TOKEN');
    process.exit(1);
  }
  if (!process.env.CLIENT_ID?.trim()) {
    SystemLogger.error('Missing required env var: CLIENT_ID');
    process.exit(1);
  }
}

async function initializeBot(): Promise<void> {
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.initialize();
    SystemLogger.info('Database initialized');

    guildConfigService = new GuildConfigService(dbService);

    commandRegistry = createCommandRegistry({
      guildConfigService,
      getUserRole,
    });

    SystemLogger.info('Bot initialization complete');
  } catch (error) {
    SystemLogger.error('Failed to initialize bot', { error });
    throw error;
  }
}

async function recoverStaleSessions(): Promise<void> {
  const db = DatabaseService.getInstance();
  if (!db.isInitialized()) return;

  const staleSessions = db.run<SessionRow>(
    "SELECT id, guild_id, channel_id, game_type, status FROM game_sessions WHERE status IN ('active', 'waiting')"
  );

  if (staleSessions.length === 0) {
    SystemLogger.info('No stale sessions to recover');
    return;
  }

  for (const session of staleSessions) {
    try {
      db.execute(
        "UPDATE game_sessions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        [session.id]
      );

      const guild = client.guilds.cache.get(session.guild_id);
      if (guild) {
        const channel = guild.channels.cache.get(session.channel_id);
        if (channel && 'send' in channel) {
          await (channel as TextChannel).send({
            embeds: [
              EmbedFactory.warning(
                'El juego fue cancelado porque el bot se reinicio. Disculpen las molestias.'
              ) as unknown as import('discord.js').APIEmbed,
            ],
          });
        }
      }
    } catch (error) {
      SystemLogger.error('Failed to cancel stale session during recovery', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: session.id,
      });
    }
  }

  const pendingPrizes = db.runOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM pending_prizes WHERE status = 'pending'"
  );
  const pendingCount = pendingPrizes?.cnt ?? 0;

  SystemLogger.info('Bot restart recovery complete', {
    sessionsCancelled: staleSessions.length,
    pendingPrizes: pendingCount,
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  SystemLogger.info('Bot shutting down...', { signal });

  const shutdownTimer = setTimeout(() => {
    SystemLogger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    const db = DatabaseService.getInstance();

    if (db.isInitialized()) {
      const activeSessions = db.run<SessionRow>(
        "SELECT id, guild_id, channel_id FROM game_sessions WHERE status IN ('active', 'waiting')"
      );

      for (const session of activeSessions) {
        try {
          db.execute(
            "UPDATE game_sessions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
            [session.id]
          );

          const guild = client.guilds.cache.get(session.guild_id);
          if (guild) {
            const channel = guild.channels.cache.get(session.channel_id);
            if (channel && 'send' in channel) {
              await (channel as TextChannel).send({
                embeds: [
                  EmbedFactory.warning(
                    'Bot reiniciando. El juego ha sido cancelado.'
                  ) as unknown as import('discord.js').APIEmbed,
                ],
              });
            }
          }
        } catch {
          // Ignore per-session errors during shutdown
        }
      }

      db.close();
    }

    prizeDropScheduler.stop();
    healthCheck.stop();
    backupScheduler.stop();

    client.destroy();

    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (error) {
    SystemLogger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

client.on('ready', async () => {
  SystemLogger.info(`Logged in as ${client.user?.tag}`);

  if (client.user) {
    SystemLogger.info(`Bot is in ${client.guilds.cache.size} guilds`);
  }

  const dbService = DatabaseService.getInstance();
  auditLogger.setDatabaseService(dbService);
  prizeSystem.setClient(client);
  dmSystem.setClient(client);

  await recoverStaleSessions();

  const startupCheck = await healthCheck.checkOnStartup();
  if (!startupCheck.ok) {
    SystemLogger.error('Startup health check failed', { errors: startupCheck.errors });
  }

  healthCheck.setClient(client);
  healthCheck.startPeriodic();

  prizeDropScheduler.setClient(client);
  prizeDropScheduler.start();

  backupScheduler.start();

  SystemLogger.info('Bot fully operational');
});

client.on('guildCreate', guild => {
  SystemLogger.info('Joined new guild', { guildId: guild.id, guildName: guild.name });

  if (guildConfigService) {
    guildConfigService.getOrCreate(guild.id);
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith('!')) return;

  if (commandRegistry) {
    await commandRegistry.handleMessage(message);
  }
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

(async () => {
  await validateEnv();

  initializeBot()
    .then(() => {
      client.login(process.env.BOT_TOKEN);
    })
    .catch(error => {
      SystemLogger.error('Failed to start bot', { error });
      process.exit(1);
    });
})();

export { client, commandRegistry, guildConfigService };
