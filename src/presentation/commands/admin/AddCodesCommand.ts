import { Attachment } from 'discord.js';
import { BotCommand, CommandContext } from '../../../types/command.types';
import { BotRole } from '../../../domain/players/PermissionService';
import { EmbedFactory } from '../../embeds/EmbedFactory';
import { SystemLogger } from '../../../infrastructure/logger/SystemLogger';
import { auditLogger } from '../../../infrastructure/logger/AuditLogger';
import {
  DatabaseService,
  getDatabaseService,
} from '../../../infrastructure/database/DatabaseService';
import crypto from 'crypto';

export class AddCodesCommand implements BotCommand {
  name = 'addcodes';
  aliases: string[] = [];
  requiredRole = BotRole.ADMIN;
  cooldown = 0;

  async execute(ctx: CommandContext): Promise<void> {
    try {
      const attachments = ctx.message.attachments;

      if (attachments.size === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'Uso: !addcodes [adjunta un archivo .txt con códigos]',
              'Un código por línea'
            ) as any,
          ],
        });
        return;
      }

      const attachment = attachments.first();
      if (!attachment) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [EmbedFactory.error('No se encontró el archivo adjunto') as any],
        });
        return;
      }

      if (!attachment.name?.endsWith('.txt')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [
            EmbedFactory.error(
              'Formato inválido',
              'Adjunta un archivo .txt con un código por línea'
            ) as any,
          ],
        });
        return;
      }

      const codes = await this.downloadAndParseCodes(attachment.url);

      if (codes.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply({
          embeds: [EmbedFactory.error('El archivo está vacío o no tiene códigos válidos') as any],
        });
        return;
      }

      const count = await this.insertCodes(codes, ctx.userId);

      auditLogger.logCodeLoaded(ctx.userId, count);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.codesLoaded(count) as any],
      });
    } catch (error) {
      SystemLogger.error('AddCodesCommand failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.userId,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.reply({
        embeds: [EmbedFactory.error('No pudimos procesar el archivo. Intenta de nuevo.') as any],
      });
    }
  }

  private async downloadAndParseCodes(url: string): Promise<string[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);

    const codes: string[] = [];
    for (const line of lines) {
      const code = line.trim();
      if (code && code.length > 0 && code.length <= 100) {
        codes.push(code.toUpperCase());
      }
    }

    return codes;
  }

  private async insertCodes(codes: string[], adminId: string): Promise<number> {
    const db = getDatabaseService();

    const existingCodes = new Set<string>();
    const existing = db.run<{ code: string }>(
      'SELECT code FROM redeem_codes WHERE code IN (' + codes.map(() => '?').join(',') + ')',
      codes
    );
    for (const row of existing) {
      existingCodes.add(row.code);
    }

    const newCodes = codes.filter(c => !existingCodes.has(c));

    if (newCodes.length === 0) {
      return 0;
    }

    const insertStmt = db
      .getDatabase()
      .prepare(
        'INSERT OR IGNORE INTO redeem_codes (id, code, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      );

    db.transaction(() => {
      for (const code of newCodes) {
        const id = this.generateId();
        insertStmt.run(id, code, 'available');
      }
    });

    SystemLogger.info('AddCodesCommand: codes inserted', {
      adminId,
      total: codes.length,
      new: newCodes.length,
      duplicates: codes.length - newCodes.length,
    });

    return newCodes.length;
  }

  private generateId(): string {
    const bytes = Buffer.alloc(16);
    const randomFillSync = require('crypto').randomFillSync;
    randomFillSync(bytes);
    return bytes.toString('hex');
  }
}
