import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NtfyService {
  private readonly logger = new Logger(NtfyService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(title: string, message: string) {
    const url = this.configService.get<string>('NTFY_URL');
    const token = this.configService.get<string>('NTFY_TOKEN');

    if (!url) {
      this.logger.warn('NTFY_URL ist nicht gesetzt, überspringe Benachrichtigung.');
      return;
    }

    const parsed = new URL(url);
    const topic = parsed.pathname.replace(/^\//, '');
    const baseUrl = `${parsed.protocol}//${parsed.host}`;

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic,
          title,
          message,
          priority: 4,
          tags: ['x', 'calendar'],
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `ntfy antwortete mit ${response.status}: ${await response.text()}`,
        );
      }
    } catch (e) {
      this.logger.error(`ntfy-Benachrichtigung fehlgeschlagen: ${e}`);
    }
  }
}
