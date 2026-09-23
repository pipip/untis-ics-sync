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
      this.logger.warn(
        'NTFY_URL ist nicht gesetzt, überspringe Benachrichtigung.',
      );
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Title: title,
          Priority: 'high',
          Tags: 'x,calendar',
        },
        body: message,
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
