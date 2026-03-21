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

/**
 * Preguntas hardcodeadas para TriviaGame.
 * Expandible en R-E (Resolver-Entrega) con custom questions desde DB.
 */
const TRIVIA_QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  { q: '¿Cuál es la capital de Francia?', a: 'parís' },
  { q: '¿Cuántos continentes hay en el mundo?', a: '7' },
  { q: '¿Qué color se obtiene mezclando azul y amarillo?', a: 'verde' },
  { q: '¿En qué año llegó el hombre a la luna?', a: '1969' },
  { q: '¿Cuál es el río más largo del mundo?', a: 'amazonas' },
  { q: '¿Cuántos planetas tiene el sistema solar?', a: '8' },
  { q: '¿Qué animal es conocido como el "rey de la selva"?', a: 'león' },
  { q: '¿En qué país está la Torre Eiffel?', a: 'francia' },
  { q: '¿Qué idioma tiene más hablantes nativos en el mundo?', a: 'mandarín' },
  { q: '¿Cuál es el océano más grande del mundo?', a: 'pacífico' },
] as const;

/**
 * Estrategia específica para TriviaGame.
 */
export class TriviaGameStrategy implements GameStrategy {
  readonly gameType: 'trivia' = 'trivia';
  readonly gameName: string = 'Trivia Challenge';
  readonly totalRounds: number = 5;
  readonly prizeName: string = '100 Coins + Rare Badge';

  async roundLogic(_round: number): Promise<void> {
    // Delegado a TriviaGame.roundLogic()
    throw new Error('Not implemented - use TriviaGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

/**
 * TriviaGame - Juego de preguntas y respuestas de cultura general.
 */
export class TriviaGame extends BaseGame {
  private questions: Array<{ q: string; a: string }>;
  private correctAnswer: string | null = null;
  private readonly POINTS_PER_CORRECT: number = 10;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new TriviaGameStrategy();
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

    this.questions = this.shuffleQuestions([...TRIVIA_QUESTIONS]).slice(0, 5);

    SystemLogger.info('TriviaGame initialized', {
      sessionId: this.sessionId,
      questionCount: this.questions.length,
    });
  }

  /**
   * Fisher-Yates shuffle.
   */
  private shuffleQuestions(
    questions: Array<{ q: string; a: string }>
  ): Array<{ q: string; a: string }> {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Lógica de cada ronda de trivia.
   */
  protected override async roundLogic(round: number): Promise<void> {
    try {
      const question = this.questions[round - 1];
      if (!question) {
        SystemLogger.warn('No question for round', { sessionId: this.sessionId, round });
        return;
      }

      this.correctAnswer = question.a.toLowerCase().trim();

      // Enviar pregunta
      await this.sendRoundMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: question.q,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      // Esperar respuesta
      const answer = await this.waitForAnswer();
      const answeringDiscordId = this.getAnsweringDiscordId();

      // Procesar respuesta
      if (answer !== null && this.correctAnswer !== null) {
        const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

        if (isCorrect && answeringDiscordId !== null) {
          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, this.POINTS_PER_CORRECT);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendRoundMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention,
                answer: this.correctAnswer,
                points: this.POINTS_PER_CORRECT,
                scores: this.getScoreboard(),
              })
            );

            SystemLogger.info('Correct answer in trivia', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              userId: participant.userId,
            });
          }
        } else {
          await this.sendRoundMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: this.correctAnswer,
              scores: this.getScoreboard(),
            })
          );
        }
      } else {
        await this.sendRoundMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: this.correctAnswer ?? 'Sin respuesta',
            scores: this.getScoreboard(),
          })
        );

        SystemLogger.info('Trivia round timeout', { sessionId: this.sessionId, round });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('TriviaGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  /**
   * Evalúa el ganador al final del juego.
   */
  protected override evaluateWinner(): Participant | null {
    const participants = this.getParticipants();
    if (participants.length === 0) return null;

    const sorted = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const topScore = sorted[0]?.score ?? 0;
    if (topScore === 0) {
      return null;
    }

    const winner = sorted[0];
    if (winner) {
      winner.isWinner = true;
      SystemLogger.info('Trivia winner determined', {
        sessionId: this.sessionId,
        winnerDiscordId: winner.discordId,
        score: winner.score,
      });
    }

    return winner ?? null;
  }

  /**
   * Genera el scoreboard para mostrar en embeds.
   */
  protected getScoreboard(): Array<{ mention: string; score: number }> {
    return this.getParticipants()
      .map(p => ({
        mention: `<@${p.discordId}>`,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Busca un participante por su discordId.
   */
  protected findParticipantByDiscordId(discordId: string): Participant | undefined {
    return this.getParticipants().find(p => p.discordId === discordId);
  }

  /**
   * Helper para enviar mensajes de ronda evitando problemas de tipos de discord.js.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendRoundMessage(embed: EmbedBuilder): Promise<Message> {
    return this.channel.send({
      embeds: [embed as any] as Parameters<typeof this.channel.send>[0] extends { embeds?: infer E }
        ? { embeds: E }
        : never,
    });
  }
}
