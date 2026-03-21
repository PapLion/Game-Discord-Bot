import { Client, GatewayIntentBits } from 'discord.js';
import { DatabaseService } from './infrastructure/database/DatabaseService';
import { SystemLogger } from './infrastructure/logger/SystemLogger';
import { CommandRegistry, createCommandRegistry } from './application/registry/CommandRegistry';
import { GuildConfigService } from './infrastructure/database/GuildConfigService';

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

async function initializeBot(): Promise<void> {
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.initialize();
    SystemLogger.info('Database initialized');

    guildConfigService = new GuildConfigService(dbService);

    commandRegistry = createCommandRegistry({
      guildConfigService,
    });

    SystemLogger.info('Bot initialization complete');
  } catch (error) {
    SystemLogger.error('Failed to initialize bot', { error });
    throw error;
  }
}

client.on('ready', async () => {
  SystemLogger.info(`Logged in as ${client.user?.tag}`);

  if (client.user) {
    SystemLogger.info(`Bot is in ${client.guilds.cache.size} guilds`);
  }
});

client.on('guildCreate', guild => {
  SystemLogger.info('Joined new guild', { guildId: guild.id, guildName: guild.name });

  if (guildConfigService) {
    guildConfigService.getOrCreate(guild.id);
  }
});

client.on('messageCreate', async message => {
  if (commandRegistry) {
    await commandRegistry.handleMessage(message);
  }
});

const token = process.env.BOT_TOKEN;
if (!token) {
  SystemLogger.error('BOT_TOKEN is required but not provided');
  process.exit(1);
}

initializeBot()
  .then(() => {
    client.login(token);
  })
  .catch(error => {
    SystemLogger.error('Failed to start bot', { error });
    process.exit(1);
  });

process.on('SIGINT', () => {
  SystemLogger.info('SIGINT received, shutting down gracefully');
  const dbService = DatabaseService.getInstance();
  if (dbService.isInitialized()) {
    dbService.close();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  SystemLogger.info('SIGTERM received, shutting down gracefully');
  const dbService = DatabaseService.getInstance();
  if (dbService.isInitialized()) {
    dbService.close();
  }
  client.destroy();
  process.exit(0);
});

export { client, commandRegistry, guildConfigService };
