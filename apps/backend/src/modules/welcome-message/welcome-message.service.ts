import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";
import { AutoReplyService } from "../auto-reply/auto-reply.service";
import * as fs from "fs";
import * as path from "path";

export interface WelcomeMessageSettings {
  organizationId: string;
  instanceId: string;
  enabled: boolean;
  frequency: "FIRST_TIME_EVER" | "ONCE_PER_DAY" | "EVERY_SESSION_48H";
  minDelaySec: number;
  maxDelaySec: number;
  excludeFriendlyNumbers: boolean;
  responses: Array<{ type: "Text" | "Text With Media" | "Button" | "Poll"; text: string; mediaUrl?: string; }>;
  updatedAt: Date;
}

export interface WelcomeLogItem {
  id: string;
  phone: string;
  name: string;
  instanceId: string;
  sentAt: Date;
  status: "DELIVERED" | "SENT";
}

@Injectable()
export class WelcomeMessageService implements OnModuleInit {
  private readonly logger = new Logger(WelcomeMessageService.name);
  private settingsStore = new Map<string, WelcomeMessageSettings>();
  private welcomeHistoryStore = new Map<string, number>();
  private welcomeLogsStore: WelcomeLogItem[] = [];
  private readonly storageFilePath = path.join(process.cwd(), "welcome_message_data.json");

  constructor(
    private readonly db: DatabaseService,
    private readonly baileysService: WhatsAppSessionManagerService,
    private readonly autoReplyService: AutoReplyService
  ) {}

  async onModuleInit() {
    this.logger.log("Initializing WhatsApp Welcome Message Engine...");
    await this.loadFromDatabase();

    this.baileysService.onIncomingMessage((instanceId, orgId, remoteJid, text, pushName) => {
      this.handleIncomingWelcome(instanceId, orgId, remoteJid, pushName).catch((err) => {
        this.logger.error("Welcome error: " + err.message);
      });
    });
  }

  private async loadFromDatabase() {
    try {
      const dbSettings = await this.db.sql`
        SELECT id, organization_id, instance_id, enabled, frequency, min_delay_sec, max_delay_sec, exclude_friendly_numbers, responses, updated_at
        FROM welcome_message_settings
      `;

      const dbLogs = await this.db.sql`
        SELECT id, organization_id, instance_id, phone, name, status, sent_at
        FROM welcome_message_logs
        ORDER BY sent_at DESC
        LIMIT 100
      `;

      const parseJson = (v: any) => {
        if (!v) return [];
        if (typeof v === "object") return v;
        try { return JSON.parse(v); } catch { return []; }
      };

      if (dbSettings && dbSettings.length > 0) {
        dbSettings.forEach((s: any) => {
          const key = s.organization_id + "_" + (s.instance_id || "ALL");
          this.settingsStore.set(key, {
            organizationId: s.organization_id,
            instanceId: s.instance_id || "ALL",
            enabled: s.enabled === true,
            frequency: s.frequency || "FIRST_TIME_EVER",
            minDelaySec: Number(s.min_delay_sec) || 0.8,
            maxDelaySec: Number(s.max_delay_sec) || 2.2,
            excludeFriendlyNumbers: s.exclude_friendly_numbers !== false,
            responses: parseJson(s.responses),
            updatedAt: new Date(s.updated_at || Date.now()),
          });
        });
      }

      if (dbLogs && dbLogs.length > 0) {
        this.welcomeLogsStore = dbLogs.map((l: any) => ({
          id: l.id,
          phone: l.phone,
          name: l.name || "Customer",
          instanceId: l.instance_id,
          sentAt: new Date(l.sent_at || Date.now()),
          status: l.status || "DELIVERED",
        }));

        dbLogs.forEach((l: any) => {
          const cleanPhone = (l.phone || "").replace(/\D/g, "");
          if (cleanPhone) {
            this.welcomeHistoryStore.set(cleanPhone, new Date(l.sent_at || Date.now()).getTime());
          }
        });
      }

      // If DB was empty, migrate from disk JSON
      if (this.settingsStore.size === 0 && fs.existsSync(this.storageFilePath)) {
        this.migrateFromDisk();
      }

      this.logger.log(`Loaded ${this.settingsStore.size} welcome settings and ${this.welcomeLogsStore.length} logs from PostgreSQL.`);
    } catch (err: any) {
      this.logger.warn(`Could not load welcome data from DB: ${err.message}. Falling back to disk...`);
      this.loadFromDisk();
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.settings)) {
          data.settings.forEach((s: any) => {
            const key = s.organizationId + "_" + (s.instanceId || "ALL");
            this.settingsStore.set(key, s);
          });
        }
        if (data.history && typeof data.history === "object") {
          Object.entries(data.history).forEach(([phone, ts]) => {
            this.welcomeHistoryStore.set(phone, Number(ts));
          });
        }
        if (Array.isArray(data.logs)) {
          this.welcomeLogsStore = data.logs;
        }
      }
    } catch (err: any) {
      this.logger.warn("Could not load welcome data from disk: " + err.message);
    }
  }

  private async migrateFromDisk() {
    try {
      this.loadFromDisk();
      for (const st of this.settingsStore.values()) {
        const id = `${st.organizationId}_${st.instanceId || 'ALL'}`;
        await this.db.sql`
          INSERT INTO welcome_message_settings (id, organization_id, instance_id, enabled, frequency, min_delay_sec, max_delay_sec, exclude_friendly_numbers, responses, updated_at)
          VALUES (${id}, ${st.organizationId}, ${st.instanceId || 'ALL'}, ${st.enabled}, ${st.frequency}, ${st.minDelaySec}, ${st.maxDelaySec}, ${st.excludeFriendlyNumbers}, ${JSON.stringify(st.responses)}::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, responses = EXCLUDED.responses, updated_at = NOW()
        `.catch(() => {});
      }
      for (const log of this.welcomeLogsStore.slice(0, 50)) {
        await this.db.sql`
          INSERT INTO welcome_message_logs (id, organization_id, instance_id, phone, name, status, sent_at)
          VALUES (${log.id}, 'org-demo', ${log.instanceId}, ${log.phone}, ${log.name}, ${log.status}, ${new Date(log.sentAt).toISOString()}::timestamptz)
          ON CONFLICT (id) DO NOTHING
        `.catch(() => {});
      }
      this.logger.log(`Migrated welcome data to PostgreSQL.`);
    } catch {}
  }

  private saveToDisk() {
    try {
      const historyObj: Record<string, number> = {};
      this.welcomeHistoryStore.forEach((ts, phone) => { historyObj[phone] = ts; });
      const data = {
        settings: Array.from(this.settingsStore.values()),
        history: historyObj,
        logs: this.welcomeLogsStore.slice(0, 100),
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
  }

  public resolveSpintax(text: string) {
    if (!text) return "";
    let resolved = text;
    while (/\{([^{}]+)\}/.test(resolved)) {
      resolved = resolved.replace(/\{([^{}]+)\}/g, (_, options) => {
        const parts = options.split("|");
        return parts[Math.floor(Math.random() * parts.length)];
      });
    }
    return resolved;
  }

  public async handleIncomingWelcome(instanceId: string, orgId: string, remoteJid: string, pushName?: string) {
    const cleanPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
    if (!cleanPhone) return;

    const settingsKey = orgId + "_" + instanceId;
    const fallbackKey = orgId + "_ALL";
    const settings: WelcomeMessageSettings = this.settingsStore.get(settingsKey) || this.settingsStore.get(fallbackKey) || {
      organizationId: orgId,
      instanceId,
      enabled: false,
      frequency: "FIRST_TIME_EVER",
      minDelaySec: 0.8,
      maxDelaySec: 2.2,
      excludeFriendlyNumbers: true,
      responses: [
        {
          type: "Text",
          text: "👋 Hello {{name}}! Thank you for contacting us. How can we assist you today?",
          mediaUrl: undefined,
        },
      ],
      updatedAt: new Date(),
    };

    if (!settings.enabled) return;

    if (settings.excludeFriendlyNumbers) {
      const autoReplySettings = this.autoReplyService.getSettings(orgId, instanceId);
      const isFriendly = (autoReplySettings.friendlyNumbers || []).some((fn) => {
        const cleanFn = fn.replace(/\D/g, "");
        return cleanFn && (cleanPhone.includes(cleanFn) || cleanFn.includes(cleanPhone));
      });
      if (isFriendly) return;
    }

    // Strict First-Time-Ever Verification:
    // 1. Check in-memory session cache
    const lastTimestamp = this.welcomeHistoryStore.get(cleanPhone) || 0;
    if (lastTimestamp > 0) {
      return;
    }

    // 2. Check persistent DB logs (Has this phone ever received a welcome greeting?)
    try {
      const priorLogs = await this.db.sql`
        SELECT id FROM public.welcome_message_logs
        WHERE organization_id = ${orgId}
          AND (phone = ${cleanPhone} OR phone = ${cleanPhone.slice(-10)} OR phone = ${'+' + cleanPhone})
        LIMIT 1
      `;
      if (priorLogs && priorLogs.length > 0) {
        this.welcomeHistoryStore.set(cleanPhone, Date.now());
        return;
      }

      // 3. Check chat conversation history (If more than 1 incoming message, this is a returning contact)
      const chatHistory = await this.db.sql`
        SELECT COUNT(*) as count FROM public.chat_messages
        WHERE organization_id = ${orgId}
          AND (phone = ${cleanPhone} OR phone = ${cleanPhone.slice(-10)})
      `;
      if (chatHistory && Number(chatHistory[0]?.count) > 1) {
        this.welcomeHistoryStore.set(cleanPhone, Date.now());
        return;
      }

      // 4. Check unsubscribers list
      const unsubCheck = await this.db.sql`
        SELECT id FROM public.unsubscribers
        WHERE organization_id = ${orgId}
          AND (phone = ${cleanPhone} OR phone = ${cleanPhone.slice(-10)})
        LIMIT 1
      `;
      if (unsubCheck && unsubCheck.length > 0) {
        return;
      }
    } catch (dbErr: any) {
      this.logger.warn(`Error during welcome verification: ${dbErr.message}`);
    }

    this.welcomeHistoryStore.set(cleanPhone, Date.now());
    this.logger.log("[Welcome Triggered] Greeting first-time contact " + cleanPhone);

    const socket = (this.baileysService as any).sessions?.get(instanceId) || this.baileysService.getSessionSocket(instanceId);

    for (let i = 0; i < settings.responses.length; i++) {
      const resp = settings.responses[i];
      if (!resp.text && !resp.mediaUrl) continue;

      const minD = Math.max(settings.minDelaySec || 0.8, 0.4);
      const maxD = Math.max(settings.maxDelaySec || 2.2, minD);
      const delayMs = Math.round((minD + Math.random() * (maxD - minD)) * 1000);

      if (socket) {
        try { await socket.sendPresenceUpdate("composing", remoteJid); } catch (e) {}
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (socket) {
        try { await socket.sendPresenceUpdate("paused", remoteJid); } catch (e) {}
      }

      let replyText = (resp.text || "")
        .replace(/\{\{name\}\}/gi, pushName || "Customer")
        .replace(/\{\{phone\}\}/gi, "+" + cleanPhone)
        .replace(/\{\{shop_name\}\}/gi, "Optical Store")
        .replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
        .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"));

      replyText = this.resolveSpintax(replyText);

      try {
        if (socket && !resp.mediaUrl) {
          await socket.sendMessage(remoteJid, { text: replyText });
        } else {
          await this.baileysService.sendTextMessage(instanceId, cleanPhone, replyText, resp.mediaUrl, orgId);
        }
        this.logger.log("[Welcome Sent] Dispatched welcome greeting to " + cleanPhone);
      } catch (err: any) {
        this.logger.error("Failed to send welcome message: " + err.message);
      }
    }

    const logItem: WelcomeLogItem = {
      id: "wlog_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      phone: "+" + cleanPhone,
      name: pushName || "New Contact",
      instanceId,
      sentAt: new Date(),
      status: "DELIVERED",
    };

    this.welcomeLogsStore.unshift(logItem);
    this.saveToDisk();

    // Persist log to PostgreSQL
    this.db.sql`
      INSERT INTO welcome_message_logs (id, organization_id, instance_id, phone, name, status, sent_at)
      VALUES (${logItem.id}, ${orgId || 'org-demo'}, ${instanceId}, ${logItem.phone}, ${logItem.name}, ${logItem.status}, NOW())
    `.catch((err: any) => this.logger.warn(`Failed to insert welcome log to DB: ${err.message}`));
  }

  getSettings(orgId: string, instanceId?: string): WelcomeMessageSettings {
    const key = orgId + "_" + (instanceId || "ALL");
    const existing = this.settingsStore.get(key);
    if (existing) return existing;
    const def: WelcomeMessageSettings = {
      organizationId: orgId,
      instanceId: instanceId || "ALL",
      enabled: false,
      frequency: "FIRST_TIME_EVER",
      minDelaySec: 0.8,
      maxDelaySec: 2.2,
      excludeFriendlyNumbers: true,
      responses: [
        {
          type: "Text",
          text: "👋 Hello {{name}}! Thank you for contacting us. How can we assist you today?",
          mediaUrl: undefined,
        },
      ],
      updatedAt: new Date(),
    };
    this.settingsStore.set(key, def);
    return def;
  }

  updateSettings(orgId: string, instanceId: string, payload: Partial<WelcomeMessageSettings>): WelcomeMessageSettings {
    const current = this.getSettings(orgId, instanceId);
    const updated: WelcomeMessageSettings = { ...current, ...payload, updatedAt: new Date() };
    const key = orgId + "_" + (instanceId || "ALL");
    this.settingsStore.set(key, updated);
    this.saveToDisk();

    // Persist to PostgreSQL
    this.db.sql`
      INSERT INTO welcome_message_settings (id, organization_id, instance_id, enabled, frequency, min_delay_sec, max_delay_sec, exclude_friendly_numbers, responses, updated_at)
      VALUES (${key}, ${orgId}, ${instanceId || 'ALL'}, ${updated.enabled}, ${updated.frequency}, ${updated.minDelaySec}, ${updated.maxDelaySec}, ${updated.excludeFriendlyNumbers}, ${JSON.stringify(updated.responses)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        frequency = EXCLUDED.frequency,
        min_delay_sec = EXCLUDED.min_delay_sec,
        max_delay_sec = EXCLUDED.max_delay_sec,
        exclude_friendly_numbers = EXCLUDED.exclude_friendly_numbers,
        responses = EXCLUDED.responses,
        updated_at = NOW()
    `.catch((err: any) => this.logger.warn(`Failed to persist welcome settings to DB: ${err.message}`));

    return updated;
  }

  async getLogs(orgId?: string, instanceId?: string): Promise<WelcomeLogItem[]> {
    const effectiveOrg = orgId || "org-demo";
    try {
      let rows;
      if (instanceId && instanceId !== "ALL") {
        rows = await this.db.sql`
          SELECT id, phone, name, instance_id, sent_at, status
          FROM public.welcome_message_logs
          WHERE organization_id = ${effectiveOrg}
            AND instance_id = ${instanceId}
          ORDER BY sent_at DESC
          LIMIT 100
        `;
      } else {
        rows = await this.db.sql`
          SELECT id, phone, name, instance_id, sent_at, status
          FROM public.welcome_message_logs
          WHERE organization_id = ${effectiveOrg}
          ORDER BY sent_at DESC
          LIMIT 100
        `;
      }

      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          phone: r.phone,
          name: r.name || "Customer",
          instanceId: r.instance_id,
          sentAt: new Date(r.sent_at || Date.now()),
          status: r.status || "DELIVERED",
        }));
      }
    } catch (err: any) {
      this.logger.warn(`Error querying welcome logs from DB: ${err.message}`);
    }

    if (!instanceId || instanceId === "ALL") return this.welcomeLogsStore;
    return this.welcomeLogsStore.filter((l) => l.instanceId === instanceId);
  }

  async resetHistory(orgId?: string): Promise<boolean> {
    this.welcomeHistoryStore.clear();
    this.welcomeLogsStore = [];
    this.saveToDisk();

    try {
      if (orgId) {
        await this.db.sql`DELETE FROM welcome_message_logs WHERE organization_id = ${orgId}`;
      } else {
        await this.db.sql`DELETE FROM welcome_message_logs`;
      }
    } catch {}

    return true;
  }
}