import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { getGuildConfigService } from '../../../infrastructure/database/GuildConfigService';

const VALID_CONFIG_KEYS = [
  'prefix',
  'game_channel_id',
  'log_channel_id',
  'max_players_per_game',
  'min_players_per_game',
  'lobby_wait_seconds',
  'drop_interval_min',
  'drop_interval_max',
] as const;

type ConfigKey = (typeof VALID_CONFIG_KEYS)[number];

const CONFIG_KEY_LABELS: Record<ConfigKey, string> = {
  prefix: 'Prefix',
  game_channel_id: 'Game Channel ID',
  log_channel_id: 'Log Channel ID',
  max_players_per_game: 'Max Players',
  min_players_per_game: 'Min Players',
  lobby_wait_seconds: 'Lobby Wait (s)',
  drop_interval_min: 'Drop Interval Min (min)',
  drop_interval_max: 'Drop Interval Max (min)',
};

export class ConfigCommand implements BotCommand {
  name = 'config';
  aliases = ['cfg'];
  requiredRole = BotRole.ADMIN;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const subcommand = ctx.args[0]?.toLowerCase();

      if (subcommand === 'set') {
        await this.handleSet(ctx);
      } else if (subcommand === 'get') {
        await this.handleGet(ctx);
      } else {
        await this.handleHelp(ctx);
      }
    } catch (error) {
      SystemLogger.error('ConfigCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos procesar el comando. Intenta de nuevo.') as any],
      });
    }
  }

  private async handleSet(ctx: CommandContext): Promise<void> {
    const key = ctx.args[1]?.toLowerCase() as ConfigKey | undefined;
    const value = ctx.args[2];

    if (!key || !value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'Uso: !config set [key] [value]',
            `Keys válidas: ${VALID_CONFIG_KEYS.join(', ')}`
          ) as any,
        ],
      });
      return;
    }

    if (!VALID_CONFIG_KEYS.includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            `Key inválida: "${key}"`,
            `Keys válidas: ${VALID_CONFIG_KEYS.join(', ')}`
          ) as any,
        ],
      });
      return;
    }

    const service = getGuildConfigService();
    const current = service.getOrCreate(ctx.guildId);
    const oldValue = current[key as keyof typeof current];

    const parsed = this.parseValue(key, value);
    if (parsed === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            `Valor inválido para "${CONFIG_KEY_LABELS[key]}": "${value}"`,
            this.getValueHint(key)
          ) as any,
        ],
      });
      return;
    }

    try {
      const updates: Record<string, unknown> = {};
      updates[key] = parsed;
      const updated = service.update(ctx.guildId, updates);

      auditLogger.logConfigChanged(ctx.userId, key, oldValue, parsed);

      SystemLogger.info('ConfigCommand: config updated', {
        adminId: ctx.userId,
        guildId: ctx.guildId,
        key,
        oldValue,
        newValue: parsed,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.success(`${CONFIG_KEY_LABELS[key]}: "${oldValue}" → "${parsed}"`) as any,
        ],
      });
    } catch (error) {
      SystemLogger.error('ConfigCommand set failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
        key,
        value,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error('No pudimos actualizar la configuración. Intenta de nuevo.') as any,
        ],
      });
    }
  }

  private async handleGet(ctx: CommandContext): Promise<void> {
    const key = ctx.args[1]?.toLowerCase() as ConfigKey | undefined;

    if (!key) {
      await this.handleListAll(ctx);
      return;
    }

    if (!VALID_CONFIG_KEYS.includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            `Key inválida: "${key}"`,
            `Keys válidas: ${VALID_CONFIG_KEYS.join(', ')}`
          ) as any,
        ],
      });
      return;
    }

    const service = getGuildConfigService();
    const config = service.getOrCreate(ctx.guildId);
    const value = config[key as keyof typeof config];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [EmbedFactory.info(`**${CONFIG_KEY_LABELS[key]}**\n\`${value}\``) as any],
    });
  }

  private async handleListAll(ctx: CommandContext): Promise<void> {
    const service = getGuildConfigService();
    const config = service.getOrCreate(ctx.guildId);

    const lines = VALID_CONFIG_KEYS.map(key => {
      const value = config[key as keyof typeof config];
      const display = value === null || value === undefined ? '(no establecido)' : `\`${value}\``;
      return `**${CONFIG_KEY_LABELS[key]}**: ${display}`;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [
        EmbedFactory.info(
          `**Configuración del servidor**\n\n${lines.join('\n')}\n\n` +
            `Usa \`!config get [key]\` o \`!config set [key] [value]\``
        ) as any,
      ],
    });
  }

  private async handleHelp(ctx: CommandContext): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply({
      embeds: [
        EmbedFactory.info(
          '**Comandos de configuración:**\n' +
            `• \`!config get [key]\` — Ver valor actual\n` +
            `• \`!config set [key] [value]\` — Actualizar valor\n\n` +
            `Keys: ${VALID_CONFIG_KEYS.join(', ')}`
        ) as any,
      ],
    });
  }

  private parseValue(key: ConfigKey, value: string): string | number | null | undefined {
    switch (key) {
      case 'prefix':
        return value.slice(0, 5);

      case 'game_channel_id':
      case 'log_channel_id':
        if (value === 'null' || value === 'none' || value === 'clear') {
          return null;
        }
        return value;

      case 'max_players_per_game':
      case 'min_players_per_game':
      case 'lobby_wait_seconds':
      case 'drop_interval_min':
      case 'drop_interval_max': {
        const num = parseInt(value, 10);
        if (isNaN(num)) return undefined;

        if (key === 'max_players_per_game' && (num < 2 || num > 100)) return undefined;
        if (key === 'min_players_per_game' && (num < 1 || num > 50)) return undefined;
        if (key === 'lobby_wait_seconds' && (num < 5 || num > 300)) return undefined;
        if (
          (key === 'drop_interval_min' || key === 'drop_interval_max') &&
          (num < 1 || num > 1440)
        ) {
          return undefined;
        }

        return num;
      }

      default:
        return undefined;
    }
  }

  private getValueHint(key: ConfigKey): string {
    switch (key) {
      case 'max_players_per_game':
        return 'Número entre 2 y 100';
      case 'min_players_per_game':
        return 'Número entre 1 y 50';
      case 'lobby_wait_seconds':
        return 'Número entre 5 y 300';
      case 'drop_interval_min':
      case 'drop_interval_max':
        return 'Número entre 1 y 1440 (minutos)';
      case 'game_channel_id':
      case 'log_channel_id':
        return 'ID del canal o "null" para清除';
      default:
        return 'Valor inválido';
    }
  }
}
