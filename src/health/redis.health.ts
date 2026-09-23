import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {}

  async isHealthy(key: string) {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        const client = new Redis({
          host: this.configService.get<string>('BULL_REDIS_HOST'),
          port: this.configService.get<number>('BULL_REDIS_PORT'),
          path: this.configService.get<string>('BULL_REDIS_PATH'),
          lazyConnect: true,
          retryStrategy: () => null,
        });

        try {
          await client.connect();
          await client.ping();
        } finally {
          client.disconnect();
        }
      })
      .withTimeout(3000);
  }
}
