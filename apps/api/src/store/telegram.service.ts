import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

/**
 * Cliente mínimo del Bot API de Telegram. La plataforma tiene UN bot (BotFather);
 * cada tenant vincula su chat y recibe los avisos de pedidos nuevos. Best-effort:
 * los envíos nunca lanzan (loguean y siguen) para no romper el checkout.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get cfg() {
    return this.config.get('telegram', { infer: true });
  }

  /** ¿Hay bot configurado? (sin token, las notificaciones quedan deshabilitadas). */
  get enabled(): boolean {
    return !!this.cfg.botToken;
  }

  get botUsername(): string {
    return this.cfg.botUsername;
  }

  get webhookSecret(): string {
    return this.cfg.webhookSecret;
  }

  /** Envía un mensaje HTML a un chat. Devuelve true si Telegram aceptó el envío. */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    const token = this.cfg.botToken;
    if (!token || !chatId) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (!res.ok) {
        this.logger.warn(`Telegram sendMessage HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Telegram sendMessage error: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
}
