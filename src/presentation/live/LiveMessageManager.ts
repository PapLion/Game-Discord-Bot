import { Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { EmbedFactory, LobbyState, RoundStartData, RoundResultData } from '../embeds/EmbedFactory';
import { SystemLogger } from '../../infrastructure/logger/SystemLogger';

export class LiveMessageManager {
  private static instance: LiveMessageManager;
  private lobbyMessages: Map<string, Message> = new Map();
  private roundMessages: Map<string, Message> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): LiveMessageManager {
    if (!LiveMessageManager.instance) {
      LiveMessageManager.instance = new LiveMessageManager();
    }
    return LiveMessageManager.instance;
  }

  public setLobbyMessage(sessionId: string, message: Message): void {
    this.lobbyMessages.set(sessionId, message);
  }

  public setRoundMessage(sessionId: string, message: Message): void {
    this.roundMessages.set(sessionId, message);
  }

  public getLobbyMessage(sessionId: string): Message | undefined {
    return this.lobbyMessages.get(sessionId);
  }

  public async updateLobby(sessionId: string, state: LobbyState): Promise<void> {
    const message = this.lobbyMessages.get(sessionId);
    if (!message) {
      return;
    }

    try {
      const embed = EmbedFactory.gameLobby(state);
      await message.edit({ embeds: [embed as unknown as EmbedBuilder] } as Parameters<
        typeof message.edit
      >[0]);
    } catch (error) {
      SystemLogger.error('Failed to update lobby message', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async updateRound(
    sessionId: string,
    data: RoundStartData | RoundResultData,
    type: 'start' | 'result'
  ): Promise<void> {
    const message = this.roundMessages.get(sessionId);
    if (!message) {
      return;
    }

    try {
      let embed;
      if (type === 'start') {
        embed = EmbedFactory.roundStart(data as RoundStartData);
      } else {
        embed = EmbedFactory.roundResult(data as RoundResultData);
      }
      await message.edit({ embeds: [embed] } as Parameters<typeof message.edit>[0]);
    } catch (error) {
      SystemLogger.error('Failed to update round message', {
        sessionId,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async cleanup(sessionId: string): Promise<void> {
    this.lobbyMessages.delete(sessionId);
    this.roundMessages.delete(sessionId);
  }
}
