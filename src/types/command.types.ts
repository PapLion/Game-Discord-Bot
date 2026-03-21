import { Message, MessageCreateOptions } from 'discord.js';

export interface CommandContext {
  userId: string;
  discordId: string;
  guildId: string;
  channelId: string;
  args: string[];
  message: Message;
  reply: (options: MessageCreateOptions) => Promise<void>;
}

export interface BotCommand {
  name: string;
  aliases: string[];
  requiredRole: string;
  cooldown: number;
  execute(ctx: CommandContext): Promise<void>;
}
