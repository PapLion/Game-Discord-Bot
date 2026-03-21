import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../../types/constants';

export interface GameAnnounceData {
  gameType: string;
  gameName: string;
  prize: string;
  startedBy: string;
  maxPlayers: number;
  lobbyWaitSeconds: number;
}

export interface LobbyState {
  gameType: string;
  gameName: string;
  players: Array<{ mention: string; isWinner?: boolean }>;
  totalPlayers: number;
  maxPlayers: number;
  countdown: number;
}

export interface RoundStartData {
  roundNumber: number;
  totalRounds: number;
  question: string;
  timeoutSeconds: number;
}

export interface RoundResultData {
  correct: boolean;
  winnerMention?: string;
  answer?: string;
  points?: number;
  scores?: Array<{ mention: string; score: number }>;
}

export interface RoundTimeoutData {
  correctAnswer: string;
  scores?: Array<{ mention: string; score: number }>;
}

export interface GameEndData {
  gameName: string;
  winnerMention: string;
  finalScore: number;
  rankings: Array<{ mention: string; score: number; position: number }>;
  prizeName: string;
}

export interface PrizeDropData {
  prizeName: string;
  prizeDescription: string;
  reactionEmoji: string;
  timeoutSeconds: number;
}

export interface PrizeDropWinnerData {
  winnerMention: string;
  prizeName: string;
  prizeDescription: string;
}

export interface ScoreData {
  userMention: string;
  coins: number;
  wins: number;
  gamesPlayed: number;
  streak: number;
  winrate: number;
  favoriteGame: string;
  recentWins?: Array<{ gameName: string; prize: string; timeAgo: string }>;
}

export interface LeaderboardData {
  entries: Array<{ position: number; mention: string; value: number }>;
  updatedAgo: string;
}

export interface InventoryData {
  userMention: string;
  badges: Array<{ name: string; obtainedAt: string; rarity?: string }>;
  items: Array<{ name: string; gameType: string; obtainedAt: string }>;
  specialAccess: Array<{ name: string; expiresAt: string }>;
}

export interface HistoryData {
  userMention: string;
  totalWins: number;
  wins: Array<{ gameName: string; prize: string; timeAgo: string }>;
}

export interface GamesListData {
  builtin: Array<{ name: string; duration: string; rewards: string }>;
  special: Array<{ name: string; description: string }>;
}

export interface GameInfoData {
  name: string;
  description: string;
  duration: string;
  minPlayers: number;
  maxPlayers: number;
  rounds: number;
  prize: string;
}

export interface DailyClaimData {
  streak: number;
  baseReward: number;
  bonusReward: number;
  multiplier: number;
  totalReward: number;
  badgeName?: string;
}

export interface DailyAlreadyData {
  streak: number;
  nextClaimIn: string;
}

export interface StreakBrokenData {
  previousStreak: number;
  baseReward: number;
}

export interface PrizesPendingData {
  prizes: Array<{
    id: string;
    mention: string;
    prizeName: string;
    gameName: string;
    timeAgo: string;
  }>;
}

export interface CustomGameData {
  name: string;
  baseType: string;
  config: string;
  prize: string;
}

export class EmbedFactory {
  static gameAnnounce(data: GameAnnounceData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.GAME_ANNOUNCE)
      .setTitle(`🎮 ${data.gameName.toUpperCase()}`)
      .addFields(
        { name: '👥 Jugadores', value: `0/${data.maxPlayers}`, inline: true },
        { name: '⏱️ Inicio en', value: `${data.lobbyWaitSeconds}s`, inline: true },
        { name: '💰 Premio', value: data.prize }
      )
      .setDescription('Escribe **!join** para participar')
      .setFooter({ text: `📋 Iniciado por ${data.startedBy}` });
  }

  static gameLobby(data: LobbyState): EmbedBuilder {
    const playersList =
      data.players.map(p => `✅ ${p.mention}`).join('\n') || 'Esperando jugadores...';

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.LOBBY)
      .setTitle(`🎮 ${data.gameName.toUpperCase()} — LOBBY`)
      .setDescription(
        `${playersList}\n\n👥 **${data.totalPlayers}/${data.maxPlayers}** jugadores\n⏱️ Inicio en: **${data.countdown}s**`
      )
      .setFooter({ text: 'Todavía puedes unirte con !join' });
  }

  static roundStart(data: RoundStartData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ROUND_START)
      .setTitle(`🎯 RONDA ${data.roundNumber} / ${data.totalRounds}`)
      .setDescription(
        `❓ ${data.question}\n\n⏱️ **${data.timeoutSeconds} segundos** para responder`
      )
      .setFooter({ text: 'Escribe tu respuesta en el chat' });
  }

  static roundResult(data: RoundResultData): EmbedBuilder {
    if (data.correct && data.winnerMention) {
      return new EmbedBuilder()
        .setColor(EMBED_COLORS.ROUND_RESULT)
        .setTitle(`✅ ${data.winnerMention} respondió primero!`)
        .addFields(
          { name: 'Respuesta', value: `✓ ${data.answer}`, inline: true },
          { name: 'Puntos', value: `+${data.points}`, inline: true }
        )
        .setFooter({ text: 'Siguiente ronda en 3s...' });
    }
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ROUND_RESULT)
      .setTitle('✅ Respuesta correcta!')
      .setDescription(`Respuesta: ✓ ${data.answer}`);
  }

  static roundTimeout(data: RoundTimeoutData): EmbedBuilder {
    const scoresText = data.scores
      ? data.scores.map(s => `${s.mention}: ${s.score}`).join(' | ')
      : null;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.ROUND_TIMEOUT)
      .setTitle('⏱️ ¡Tiempo agotado!')
      .setDescription(
        `Nadie respondió correctamente\nRespuesta correcta: **${data.correctAnswer}**`
      );

    if (scoresText) {
      embed.setFooter({ text: scoresText });
    }

    return embed;
  }

  static gameEnd(data: GameEndData): EmbedBuilder {
    const rankingsText = data.rankings
      .map(r => {
        const medal =
          r.position === 1 ? '👑' : r.position === 2 ? '🥈' : r.position === 3 ? '🥉' : '   ';
        return `${medal} ${r.position}. ${r.mention} — ${r.score}pts`;
      })
      .join('\n');

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.GAME_END)
      .setTitle('🏆 JUEGO TERMINADO')
      .addFields(
        { name: '👑 Ganador', value: data.winnerMention, inline: true },
        { name: '📊 Score final', value: `${data.finalScore} puntos`, inline: true }
      )
      .setDescription(`\`\`\`\n${rankingsText}\n\`\`\``)
      .addFields({ name: '💰 Premio', value: `Pendiente para ${data.winnerMention}` })
      .setFooter({ text: 'Usa !reward para reclamar tu premio' });
  }

  static winnerDM(data: {
    userMention: string;
    gameName: string;
    prizeName: string;
    rewardDescription: string;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WINNER_DM)
      .setTitle('🎉 You Won!')
      .addFields(
        { name: '🏆 Game', value: data.gameName, inline: true },
        { name: '💰 Prize', value: data.prizeName, inline: true },
        { name: '🎁 Reward', value: data.rewardDescription }
      )
      .setFooter({ text: 'Your prize has been added to your account!' });
  }

  static winnerChannel(data: {
    userMention: string;
    gameName: string;
    prizeName: string;
    rewardDescription: string;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WINNER_DM)
      .setTitle(`🎉 You Won! — ${data.userMention}`)
      .addFields(
        { name: '📢 No pudimos enviarte un DM', value: '' },
        { name: '🏆 Game', value: data.gameName, inline: true },
        { name: '💰 Prize', value: data.prizeName, inline: true },
        { name: '🎁 Reward', value: data.rewardDescription }
      )
      .setFooter({ text: 'Your prize has been added to your account!' });
  }

  static prizeDrop(data: PrizeDropData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.PRIZE_DROP)
      .setTitle('🎁 ¡PRIZE DROP!')
      .addFields(
        { name: '💰 Premio', value: data.prizeName },
        { name: '⚡ Reacciona', value: `con ${data.reactionEmoji} para ganar`, inline: true },
        { name: '⏱️ Tiempo', value: `${data.timeoutSeconds} segundos`, inline: true }
      )
      .setFooter({ text: '¡El primero en reaccionar gana!' });
  }

  static prizeDropWinner(data: PrizeDropWinnerData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.PRIZE_DROP)
      .setTitle(`🎉 ${data.winnerMention} ganó el drop!`)
      .addFields({ name: '💰 Premio', value: `${data.prizeName} añadidos` })
      .setFooter({ text: 'Usa !reward para reclamar' });
  }

  static prizeDropExpired(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WARNING)
      .setTitle('⏱️ Drop expirado')
      .setDescription('Nadie reclamó el premio a tiempo\nEl siguiente drop llegará pronto...');
  }

  static score(data: ScoreData): EmbedBuilder {
    const recentWinsText = data.recentWins
      ? data.recentWins.map(w => `• ${w.gameName} — ${w.prize} — ${w.timeAgo}`).join('\n')
      : 'Sin victorias aún';

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.SCORE)
      .setTitle(`👤 ${data.userMention}`)
      .addFields(
        { name: '💰 Coins', value: data.coins.toLocaleString(), inline: true },
        { name: '🏆 Victorias', value: data.wins.toString(), inline: true },
        { name: '🎮 Partidas', value: data.gamesPlayed.toString(), inline: true },
        { name: '🔥 Streak', value: `${data.streak} días`, inline: true },
        { name: '📊 Winrate', value: `${data.winrate}%`, inline: true },
        { name: '🥇 Juego fav', value: data.favoriteGame, inline: true }
      )
      .setDescription(`**Últimas victorias:**\n${recentWinsText}`);
  }

  static leaderboard(data: LeaderboardData): EmbedBuilder {
    const entriesText = data.entries
      .map(e => {
        const medal =
          e.position === 1 ? '👑' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : '   ';
        return `${medal} ${e.position}. ${e.mention} — ${e.value.toLocaleString()}`;
      })
      .join('\n');

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.LEADERBOARD)
      .setTitle('🏆 LEADERBOARD')
      .setDescription(`\`\`\`\n${entriesText}\n\`\`\``)
      .setFooter({ text: `📊 Actualizado hace ${data.updatedAgo}` });
  }

  static inventory(data: InventoryData): EmbedBuilder {
    const badgesText =
      data.badges.length > 0
        ? data.badges.map(b => `• ${b.name} — ${b.rarity ?? 'common'}`).join('\n')
        : 'Sin badges';

    const itemsText =
      data.items.length > 0
        ? data.items.map(i => `• ${i.name} [${i.gameType}]`).join('\n')
        : 'Sin items';

    const accessText =
      data.specialAccess.length > 0
        ? data.specialAccess.map(a => `• ${a.name} — ${a.expiresAt}`).join('\n')
        : 'Sin accesos especiales';

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.INVENTORY)
      .setTitle(`🎒 Inventario de ${data.userMention}`)
      .addFields(
        { name: '🏅 BADGES', value: badgesText },
        { name: '🎮 ITEMS', value: itemsText },
        { name: '🔑 ACCESOS ESPECIALES', value: accessText }
      );
  }

  static history(data: HistoryData): EmbedBuilder {
    const winsText =
      data.wins.length > 0
        ? data.wins.map(w => `🏆 ${w.gameName} — ${w.prize} — ${w.timeAgo}`).join('\n')
        : 'Sin victorias aún';

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.HISTORY)
      .setTitle(`📋 Historial de ${data.userMention}`)
      .addFields({ name: '🏆 Victorias totales', value: data.totalWins.toString() })
      .setDescription(winsText);
  }

  static gamesList(data: GamesListData): EmbedBuilder {
    const builtinText = data.builtin
      .map(g => `🎯 ${g.name} — ${g.duration} — ${g.rewards}`)
      .join('\n');

    const specialText =
      data.special.length > 0
        ? `🌟 ESPECIALES (requieren acceso)\n${data.special.map(g => `👑 ${g.name} — ${g.description}`).join('\n')}`
        : '';

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.INFO)
      .setTitle('🎮 JUEGOS DISPONIBLES')
      .setDescription(`\`\`\`\n${builtinText}\n\`\`\`${specialText ? `\n\n${specialText}` : ''}`)
      .setFooter({ text: '!games info [nombre] para más detalles' });
  }

  static gamesInfo(data: GameInfoData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.INFO)
      .setTitle(`🎯 ${data.name.toUpperCase()}`)
      .setDescription(data.description)
      .addFields(
        { name: '⏱️ Duración', value: data.duration, inline: true },
        { name: '👥 Jugadores', value: `${data.minPlayers}-${data.maxPlayers}`, inline: true },
        { name: '🔄 Rondas', value: data.rounds.toString(), inline: true },
        { name: '💰 Premio', value: data.prize }
      )
      .setFooter({ text: `!start ${data.name.toLowerCase()} para comenzar` });
  }

  static dailyClaim(data: DailyClaimData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.DAILY_REWARD)
      .setTitle(`🔥 Day ${data.streak} Streak!`)
      .addFields(
        { name: '💰 Base', value: `+${data.baseReward} coins`, inline: true },
        { name: '⚡ Bonus', value: `+${data.bonusReward} coins`, inline: true },
        { name: '✖️ Multiplier', value: `x${data.multiplier}`, inline: true },
        { name: '💰 Total', value: `${data.totalReward} coins`, inline: true }
      )
      .setDescription(data.badgeName ? `🏅 Badge: **${data.badgeName}**` : '')
      .setFooter({ text: `Vuelve mañana para mantener x${data.multiplier}` });
  }

  static dailyAlreadyClaimed(data: DailyAlreadyData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WARNING)
      .setTitle('⏱️ Ya reclamaste tu recompensa hoy')
      .addFields(
        { name: '🔥 Streak actual', value: `${data.streak} días`, inline: true },
        { name: '⏳ Próximo claim', value: `en ${data.nextClaimIn}`, inline: true }
      )
      .setFooter({ text: '¡No rompas tu racha!' });
  }

  static streakBroken(data: StreakBrokenData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WARNING)
      .setTitle('💔 Streak roto')
      .addFields({ name: 'Racha anterior', value: `${data.previousStreak} días`, inline: true })
      .setDescription(
        `Empezando desde día 1...\n\n💰 Reward: ${data.baseReward} coins (base)\nVuelve mañana para empezar racha`
      );
  }

  static prizesPending(data: PrizesPendingData): EmbedBuilder {
    const prizesText = data.prizes
      .map(
        p => `#${p.id} ${p.mention} → ${p.prizeName}\n   Juego: ${p.gameName} | Hace ${p.timeAgo}`
      )
      .join('\n\n');

    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ADMIN)
      .setTitle('📋 PREMIOS PENDIENTES DE ENTREGA')
      .setDescription(prizesText || 'No hay premios pendientes')
      .setFooter({ text: '!prizes confirm [id] → marcar entregado' });
  }

  static codesLoaded(count: number): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.SUCCESS)
      .setTitle('✅ Códigos cargados')
      .addFields({ name: 'Cantidad', value: `${count} redeem codes disponibles` })
      .setFooter({ text: 'Registrado en audit log' });
  }

  static customGameCreated(data: CustomGameData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.SUCCESS)
      .setTitle(`✅ ${data.name} creado`)
      .addFields(
        { name: 'Tipo', value: data.baseType, inline: true },
        { name: 'Premio', value: data.prize, inline: true }
      )
      .setFooter({ text: `!start ${data.name.toLowerCase()} para jugarlo` });
  }

  static customGameSummary(data: CustomGameData): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ADMIN)
      .setTitle(`📋 RESUMEN: ${data.name}`)
      .addFields(
        { name: 'Tipo', value: data.baseType, inline: true },
        { name: 'Premio', value: data.prize, inline: true },
        { name: 'Config', value: data.config }
      );
  }

  static error(message: string, suggestion?: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setTitle('❌ Error')
      .setDescription(message)
      .setFooter({ text: suggestion ?? 'Contact an admin if this persists' });
  }

  static warning(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WARNING)
      .setTitle('⚠️ Warning')
      .setDescription(message);
  }

  static success(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.SUCCESS)
      .setTitle('✅ Éxito')
      .setDescription(message);
  }

  static info(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.INFO)
      .setTitle('ℹ️ Info')
      .setDescription(message);
  }

  static cooldown(remainingMs: number): EmbedBuilder {
    const remainingSec = Math.ceil(remainingMs / 1000);
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.WARNING)
      .setTitle('⏱️ Cooldown activo')
      .setDescription(`Espera **${remainingSec}s** antes de usar este comando`);
  }

  static noPermission(requiredRole: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setTitle('❌ Sin permisos')
      .setDescription(`Necesitas rol **${requiredRole}** para usar este comando`);
  }
}
