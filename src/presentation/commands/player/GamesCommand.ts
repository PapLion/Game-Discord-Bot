import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { gameRegistry } from '../../../infrastructure/plugins/GameRegistry';
import { GameBuilder } from '../../../domain/games/GameBuilder';

const GAME_INFO: Record<
  string,
  {
    description: string;
    duration: string;
    minPlayers: number;
    maxPlayers: number;
    rounds: number;
    prize: string;
  }
> = {
  trivia: {
    description: 'Responde preguntas de conocimiento general. El más rápido gana.',
    duration: '3-5 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 5,
    prize: '100 coins',
  },
  reaction: {
    description: 'Sé el primero en escribir !play cuando aparezca "AHORA!".',
    duration: '30s',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 1,
    prize: '50 coins',
  },
  math: {
    description: 'Resuelve problemas matemáticos. Velocidad y precisión.',
    duration: '2-3 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 10,
    prize: '75 coins',
  },
  wordpuzzle: {
    description: 'Completa palabras o adivina la siguiente. Vocabulario.',
    duration: '3 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 5,
    prize: '80 coins',
  },
  dice: {
    description: 'Lanza dados y obtén el número más alto.',
    duration: '1 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 1,
    prize: '50 coins',
  },
  spinwheel: {
    description: 'La ruleta decide al azar quién gana.',
    duration: '30s',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 1,
    prize: '60 coins',
  },
  guessing: {
    description: 'Adivina el número secreto. El más cercano gana.',
    duration: '2 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 1,
    prize: '70 coins',
  },
  elimination: {
    description: 'Responde correctamente para sobrevivir. El último gana.',
    duration: '5 min',
    minPlayers: 2,
    maxPlayers: 10,
    rounds: 10,
    prize: '120 coins',
  },
};

export class GamesCommand implements BotCommand {
  name = 'games';
  aliases = ['list', 'gamelist'];
  requiredRole = BotRole.PLAYER;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const subcommand = ctx.args[0]?.toLowerCase();

      if (subcommand && GAME_INFO[subcommand]) {
        await this.showGameInfo(ctx, subcommand);
      } else {
        await this.showGamesList(ctx);
      }
    } catch (error) {
      SystemLogger.error('GamesCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });

      await ctx.reply({
        embeds: [
          EmbedFactory.error(
            'No pudimos mostrar los juegos'
          ) as unknown as import('discord.js').APIEmbed,
        ],
      });
    }
  }

  private async showGamesList(ctx: CommandContext): Promise<void> {
    const builtin = Object.entries(GAME_INFO).map(([name, info]) => ({
      name,
      duration: info.duration,
      rewards: info.prize,
    }));

    try {
      const builder = new GameBuilder();
      const customGames = builder.listCustom(ctx.guildId);

      for (const custom of customGames) {
        const config = JSON.parse(custom.config);
        const prizeDisplay =
          config.prizeType === 'coins' ? `${config.prizeValue} coins` : config.prizeType;
        builtin.push({
          name: custom.name,
          duration: 'custom',
          rewards: prizeDisplay,
        });
      }
    } catch (error) {
      SystemLogger.error('GamesCommand: failed to load custom games', {
        error: error instanceof Error ? error.message : String(error),
        guildId: ctx.guildId,
      });
    }

    const special: { name: string; description: string }[] = [];

    await ctx.reply({
      embeds: [
        EmbedFactory.gamesList({
          builtin,
          special,
        }) as unknown as import('discord.js').APIEmbed,
      ],
    });
  }

  private async showGameInfo(ctx: CommandContext, gameName: string): Promise<void> {
    const info = GAME_INFO[gameName];

    await ctx.reply({
      embeds: [
        EmbedFactory.gamesInfo({
          name: gameName.charAt(0).toUpperCase() + gameName.slice(1),
          description: info.description,
          duration: info.duration,
          minPlayers: info.minPlayers,
          maxPlayers: info.maxPlayers,
          rounds: info.rounds,
          prize: info.prize,
        }) as unknown as import('discord.js').APIEmbed,
      ],
    });
  }
}
