import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis | null = null;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          tls: { rejectUnauthorized: false },
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          enableOfflineQueue: true,
          lazyConnect: true,
        });
      } else {
        const host = process.env.REDIS_HOST || "localhost";
        const port = parseInt(process.env.REDIS_PORT || "6379", 10);
        const password = process.env.REDIS_PASSWORD || undefined;
        const isUpstash = host.includes("upstash.io") || process.env.REDIS_TLS === "true";

        this.client = new Redis({
          host,
          port,
          password,
          tls: isUpstash ? { rejectUnauthorized: false } : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          enableOfflineQueue: true,
          lazyConnect: true,
        });
      }

      this.client.connect().then(() => {
        this.logger.log("Upstash Redis on-demand client connected (zero idle polling).");
      }).catch((err) => {
        this.logger.warn(`Redis on-demand connection warning: ${err.message}`);
      });
    } catch (e: any) {
      this.logger.warn(`Failed to initialize Redis client: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }
}
