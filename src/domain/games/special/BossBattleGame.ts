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
import { PendingPrizeService } from '../base/PendingPrizeService';
import { scoreService } from '../../systems/ScoreService';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';

const BOSS_QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  { q: '¿Capital de España?', a: 'madrid' },
  { q: '¿Cuántos días tiene enero?', a: '31' },
  { q: '¿Color del sol?', a: 'amarillo' },
  { q: '¿Animal que maúlla?', a: 'gato' },
  { q: '¿Resultado de 9x9?', a: '81' },
  { q: '¿Continente de España?', a: 'europa' },
  { q: '¿Metal precioso?', a: 'oro' },
  { q: '¿Fruta roja?', a: 'manzana' },
  { q: '¿Cuántas letras tiene el abecedario?', a: '27' },
  { q: '¿Gas que sale de las plantas?', a: 'oxigeno' },
];

export class BossBattleGameStrategy implements GameStrategy {
  readonly gameType: 'bossbattle' = 'bossbattle';
  readonly gameName: string = 'Boss Battle';
  readonly totalRounds: number = 10;
  readonly prizeName: string = '300 Coins + Boss Slayer Badge';

  async roundLogic(_round: number): Promise<void> {
    throw new Error('Not implemented - use BossBattleGame directly');
  }

  evaluateWinner(): Participant | null {
    return null;
  }
}

export class BossBattleGame extends BaseGame {
  private questions: Array<{ q: string; a: string }> = [];
  private correctAnswer: string | null = null;
  private bossHP: number = 0;
  private readonly MAX_HP_PER_PLAYER = GAME_CONSTANTS.BOSS_HP_PER_PLAYER;
  private readonly DAMAGE_PER_CORRECT = GAME_CONSTANTS.BOSS_DAMAGE_PER_CORRECT;
  private bossDefeated: boolean = false;
  private winner: Participant | null = null;

  constructor(
    channel: TextChannel,
    guild: Guild,
    startedBy: string,
    liveMessageManager: LiveMessageManager,
    eventEmitter: ScopedEventEmitter,
    db: DatabaseService,
    guildConfigService: GuildConfigService
  ) {
    const strategy = new BossBattleGameStrategy();
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

    this.questions = this.shuffleQuestions([...BOSS_QUESTIONS]);

    SystemLogger.info('BossBattleGame initialized', {
      sessionId: this.sessionId,
      hpPerPlayer: this.MAX_HP_PER_PLAYER,
      damagePerCorrect: this.DAMAGE_PER_CORRECT,
    });
  }

  protected override async waitForPlayers(): Promise<boolean> {
    const result = await super.waitForPlayers();

    if (result) {
      this.bossHP = this.participants.size * this.MAX_HP_PER_PLAYER;
      SystemLogger.info('Boss HP calculated', {
        sessionId: this.sessionId,
        participants: this.participants.size,
        bossHP: this.bossHP,
      });
    }

    return result;
  }

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

  protected override async roundLogic(round: number): Promise<void> {
    if (this.bossDefeated) {
      SystemLogger.info('Boss already defeated, skipping rounds', {
        sessionId: this.sessionId,
        round,
      });
      return;
    }

    try {
      const question = this.questions[round - 1];
      if (!question) {
        SystemLogger.warn('No question for round', { sessionId: this.sessionId, round });
        return;
      }

      this.correctAnswer = question.a.toLowerCase().trim();

      await this.sendBossMessage(
        EmbedFactory.roundStart({
          roundNumber: round,
          totalRounds: this.strategy.totalRounds,
          question: `⚔️ ${question.q}`,
          timeoutSeconds: Math.floor(GAME_CONSTANTS.ROUND_TIMEOUT_MS / 1000),
        })
      );

      const answer = await this.waitForAnswer();
      const answeringDiscordId = this.getAnsweringDiscordId();

      if (answer !== null && this.correctAnswer !== null) {
        const isCorrect = answer.toLowerCase().trim() === this.correctAnswer;

        if (isCorrect && answeringDiscordId !== null) {
          this.bossHP -= this.DAMAGE_PER_CORRECT;

          if (this.bossHP <= 0) {
            this.bossHP = 0;
            this.bossDefeated = true;
          }

          const participant = this.findParticipantByDiscordId(answeringDiscordId);

          if (participant) {
            await this.updateScore(participant.userId, 5);

            const winnerMention = `<@${participant.discordId}>`;
            await this.sendBossMessage(
              EmbedFactory.roundResult({
                correct: true,
                winnerMention: `${winnerMention} ¡${this.DAMAGE_PER_CORRECT} de daño al Boss!`,
                answer: `HP del Boss: ${this.bossHP}/${this.participants.size * this.MAX_HP_PER_PLAYER} 💀`,
                points: 5,
                scores: [],
              })
            );

            SystemLogger.info('BossBattle correct answer - boss damaged', {
              sessionId: this.sessionId,
              round,
              discordId: participant.discordId,
              damage: this.DAMAGE_PER_CORRECT,
              bossHP: this.bossHP,
              bossDefeated: this.bossDefeated,
            });
          }

          if (this.bossDefeated) {
            await this.bossDefeatedMessage();
          }
        } else {
          await this.sendBossMessage(
            EmbedFactory.roundResult({
              correct: false,
              answer: `Respuesta incorrecta. HP del Boss: ${this.bossHP}/${this.participants.size * this.MAX_HP_PER_PLAYER} 💀`,
              scores: [],
            })
          );
        }
      } else {
        await this.sendBossMessage(
          EmbedFactory.roundTimeout({
            correctAnswer: `Tiempo agotado. HP del Boss: ${this.bossHP}/${this.participants.size * this.MAX_HP_PER_PLAYER} 💀`,
            scores: [],
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      SystemLogger.error('BossBattleGame.roundLogic failed', {
        sessionId: this.sessionId,
        round,
        error: message,
      });
      throw error;
    }
  }

  private async bossDefeatedMessage(): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🎉 ¡BOSS DERROTADO!')
      .setDescription('¡Todos los jugadores ganan!')
      .addFields(
        {
          name: '💀 HP Final',
          value: `0 / ${this.participants.size * this.MAX_HP_PER_PLAYER}`,
        },
        { name: '🏆 Premio', value: '300 Coins + Boss Slayer Badge' }
      );
    await this.sendBossMessage(embed);
  }

  protected override async end(): Promise<void> {
    try {
      if (this.bossDefeated) {
        const participants = this.getParticipants();

        for (const participant of participants) {
          participant.isWinner = true;

          const pendingPrizeId = await PendingPrizeService.createPending(
            this.db,
            participant.userId,
            this.sessionId,
            'coins',
            '300'
          );

          await scoreService.updateAfterGame({
            sessionId: this.sessionId,
            winnerId: participant.userId,
            guildId: this.guild.id,
            gameType: this.strategy.gameType,
            score: participant.score,
          });

          auditLogger.logPrizeAwarded(participant.userId, 'coins', '300', this.sessionId);

          SystemLogger.info('BossBattle winner', {
            sessionId: this.sessionId,
            winnerUserId: participant.userId,
            score: participant.score,
          });
        }

        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );
        this.status = 'finished';

        const winnerMentions = participants.map(p => `<@${p.discordId}>`).join(', ');

        await this.sendBossMessage(
          EmbedFactory.gameEnd({
            gameName: this.strategy.gameName,
            winnerMention: `${winnerMentions} ¡Todos ganan! El Boss fue derrotado 💀`,
            finalScore: participants[0]?.score ?? 0,
            rankings: this.getBossRankings(),
            prizeName: '300 Coins + Boss Slayer Badge 🏆',
          })
        );

        SystemLogger.info('BossBattle game ended - boss defeated', {
          sessionId: this.sessionId,
          winnerCount: participants.length,
        });
      } else {
        this.db.execute(
          "UPDATE game_sessions SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          [this.sessionId]
        );
        this.status = 'finished';

        const bossWinsEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('💀 BOSS GANA')
          .setDescription('El tiempo se acabó y el Boss sigue en pie.')
          .addFields({
            name: 'HP Restante',
            value: `${this.bossHP} / ${this.participants.size * this.MAX_HP_PER_PLAYER}`,
          });
        await this.sendBossMessage(bossWinsEmbed);

        SystemLogger.info('BossBattle game ended - boss wins', {
          sessionId: this.sessionId,
          bossHP: this.bossHP,
        });
      }

      this.cleanupBossResources();
    } catch (error) {
      SystemLogger.error('BossBattleGame.end failed', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  protected override evaluateWinner(): Participant | null {
    if (this.bossDefeated) {
      return null;
    }
    return null;
  }

  private getBossRankings(): Array<{ mention: string; score: number; position: number }> {
    const sorted = Array.from(this.participants.values()).sort((a, b) => b.score - a.score);
    return sorted.map((p, index) => ({
      mention: `<@${p.discordId}>`,
      score: p.score,
      position: index + 1,
    }));
  }

  private findParticipantByDiscordId(discordId: string): Participant | undefined {
    return this.getParticipants().find(p => p.discordId === discordId);
  }

  private async sendBossMessage(embed: EmbedBuilder): Promise<Message> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.channel.send({ embeds: [embed as any] });
  }

  private cleanupBossResources(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.liveMessageManager.cleanup(this.sessionId);
    this.eventEmitter.destroySession(this.sessionId);
    this.answerResolver = null;
  }
}
