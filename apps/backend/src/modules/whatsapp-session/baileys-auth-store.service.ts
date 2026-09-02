import { Injectable, Logger } from "@nestjs/common";
import { AuthenticationState, AuthenticationCreds, initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import Redis from "ioredis";

@Injectable()
export class BaileysAuthStoreService {
  private readonly logger = new Logger(BaileysAuthStoreService.name);
  private redisClient: Redis;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, {
        tls: { rejectUnauthorized: false },
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });
    } else {
      const host = process.env.REDIS_HOST || "localhost";
      const port = parseInt(process.env.REDIS_PORT || "6379", 10);
      const password = process.env.REDIS_PASSWORD || undefined;
      const isUpstash = host.includes("upstash.io") || process.env.REDIS_TLS === "true";

      this.redisClient = new Redis({
        host,
        port,
        password,
        tls: isUpstash ? { rejectUnauthorized: false } : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });
    }

    this.redisClient.on("ready", () => {
      this.isConnected = true;
      this.logger.log("Redis auth store connected successfully.");
    });

    this.redisClient.on("error", () => {
      this.isConnected = false;
    });

    this.redisClient.connect().catch(() => {
      this.isConnected = false;
      this.logger.log("Operating with high-speed in-memory auth store fallback.");
    });
  }


  private isRedisActive(): boolean {
    return this.isConnected && this.redisClient.status === "ready";
  }

  private getKey(numberId: string, type: string, id: string): string {
    return `wa:session:${numberId}:${type}:${id}`;
  }

  private getCredsKey(numberId: string): string {
    return `wa:session:${numberId}:creds`;
  }

  /**
   * Constructs an AuthenticationState object compatible with Baileys.
   * Instant performance bypass when Redis is offline to prevent socket timeouts.
   */
  async useRedisAuthState(numberId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const memoryCache: Record<string, string> = {};

    // 1. Fetch credentials (instant memory fallback if Redis offline)
    let creds: AuthenticationCreds = initAuthCreds();

    if (this.isRedisActive()) {
      try {
        const rawCreds = await this.redisClient.get(this.getCredsKey(numberId));
        if (rawCreds) {
          creds = JSON.parse(rawCreds, BufferJSON.reviver);
        }
      } catch {
        creds = initAuthCreds();
      }
    }

    const writeData = async (data: any, key: string) => {
      const value = JSON.stringify(data, BufferJSON.replacer);
      memoryCache[key] = value;
      if (this.isRedisActive()) {
        try {
          await this.redisClient.set(key, value);
        } catch {
          // Ignored
        }
      }
    };

    const readData = async (key: string) => {
      if (memoryCache[key]) {
        return JSON.parse(memoryCache[key], BufferJSON.reviver);
      }
      if (this.isRedisActive()) {
        try {
          const raw = await this.redisClient.get(key);
          if (raw) {
            memoryCache[key] = raw;
            return JSON.parse(raw, BufferJSON.reviver);
          }
        } catch {
          return null;
        }
      }
      return null;
    };

    const removeData = async (key: string) => {
      delete memoryCache[key];
      if (this.isRedisActive()) {
        try {
          await this.redisClient.del(key);
        } catch {
          // Ignored
        }
      }
    };

    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const data: { [id: string]: any } = {};
            await Promise.all(
              ids.map(async (id) => {
                let value = await readData(this.getKey(numberId, type, id));
                if (type === "app-state-sync-key" && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              })
            );
            return data;
          },
          set: async (data) => {
            const tasks: Promise<void>[] = [];
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const key = this.getKey(numberId, category, id);
                if (value) {
                  tasks.push(writeData(value, key));
                } else {
                  tasks.push(removeData(key));
                }
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: async () => {
        await writeData(creds, this.getCredsKey(numberId));
      },
    };
  }

  async purgeSessionKeys(numberId: string): Promise<void> {
    if (this.isRedisActive()) {
      try {
        const pattern = `wa:session:${numberId}:*`;
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (error: any) {
        this.logger.error(`Error purging session keys for ${numberId}: ${error.message}`);
      }
    }
  }
}
