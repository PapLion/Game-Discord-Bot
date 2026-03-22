import { DMChannel, Message } from 'discord.js';
import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { GameBuilder, CustomGameConfig } from '../../../domain/games/GameBuilder';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import { client } from '../../../index';

const WIZARD_TIMEOUT_MS = 60000;

const BASE_TYPES = ['trivia', 'reaction', 'guessing', 'elimination', 'luck'];
const BASE_TYPE_LABELS: Record<string, string> = {
  trivia: 'Trivia',
  reaction: 'Reaction',
  guessing: 'Guessing',
  elimination: 'Elimination',
  luck: 'Luck',
};
const PRIZE_TYPES = ['coins', 'badge', 'virtual_item', 'role', 'redeem'];
const PRIZE_TYPE_LABELS: Record<string, string> = {
  coins: 'Coins',
  badge: 'Badge',
  virtual_item: 'Virtual Item',
  role: 'Role',
  redeem: 'Redeem Code',
};

interface WizardData {
  name: string;
  baseType: string;
  rounds: number;
  secondsPerRound: number;
  prizeType: string;
  prizeValue: string;
  questions: Array<{ question: string; answer: string }>;
}

export class CreateGameCommand implements BotCommand {
  name = 'createGame';
  aliases = ['creategame', 'cg'];
  requiredRole = BotRole.ADMIN;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const dmChannel = await this.openDM(ctx.message.author.id);
      if (!dmChannel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'No pudimos abrir un DM contigo',
              'Asegúrate de tener DMs abiertos'
            ) as any,
          ],
        });
        return;
      }

      await dmChannel.send({
        content:
          '🎮 **Vamos a crear tu juego personalizado**\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          'Escribe `cancel` en cualquier momento para cancelar.\n' +
          'Tienes 60 segundos para responder cada pregunta.\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      });

      const data = await this.runWizard(dmChannel);
      if (!data) return;

      const config: CustomGameConfig = {
        name: data.name,
        baseType: data.baseType,
        rounds: data.rounds,
        secondsPerRound: data.secondsPerRound,
        prizeType: data.prizeType,
        prizeValue: data.prizeValue,
        questions: data.questions.length > 0 ? data.questions : undefined,
      };

      const builder = new GameBuilder();
      const record = builder.build(config, ctx.guildId, ctx.userId);

      auditLogger.log({
        action: 'game_started',
        actorId: ctx.userId,
        targetId: record.id,
        metadata: { gameType: 'custom', gameName: record.name },
      });

      const prizeDisplay =
        data.prizeType === 'coins' ? `${data.prizeValue} coins` : `${data.prizeType}`;

      const gameKey = data.name.toLowerCase().replace(/\s+/g, '');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await dmChannel.send({
        embeds: [
          EmbedFactory.customGameCreated({
            name: data.name,
            baseType: BASE_TYPE_LABELS[data.baseType] ?? data.baseType,
            config: `${data.rounds} rondas × ${data.secondsPerRound}s`,
            prize: prizeDisplay,
          }) as any,
        ],
      });

      await dmChannel.send({
        content: `Usa \`!start ${gameKey}\` para jugarlo en el servidor`,
      });
    } catch (error) {
      SystemLogger.error('CreateGameCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos crear el juego. Intenta de nuevo.') as any],
      });
    }
  }

  private async openDM(userId: string): Promise<DMChannel | null> {
    try {
      const user = await client.users.fetch(userId);
      return (await user.createDM()) as DMChannel;
    } catch {
      return null;
    }
  }

  private async runWizard(dmChannel: DMChannel): Promise<WizardData | null> {
    const data: WizardData = {
      name: '',
      baseType: '',
      rounds: 5,
      secondsPerRound: 20,
      prizeType: 'coins',
      prizeValue: '100',
      questions: [],
    };

    // STEP 1: Name
    const name = await this.collectText(
      dmChannel,
      `**Paso 1/7 — Nombre del juego**\n¿Cómo se llamará tu juego? (máx 30 caracteres)`,
      input => {
        if (input.length === 0) return 'El nombre no puede estar vacío';
        if (input.length > 30) return 'Máximo 30 caracteres';
        return null;
      }
    );
    if (!name) return null;
    data.name = name;

    // STEP 2: Base type
    const baseTypeOptions = BASE_TYPES.map((t, i) => `${i + 1}️⃣ ${BASE_TYPE_LABELS[t]}`).join('\n');
    const baseType = await this.collectText(
      dmChannel,
      `**Paso 2/7 — Tipo base**\n${baseTypeOptions}\n\nResponde con el número`
    );
    if (!baseType) return null;
    const baseIdx = parseInt(baseType, 10) - 1;
    if (baseIdx < 0 || baseIdx >= BASE_TYPES.length || isNaN(baseIdx)) {
      await dmChannel.send({ content: '❌ Tipo inválido. Operación cancelada.' });
      return null;
    }
    data.baseType = BASE_TYPES[baseIdx];

    // STEP 3: Rounds
    const roundsRaw = await this.collectText(
      dmChannel,
      `**Paso 3/7 — Número de rondas**\n¿Cuántas rondas? (1-10)`
    );
    if (!roundsRaw) return null;
    const rounds = parseInt(roundsRaw, 10);
    if (isNaN(rounds) || rounds < 1 || rounds > 10) {
      await dmChannel.send({ content: '❌ Número inválido. Operación cancelada.' });
      return null;
    }
    data.rounds = rounds;

    // STEP 4: Seconds per round
    const secondsRaw = await this.collectText(
      dmChannel,
      `**Paso 4/7 — Tiempo por ronda**\n¿Cuántos segundos por ronda? (10-60)`
    );
    if (!secondsRaw) return null;
    const seconds = parseInt(secondsRaw, 10);
    if (isNaN(seconds) || seconds < 10 || seconds > 60) {
      await dmChannel.send({ content: '❌ Número inválido. Operación cancelada.' });
      return null;
    }
    data.secondsPerRound = seconds;

    // STEP 5: Prize type
    const prizeTypeOptions = PRIZE_TYPES.map((t, i) => `${i + 1}️⃣ ${PRIZE_TYPE_LABELS[t]}`).join(
      '\n'
    );
    const prizeTypeRaw = await this.collectText(
      dmChannel,
      `**Paso 5/7 — Premio**\n${prizeTypeOptions}\n\nResponde con el número`
    );
    if (!prizeTypeRaw) return null;
    const prizeIdx = parseInt(prizeTypeRaw, 10) - 1;
    if (prizeIdx < 0 || prizeIdx >= PRIZE_TYPES.length || isNaN(prizeIdx)) {
      await dmChannel.send({ content: '❌ Tipo inválido. Operación cancelada.' });
      return null;
    }
    data.prizeType = PRIZE_TYPES[prizeIdx];

    // Prize value
    const prizeValueRaw = await this.collectText(
      dmChannel,
      `¿Cuánto vale el premio?\n(Para coins: número. Para badge/item: nombre)`
    );
    if (!prizeValueRaw) return null;
    data.prizeValue = prizeValueRaw;

    // STEP 6: Questions (only for trivia)
    if (data.baseType === 'trivia') {
      const questionsRaw = await this.collectText(
        dmChannel,
        `**Paso 6/7 — Preguntas**\n` +
          `Envía tus preguntas en este formato (mínimo 5, máximo 20):\n\n` +
          `pregunta | respuesta\n` +
          `pregunta | respuesta\n\n` +
          `Ejemplo:\n` +
          `¿Quién dirigió Titanic? | James Cameron`
      );
      if (!questionsRaw) return null;

      const lines = questionsRaw.split('\n');
      const parsed: Array<{ question: string; answer: string }> = [];
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          const q = parts[0].trim();
          const a = parts[1].trim();
          if (q && a) {
            parsed.push({ question: q, answer: a });
          }
        }
      }

      if (parsed.length < 5) {
        await dmChannel.send({
          content: `❌ Se requieren mínimo 5 preguntas válidas. Operación cancelada.`,
        });
        return null;
      }
      data.questions = parsed.slice(0, 20);

      await dmChannel.send({ content: `✅ ${data.questions.length} preguntas cargadas` });
    }

    // STEP 7: Confirmation
    const confirmed = await this.collectConfirmation(dmChannel, data);
    if (!confirmed) return null;

    return data;
  }

  private async collectText(
    channel: DMChannel,
    prompt: string,
    validator?: (input: string) => string | null
  ): Promise<string | null> {
    await channel.send({ content: prompt });

    const collected = await channel.awaitMessages({
      filter: (msg: Message) => !msg.author.bot,
      max: 1,
      time: WIZARD_TIMEOUT_MS,
    });

    if (collected.size === 0) {
      await channel.send({ content: '⏱️ Tiempo agotado. Operación cancelada.' });
      return null;
    }

    const msg = collected.first()!;
    const input = msg.content.trim();

    if (input.toLowerCase() === 'cancel') {
      await channel.send({ content: '❌ Operación cancelada.' });
      return null;
    }

    if (validator) {
      const error = validator(input);
      if (error) {
        await channel.send({ content: `❌ ${error}` });
        return this.collectText(channel, prompt, validator);
      }
    }

    return input;
  }

  private async collectConfirmation(channel: DMChannel, data: WizardData): Promise<boolean | null> {
    const prizeDisplay =
      data.prizeType === 'coins' ? `${data.prizeValue} coins` : `${data.prizeType}`;

    await channel.send({ content: '**Paso 7/7 — Confirmación**' });

    const embed = EmbedFactory.customGameSummary({
      name: data.name,
      baseType: BASE_TYPE_LABELS[data.baseType] ?? data.baseType,
      config: `${data.rounds} rondas × ${data.secondsPerRound}s${data.questions.length > 0 ? ` | ${data.questions.length} preguntas` : ''}`,
      prize: prizeDisplay,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await channel.send({ embeds: [embed as any] });

    await channel.send({
      content: 'Reacciona ✅ para confirmar o ❌ para cancelar.',
    });

    try {
      const confirmMsg = await channel.awaitMessages({
        filter: (msg: Message) =>
          !msg.author.bot &&
          (msg.content.toLowerCase() === 'confirm' || msg.content.toLowerCase() === 'cancel'),
        max: 1,
        time: WIZARD_TIMEOUT_MS,
      });

      if (confirmMsg.size === 0) {
        await channel.send({ content: '⏱️ Tiempo agotado. Operación cancelada.' });
        return null;
      }

      const response = confirmMsg.first()!.content.toLowerCase();
      if (response === 'cancel' || response === '❌') {
        await channel.send({ content: '❌ Operación cancelada.' });
        return null;
      }

      return true;
    } catch {
      await channel.send({ content: '❌ Operación cancelada.' });
      return null;
    }
  }
}
