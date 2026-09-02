import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";
import * as fs from "fs";
import * as path from "path";

export interface AutoReplyResponseItem {
  type: "Text" | "Text With Media" | "Button" | "Poll";
  text: string;
  mediaUrl?: string;
  buttons?: Array<{ id: string; type: string; displayText: string; value: string }>;
  pollOptions?: string[];
}

export interface AutoReplyRule {
  id: string;
  organizationId: string;
  instanceId?: string;
  matchType: "Contains" | "Exact match" | "Starts with" | "Ends with" | "Regex (Pattern)";
  keyword: string;
  responses: AutoReplyResponseItem[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoReplySettings {
  organizationId: string;
  instanceId: string;
  botEngineEnabled: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  friendlyNumbers: string[];
  updatedAt: Date;
}

@Injectable()
export class AutoReplyService implements OnModuleInit {
  private readonly logger = new Logger(AutoReplyService.name);
  private rulesStore: Map<string, AutoReplyRule> = new Map();
  private settingsStore: Map<string, AutoReplySettings> = new Map();
  private readonly storageFilePath = path.join(process.cwd(), "auto_reply_rules.json");
  private lastReplyTimestamps: Map<string, number> = new Map();

  constructor(
    private readonly db: DatabaseService,
    private readonly baileysService: WhatsAppSessionManagerService
  ) {}

  async onModuleInit() {
    this.logger.log("Initializing WhatsApp Auto-reply / KeyMarker engine...");
    await this.loadFromDatabase();

    this.baileysService.onIncomingMessage((instanceId, orgId, remoteJid, text, pushName) => {
      this.handleIncomingMessage(instanceId, orgId, remoteJid, text, pushName).catch((err) => {
        this.logger.error("AutoReply error: " + err.message);
      });
    });
  }

  private async loadFromDatabase() {
    try {
      const dbRules = await this.db.sql`
        SELECT id, organization_id, instance_id, match_type, keyword, responses, enabled, created_at, updated_at
        FROM auto_reply_rules
        ORDER BY created_at ASC
      `;

      const dbSettings = await this.db.sql`
        SELECT organization_id, instance_id, bot_engine_enabled, min_delay_sec, max_delay_sec, friendly_numbers, updated_at
        FROM auto_reply_settings
      `;

      const parseJson = (v: any) => {
        if (!v) return [];
        if (typeof v === "object") return v;
        try { return JSON.parse(v); } catch { return []; }
      };

      if (dbRules && dbRules.length > 0) {
        dbRules.forEach((r: any) => {
          this.rulesStore.set(r.id, {
            id: r.id,
            organizationId: r.organization_id,
            instanceId: r.instance_id || "ALL",
            matchType: r.match_type || "Contains",
            keyword: r.keyword,
            responses: parseJson(r.responses),
            enabled: r.enabled !== false,
            createdAt: new Date(r.created_at || Date.now()),
            updatedAt: new Date(r.updated_at || Date.now()),
          });
        });
      }

      if (dbSettings && dbSettings.length > 0) {
        dbSettings.forEach((s: any) => {
          const key = s.organization_id + "_" + (s.instance_id || "ALL");
          this.settingsStore.set(key, {
            organizationId: s.organization_id,
            instanceId: s.instance_id || "ALL",
            botEngineEnabled: s.bot_engine_enabled !== false,
            minDelaySec: Number(s.min_delay_sec) || 0.8,
            maxDelaySec: Number(s.max_delay_sec) || 2.2,
            friendlyNumbers: parseJson(s.friendly_numbers),
            updatedAt: new Date(s.updated_at || Date.now()),
          });
        });
      }

      // If DB was empty, migrate from disk JSON
      if (this.rulesStore.size === 0 && fs.existsSync(this.storageFilePath)) {
        this.migrateFromDisk();
      }

      this.logger.log(`Loaded ${this.rulesStore.size} auto-reply rules and ${this.settingsStore.size} settings from PostgreSQL.`);
    } catch (err: any) {
      this.logger.warn(`Could not load auto-reply from DB: ${err.message}. Falling back to disk...`);
      this.loadFromDisk();
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.rules)) {
          data.rules.forEach((r: any) => this.rulesStore.set(r.id, r));
        }
        if (Array.isArray(data.settings)) {
          data.settings.forEach((s: any) => {
            const key = s.organizationId + "_" + (s.instanceId || "ALL");
            this.settingsStore.set(key, s);
          });
        }
      }
    } catch (err: any) {
      this.logger.warn("Could not load auto-reply rules from disk: " + err.message);
    }
  }

  private async migrateFromDisk() {
    try {
      this.loadFromDisk();
      for (const rule of this.rulesStore.values()) {
        await this.db.sql`
          INSERT INTO auto_reply_rules (id, organization_id, instance_id, match_type, keyword, responses, enabled, created_at, updated_at)
          VALUES (${rule.id}, ${rule.organizationId}, ${rule.instanceId || 'ALL'}, ${rule.matchType}, ${rule.keyword}, ${JSON.stringify(rule.responses)}::jsonb, ${rule.enabled}, ${rule.createdAt.toISOString()}::timestamptz, ${rule.updatedAt.toISOString()}::timestamptz)
          ON CONFLICT (id) DO UPDATE SET keyword = EXCLUDED.keyword, responses = EXCLUDED.responses, enabled = EXCLUDED.enabled, updated_at = NOW()
        `.catch(() => {});
      }
      for (const st of this.settingsStore.values()) {
        const id = `${st.organizationId}_${st.instanceId || 'ALL'}`;
        await this.db.sql`
          INSERT INTO auto_reply_settings (id, organization_id, instance_id, bot_engine_enabled, min_delay_sec, max_delay_sec, friendly_numbers, updated_at)
          VALUES (${id}, ${st.organizationId}, ${st.instanceId || 'ALL'}, ${st.botEngineEnabled}, ${st.minDelaySec}, ${st.maxDelaySec}, ${JSON.stringify(st.friendlyNumbers)}::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE SET bot_engine_enabled = EXCLUDED.bot_engine_enabled, min_delay_sec = EXCLUDED.min_delay_sec, max_delay_sec = EXCLUDED.max_delay_sec, friendly_numbers = EXCLUDED.friendly_numbers, updated_at = NOW()
        `.catch(() => {});
      }
      this.logger.log(`Migrated ${this.rulesStore.size} disk rules to PostgreSQL.`);
    } catch {}
  }

  private saveToDisk() {
    try {
      const data = {
        rules: Array.from(this.rulesStore.values()),
        settings: Array.from(this.settingsStore.values()),
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

  public async handleIncomingMessage(instanceId: string, orgId: string, remoteJid: string, incomingText: string, pushName?: string) {
    if (!incomingText || !incomingText.trim()) return;
    const cleanText = incomingText.trim();
    const cleanPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");

    const settingsKey = orgId + "_" + instanceId;
    const fallbackSettingsKey = orgId + "_ALL";
    const settings = this.settingsStore.get(settingsKey) || this.settingsStore.get(fallbackSettingsKey) || {
      organizationId: orgId,
      instanceId,
      botEngineEnabled: true,
      minDelaySec: 0.8,
      maxDelaySec: 2.2,
      friendlyNumbers: [],
      updatedAt: new Date(),
    };

    if (!settings.botEngineEnabled) return;

    const isFriendly = (settings.friendlyNumbers || []).some((fn) => {
      const cleanFn = fn.replace(/\D/g, "");
      return cleanFn && (cleanPhone.includes(cleanFn) || cleanFn.includes(cleanPhone));
    });

    if (isFriendly) {
      this.logger.log("[AutoReply] Ignored friendly contact: " + cleanPhone);
      return;
    }

    const now = Date.now();
    const lastReply = this.lastReplyTimestamps.get(remoteJid) || 0;
    if (now - lastReply < 3000) {
      this.logger.log("[AutoReply] Throttled rapid message from " + remoteJid);
      return;
    }

    const orgRules = Array.from(this.rulesStore.values()).filter(
      (r) => r.organizationId === orgId && (!r.instanceId || r.instanceId === "ALL" || r.instanceId === instanceId) && r.enabled
    );

    let matchedRule = null;
    for (const rule of orgRules) {
      const keyword = (rule.keyword || "").trim();
      if (!keyword) continue;
      const lowerText = cleanText.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();

      if (rule.matchType === "Exact match") {
        if (lowerText === lowerKeyword) { matchedRule = rule; break; }
      } else if (rule.matchType === "Starts with") {
        if (lowerText.startsWith(lowerKeyword)) { matchedRule = rule; break; }
      } else if (rule.matchType === "Ends with") {
        if (lowerText.endsWith(lowerKeyword)) { matchedRule = rule; break; }
      } else if (rule.matchType === "Regex (Pattern)") {
        try {
          const reg = new RegExp(keyword, "i");
          if (reg.test(cleanText)) { matchedRule = rule; break; }
        } catch (e) {}
      } else {
        if (lowerText.includes(lowerKeyword)) { matchedRule = rule; break; }
      }
    }

    if (!matchedRule || !matchedRule.responses || matchedRule.responses.length === 0) return;

    this.logger.log("[AutoReply Triggered] Rule " + matchedRule.keyword + " matched message from " + cleanPhone);
    this.lastReplyTimestamps.set(remoteJid, now);

    for (let i = 0; i < matchedRule.responses.length; i++) {
      const resp = matchedRule.responses[i];
      if (!resp.text && !resp.mediaUrl) continue;

      const minD = Math.max(settings.minDelaySec || 0.8, 0.4);
      const maxD = Math.max(settings.maxDelaySec || 2.2, minD);
      const delayMs = Math.round((minD + Math.random() * (maxD - minD)) * 1000);

      const socket = (this.baileysService as any).sessions?.get(instanceId) || this.baileysService.getSessionSocket(instanceId);
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
        .replace(/\{\{city\}\}/gi, "Main Clinic")
        .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"));

      replyText = this.resolveSpintax(replyText);

      try {
        if (socket && !resp.mediaUrl) {
          await socket.sendMessage(remoteJid, { text: replyText });
          this.logger.log("[AutoReply Sent] Dispatched direct reply to " + remoteJid);
        } else {
          await this.baileysService.sendTextMessage(instanceId, cleanPhone, replyText, resp.mediaUrl, orgId);
          this.logger.log("[AutoReply Sent] Dispatched reply to " + cleanPhone);
        }
      } catch (sendErr: any) {
        this.logger.error("Failed to send auto-reply to " + remoteJid + ": " + sendErr.message);
      }
    }
  }

  getSettings(orgId: string, instanceId?: string): AutoReplySettings {
    const key = orgId + "_" + (instanceId || "ALL");
    const existing = this.settingsStore.get(key);
    if (existing) return existing;
    const def: AutoReplySettings = {
      organizationId: orgId,
      instanceId: instanceId || "ALL",
      botEngineEnabled: true,
      minDelaySec: 0.8,
      maxDelaySec: 2.2,
      friendlyNumbers: [],
      updatedAt: new Date(),
    };
    this.settingsStore.set(key, def);
    return def;
  }

  updateSettings(orgId: string, instanceId: string, payload: Partial<AutoReplySettings>): AutoReplySettings {
    const current = this.getSettings(orgId, instanceId);
    const updated: AutoReplySettings = {
      ...current,
      botEngineEnabled: payload.botEngineEnabled !== undefined ? payload.botEngineEnabled : current.botEngineEnabled,
      minDelaySec: payload.minDelaySec !== undefined ? Number(payload.minDelaySec) : current.minDelaySec,
      maxDelaySec: payload.maxDelaySec !== undefined ? Number(payload.maxDelaySec) : current.maxDelaySec,
      friendlyNumbers: payload.friendlyNumbers || current.friendlyNumbers,
      updatedAt: new Date(),
    };
    const key = orgId + "_" + (instanceId || "ALL");
    this.settingsStore.set(key, updated);
    this.saveToDisk();

    // Persist to PostgreSQL
    this.db.sql`
      INSERT INTO auto_reply_settings (id, organization_id, instance_id, bot_engine_enabled, min_delay_sec, max_delay_sec, friendly_numbers, updated_at)
      VALUES (${key}, ${orgId}, ${instanceId || 'ALL'}, ${updated.botEngineEnabled}, ${updated.minDelaySec}, ${updated.maxDelaySec}, ${JSON.stringify(updated.friendlyNumbers)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        bot_engine_enabled = EXCLUDED.bot_engine_enabled,
        min_delay_sec = EXCLUDED.min_delay_sec,
        max_delay_sec = EXCLUDED.max_delay_sec,
        friendly_numbers = EXCLUDED.friendly_numbers,
        updated_at = NOW()
    `.catch((err: any) => this.logger.warn(`Failed to persist settings to DB: ${err.message}`));

    return updated;
  }

  getRules(orgId: string, instanceId?: string): AutoReplyRule[] {
    return Array.from(this.rulesStore.values()).filter(
      (r) => r.organizationId === orgId && (!instanceId || instanceId === "ALL" || !r.instanceId || r.instanceId === "ALL" || r.instanceId === instanceId)
    );
  }

  createRule(orgId: string, ruleDto: any): AutoReplyRule {
    const newRule: AutoReplyRule = {
      id: "rule_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      organizationId: orgId || "org-demo",
      instanceId: ruleDto.instanceId || "ALL",
      matchType: ruleDto.matchType || "Contains",
      keyword: (ruleDto.keyword || "").trim(),
      responses: ruleDto.responses && ruleDto.responses.length > 0 ? ruleDto.responses : [{ type: "Text", text: "Thank you for reaching out!" }],
      enabled: ruleDto.enabled !== undefined ? ruleDto.enabled : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rulesStore.set(newRule.id, newRule);
    this.saveToDisk();

    // Persist to PostgreSQL
    this.db.sql`
      INSERT INTO auto_reply_rules (id, organization_id, instance_id, match_type, keyword, responses, enabled, created_at, updated_at)
      VALUES (${newRule.id}, ${newRule.organizationId}, ${newRule.instanceId || 'ALL'}, ${newRule.matchType}, ${newRule.keyword}, ${JSON.stringify(newRule.responses)}::jsonb, ${newRule.enabled}, NOW(), NOW())
    `.catch((err: any) => this.logger.warn(`Failed to insert rule to DB: ${err.message}`));

    return newRule;
  }

  updateRule(id: string, orgId: string, ruleDto: any): AutoReplyRule {
    const existing = this.rulesStore.get(id);
    if (!existing) throw new Error("Rule not found.");
    const updated: AutoReplyRule = { ...existing, ...ruleDto, updatedAt: new Date() };
    this.rulesStore.set(id, updated);
    this.saveToDisk();

    // Persist to PostgreSQL
    this.db.sql`
      UPDATE auto_reply_rules 
      SET keyword = COALESCE(${updated.keyword || null}, keyword),
          match_type = COALESCE(${updated.matchType || null}, match_type),
          responses = ${JSON.stringify(updated.responses)}::jsonb,
          enabled = ${updated.enabled},
          instance_id = ${updated.instanceId || 'ALL'},
          updated_at = NOW()
      WHERE id = ${id} AND organization_id = ${orgId}
    `.catch((err: any) => this.logger.warn(`Failed to update rule in DB: ${err.message}`));

    return updated;
  }

  deleteRule(id: string, orgId: string): boolean {
    const deleted = this.rulesStore.delete(id);
    if (deleted) {
      this.saveToDisk();
      this.db.sql`
        DELETE FROM auto_reply_rules WHERE id = ${id} AND organization_id = ${orgId}
      `.catch((err: any) => this.logger.warn(`Failed to delete rule from DB: ${err.message}`));
    }
    return deleted;
  }

  addFriendlyNumber(orgId: string, instanceId: string, phone: string): string[] {
    const settings = this.getSettings(orgId, instanceId);
    const clean = phone.trim();
    if (clean && !settings.friendlyNumbers.includes(clean)) {
      settings.friendlyNumbers.push(clean);
      this.updateSettings(orgId, instanceId, { friendlyNumbers: settings.friendlyNumbers });
    }
    return settings.friendlyNumbers;
  }

  removeFriendlyNumber(orgId: string, instanceId: string, phone: string): string[] {
    const settings = this.getSettings(orgId, instanceId);
    settings.friendlyNumbers = settings.friendlyNumbers.filter((p) => p !== phone);
    this.updateSettings(orgId, instanceId, { friendlyNumbers: settings.friendlyNumbers });
    return settings.friendlyNumbers;
  }
}