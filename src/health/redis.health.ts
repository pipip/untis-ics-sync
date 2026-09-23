import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const client = new Redis({
      host: this.configService.get<string>('BULL_REDIS_HOST'),
      port: this.configService.get<number>('BULL_REDIS_PORT'),
      path: this.configService.get<string>('BULL_REDIS_PATH'),
      lazyConnect: true,
      retryStrategy: () => null, // kein Retry, sofort fehlschlagen für den Check
    });

    try {
      await client.connect();
      await client.ping();
      client.disconnect();
      return this.getStatus(key, true);
    } catch (e) {
      client.disconnect();
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: e.message }),
      );
    }
  }
}
