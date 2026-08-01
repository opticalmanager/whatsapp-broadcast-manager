import { Injectable, Logger } from "@nestjs/common";
import { AuthenticationState, AuthenticationCreds, initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import Redis from "ioredis";

@Injectable()
export class BaileysAuthStoreService {
  private readonly logger = new Logger(BaileysAuthStoreService.name);
  private redisClient: Redis;

  constructor() {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.redisClient = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.redisClient.connect().catch((err) => {
      this.logger.warn(`Redis connection deferred: ${err.message}. Operating with fallback in-memory auth cache.`);
    });
  }

  private getKey(numberId: string, type: string, id: string): string {
    return `wa:session:${numberId}:${type}:${id}`;
  }

  private getCredsKey(numberId: string): string {
    return `wa:session:${numberId}:creds`;
  }

  /**
   * Constructs an AuthenticationState object compatible with Baileys.
   * Leverages Redis for persistence with fallback memory store.
   */
  async useRedisAuthState(numberId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const memoryCache: Record<string, string> = {};

    // 1. Fetch credentials from Redis
    let creds: AuthenticationCreds;
    try {
      const rawCreds = await this.redisClient.get(this.getCredsKey(numberId));
      if (rawCreds) {
        creds = JSON.parse(rawCreds, BufferJSON.reviver);
      } else {
        creds = initAuthCreds();
      }
    } catch {
      creds = initAuthCreds();
    }

    const writeData = async (data: any, key: string) => {
      const value = JSON.stringify(data, BufferJSON.replacer);
      memoryCache[key] = value;
      try {
        await this.redisClient.set(key, value);
      } catch (err) {
        this.logger.verbose(`Redis write fallback for key ${key}`);
      }
    };

    const readData = async (key: string) => {
      if (memoryCache[key]) {
        return JSON.parse(memoryCache[key], BufferJSON.reviver);
      }
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          memoryCache[key] = raw;
          return JSON.parse(raw, BufferJSON.reviver);
        }
      } catch {
        return null;
      }
      return null;
    };

    const removeData = async (key: string) => {
      delete memoryCache[key];
      try {
        await this.redisClient.del(key);
      } catch {
        // Ignored
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

  /**
   * Clears all session keys from Redis when user logs out.
   */
  async purgeSessionKeys(numberId: string): Promise<void> {
    try {
      const pattern = `wa:session:${numberId}:*`;
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(`Purged ${keys.length} session keys for number ${numberId}`);
      }
    } catch (error: any) {
      this.logger.error(`Error purging session keys for ${numberId}: ${error.message}`);
    }
  }
}
