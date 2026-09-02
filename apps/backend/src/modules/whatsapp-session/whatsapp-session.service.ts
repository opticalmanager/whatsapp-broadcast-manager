import { Injectable, Logger, OnModuleDestroy, OnModuleInit, BadRequestException } from "@nestjs/common";
import makeWASocket, {
  WASocket,
  DisconnectReason,
  ConnectionState,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent,
  decryptPollVote,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode";
import pino from "pino";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { BroadcastGateway } from "./whatsapp.gateway";
import { DatabaseService } from "../../database/database.service";

export interface LiveSessionStatus {
  numberId: string;
  phoneNumber: string | null;
  displayName: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING" | "GENERATING_QR";
  connectedAt: number | null;
  instanceName?: string;
  qrBase64?: string;
  notes?: string;
}

export interface InstanceRecord {
  id: string;
  instanceName: string;
  organizationId: string;
  phoneNumber: string | null;
  displayName: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING" | "GENERATING_QR";
  qrBase64?: string;
  connectedAt: Date | null;
  lastActiveAt: Date | null;
  notes?: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  accountMaturityType?: "FRESH" | "MATURED";
  warmupStartedAt?: Date | null;
  currentWarmupDay?: number;
  warmupWeek?: number;
  dailySentToday?: number;
  dailyLimit?: number;
}

export interface IncomingResponseEvent {
  instanceId: string;
  orgId: string;
  remoteJid: string;
  resolvedPhone?: string;
  pushName?: string;
  type: "TEXT" | "BUTTON" | "LIST" | "POLL_VOTE";
  value: string;
  buttonId?: string;
  buttonTitle?: string;
  listId?: string;
  listTitle?: string;
  pollVote?: string;
  quotedMsgId?: string;
  rawMessageId?: string;
  timestamp: Date;
}

export interface TrackedPoll {
  pollMsgId: string;
  pollCreatorJid: string;
  pollEncKey: Buffer | Uint8Array;
  options: string[];
  createdAt: Date;
}

@Injectable()
export class WhatsAppSessionManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppSessionManagerService.name);
  private sessions: Map<string, WASocket> = new Map();
  private sessionStates: Map<string, "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING" | "GENERATING_QR"> = new Map();
  private sessionConnectedTimes: Map<string, number> = new Map();
  private lastQrCache: Map<string, string> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private keepAliveTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private onConnectedCallbacks: Array<(numberId: string) => void> = [];
  private messageReceiptCallbacks: Array<(msgId: string, remoteJid: string, status: number) => void> = [];
  public incomingMessageCallbacks: Array<(instanceId: string, orgId: string, remoteJid: string, text: string, pushName?: string) => void> = [];
  public incomingResponseCallbacks: Array<(event: IncomingResponseEvent) => void> = [];
  public pollTrackers: Map<string, TrackedPoll> = new Map();
  public lidToPhoneMap: Map<string, string> = new Map();

  public onIncomingMessage(cb: (instanceId: string, orgId: string, remoteJid: string, text: string, pushName?: string) => void) {
    this.incomingMessageCallbacks.push(cb);
  }

  public addOnIncomingResponseListener(cb: (event: IncomingResponseEvent) => void) {
    this.incomingResponseCallbacks.push(cb);
  }

  private cachedVersion: [number, number, number] = [2, 3000, 1043857760];
  private lastVersionFetch = 0;

  async getLatestVersion(): Promise<[number, number, number]> {
    if (Date.now() - this.lastVersionFetch > 86400000) {
      try {
        const { version } = await fetchLatestBaileysVersion();
        if (version && Array.isArray(version)) {
          this.cachedVersion = version as [number, number, number];
          this.lastVersionFetch = Date.now();
        }
      } catch {
        // Keep resilient fallback version
      }
    }
    return this.cachedVersion;
  }

  constructor(
    private readonly gateway: BroadcastGateway,
    private readonly db: DatabaseService
  ) {}

  addOnConnectedListener(cb: (numberId: string) => void) {
    this.onConnectedCallbacks.push(cb);
  }

  addOnMessageReceiptListener(cb: (msgId: string, remoteJid: string, status: number) => void) {
    this.messageReceiptCallbacks.push(cb);
  }

  async onModuleInit() {
    setImmediate(async () => {
      this.logger.log("Checking for persistent WhatsApp sessions in Supabase database...");

      try {
        const dbSessions = await this.db.sql`
          SELECT id, organization_id, phone_number, display_name, status, auth_dir_key, instance_name, auth_creds_json 
          FROM whatsapp_sessions 
          WHERE status != 'LOGGED_OUT'
        `;

        for (const sess of dbSessions || []) {
          const authFolder = sess.auth_dir_key || this.getAuthFolderPath(sess.id, sess.organization_id);
          const credsPath = path.join(authFolder, "creds.json");

          // If creds.json is missing or corrupted on disk, restore from Supabase PostgreSQL backup
          if (sess.auth_creds_json) {
            try {
              let needsRestore = true;
              if (fs.existsSync(credsPath)) {
                try {
                  const existing = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
                  if (existing && existing.me?.id) needsRestore = false;
                } catch {
                  needsRestore = true;
                }
              }
              if (needsRestore) {
                if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });
                fs.writeFileSync(credsPath, sess.auth_creds_json, "utf-8");
                this.logger.log(`Restored creds.json for session ${sess.id} from Supabase PostgreSQL cloud backup.`);
              }
            } catch (restoreErr: any) {
              this.logger.warn(`Failed to restore creds from DB for ${sess.id}: ${restoreErr.message}`);
            }
          }

          if (fs.existsSync(credsPath)) {
            try {
              const fileContent = fs.readFileSync(credsPath, "utf-8");
              const creds = JSON.parse(fileContent);
              // ONLY auto-connect instances that were previously paired with WhatsApp!
              if (creds && (creds.registered || creds.me?.id)) {
                this.logger.log(`Auto-restoring paired persistent instance ${sess.id} (${sess.instance_name || 'Main'}) for Org: ${sess.organization_id}...`);
                this.initSession(sess.id, sess.organization_id, "shop-main", false).catch((err) => {
                  this.logger.error(`Failed to auto-restore session ${sess.id}: ${err.message}`);
                });
              } else {
                this.logger.log(`Instance ${sess.id} is unlinked. Awaiting on-demand pairing.`);
              }
            } catch {
              this.logger.warn(`Skipping unreadable creds.json for ${sess.id}`);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Database session scan warning: ${err.message}. Checking local directory...`);
      }

      // Fallback scan local auth directory for paired instances only
      const baseDir = this.getAuthBaseDir();
      if (fs.existsSync(baseDir)) {
        try {
          const scanDir = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                const credsPath = path.join(fullPath, "creds.json");
                if (fs.existsSync(credsPath)) {
                  try {
                    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
                    if (creds && (creds.registered || creds.me?.id)) {
                      const rel = path.relative(baseDir, fullPath).replace(/\\/g, "/");
                      const parts = rel.split("/");
                      let orgId = "org-demo";
                      let instanceId = entry.name;
                      if (parts.length >= 2) {
                        orgId = parts[0];
                        instanceId = parts[1];
                      }
                      if (!this.sessions.has(instanceId)) {
                        this.logger.log(`Auto-restoring paired session from disk: ${instanceId} (Org: ${orgId})...`);
                        this.initSession(instanceId, orgId, "shop-main", false).catch((err) => {
                          this.logger.warn(`Failed to auto-restore ${instanceId}: ${err.message}`);
                        });
                      }
                    }
                  } catch {
                    // Corrupted creds file, skip
                  }
                } else {
                  scanDir(fullPath);
                }
              }
            }
          };
          scanDir(baseDir);
        } catch (scanErr: any) {
          this.logger.warn(`Auth dir scan error: ${scanErr.message}`);
        }
      }
    });
  }

  onModuleDestroy() {
    for (const timer of this.keepAliveTimers.values()) clearInterval(timer);
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.keepAliveTimers.clear();
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();

    for (const [_id, socket] of this.sessions.entries()) {
      try { socket.end(undefined); } catch {}
    }
    this.sessions.clear();
    this.sessionStates.clear();
    this.lastQrCache.clear();
  }

  public getAuthBaseDir(): string {
    if (process.env.AUTH_STORAGE_DIR) {
      try {
        const customDir = path.resolve(process.env.AUTH_STORAGE_DIR);
        if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
        return customDir;
      } catch (err: any) {
        this.logger.warn(`Could not use AUTH_STORAGE_DIR (${process.env.AUTH_STORAGE_DIR}): ${err.message}. Falling back to local data directory.`);
      }
    }
    const legacyDir = path.join(process.cwd(), "baileys_auth_sessions");
    if (fs.existsSync(legacyDir)) {
      return legacyDir;
    }
    const standardDir = path.join(process.cwd(), ".data", "sessions");
    try {
      if (!fs.existsSync(standardDir)) fs.mkdirSync(standardDir, { recursive: true });
    } catch {}
    return standardDir;
  }

  private getAuthFolderPath(numberId: string, orgId?: string): string {
    const baseDir = this.getAuthBaseDir();
    const folder = orgId && orgId !== "org-demo" ? path.join(baseDir, orgId, numberId) : path.join(baseDir, numberId);
    try {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    } catch (err: any) {
      this.logger.warn(`Could not create session folder ${folder}: ${err.message}`);
    }
    return folder;
  }



  async getInstances(orgId: string): Promise<InstanceRecord[]> {
    let rows: any[] = [];
    try {
      rows = await this.db.sql`
        SELECT * FROM whatsapp_sessions 
        WHERE organization_id = ${orgId || 'org-demo'} 
        ORDER BY created_at ASC
      `;
    } catch (err: any) {
      this.logger.warn(`Error fetching instances: ${err.message}`);
    }

    if (!rows || rows.length === 0) {
      // If no instance exists in DB yet, create a default primary instance
      const defaultId = `inst-${(orgId || "org-demo").slice(0, 8)}`;
      return [{
        id: defaultId,
        instanceName: "Main Marketing Outlet",
        organizationId: orgId || "org-demo",
        phoneNumber: null,
        displayName: "WhatsApp Outlet",
        status: this.sessionStates.get(defaultId) || (this.lastQrCache.has(defaultId) ? "GENERATING_QR" : "DISCONNECTED"),
        qrBase64: this.lastQrCache.get(defaultId),
        connectedAt: null,
        lastActiveAt: null,
        notes: "Primary broadcast sender",
      }];
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    return rows.map((r) => {
      const liveState = this.sessionStates.get(r.id);
      const cachedQr = this.lastQrCache.get(r.id);
      const socket = this.sessions.get(r.id);

      let effectiveStatus = r.status;
      if (liveState === "CONNECTED" && socket?.user?.id) {
        effectiveStatus = "CONNECTED";
      } else if (cachedQr) {
        effectiveStatus = "GENERATING_QR";
      } else if (liveState === "INITIALIZING") {
        effectiveStatus = "INITIALIZING";
      }

      // Warmup Calculations
      const maturityType = (r.account_maturity_type || "MATURED") as "FRESH" | "MATURED";
      const warmupStarted = r.warmup_started_at ? new Date(r.warmup_started_at) : new Date(r.created_at || Date.now());
      const daysPassed = Math.max(1, Math.floor((Date.now() - warmupStarted.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const warmupWeek = Math.min(4, Math.ceil(daysPassed / 7));

      // Calculate daily limits (Fresh: 50 -> 150 -> 300 -> 500; Matured: 500 msgs/day)
      let dailyLimit = 500;
      if (maturityType === "FRESH") {
        if (warmupWeek === 1) dailyLimit = 50;
        else if (warmupWeek === 2) dailyLimit = 150;
        else if (warmupWeek === 3) dailyLimit = 300;
        else dailyLimit = 500;
      } else {
        dailyLimit = 500;
      }

      // Daily sent count (auto-reset if last_sent_date is not today)
      const dailySent = r.last_sent_date === todayStr ? (Number(r.daily_sent_count) || 0) : 0;

      return {
        id: r.id,
        instanceName: r.instance_name || "WhatsApp Instance",
        organizationId: r.organization_id,
        phoneNumber: r.phone_number,
        displayName: r.display_name || "Store WhatsApp Outlet",
        status: effectiveStatus,
        qrBase64: (effectiveStatus !== "CONNECTED" && cachedQr) ? cachedQr : undefined,
        connectedAt: r.connected_at ? new Date(r.connected_at) : null,
        lastActiveAt: r.last_active_at ? new Date(r.last_active_at) : null,
        notes: r.notes || "",
        minDelaySeconds: r.min_delay_seconds != null ? Number(r.min_delay_seconds) : 5,
        maxDelaySeconds: r.max_delay_seconds != null ? Number(r.max_delay_seconds) : 30,
        accountMaturityType: maturityType,
        warmupStartedAt: warmupStarted,
        currentWarmupDay: daysPassed,
        warmupWeek,
        dailySentToday: dailySent,
        dailyLimit,
      };
    });
  }

  async createInstance(
    orgId: string,
    instanceName?: string,
    notes?: string,
    accountMaturityType: "FRESH" | "MATURED" = "MATURED"
  ): Promise<InstanceRecord> {
    const instanceId = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const name = instanceName?.trim() || `WhatsApp Sender ${Date.now().toString().slice(-4)}`;
    const authFolder = this.getAuthFolderPath(instanceId, orgId);

    try {
      await this.db.sql`
        INSERT INTO whatsapp_sessions (
          id, organization_id, instance_name, status, auth_dir_key, notes, min_delay_seconds, max_delay_seconds,
          account_maturity_type, warmup_started_at, daily_sent_count, last_sent_date, created_at, updated_at
        ) VALUES (
          ${instanceId}, ${orgId || 'org-demo'}, ${name}, 'INITIALIZING', ${authFolder}, ${notes || ''}, 5, 30,
          ${accountMaturityType}, NOW(), 0, '', NOW(), NOW()
        )
      `;
      this.logger.log(`Created new ${accountMaturityType} instance ${instanceId} (${name}) in Supabase.`);
    } catch (err: any) {
      this.logger.warn(`Failed to create instance in Supabase: ${err.message}`);
    }

    // Immediately start pairing socket
    this.initSession(instanceId, orgId || "org-demo", "shop-main", true).catch((err) => {
      this.logger.error(`Failed to initialize instance socket ${instanceId}: ${err.message}`);
    });

    return {
      id: instanceId,
      instanceName: name,
      organizationId: orgId || "org-demo",
      phoneNumber: null,
      displayName: null,
      status: "INITIALIZING",
      connectedAt: null,
      lastActiveAt: null,
      notes: notes || "",
      minDelaySeconds: 5,
      maxDelaySeconds: 30,
      accountMaturityType,
      warmupStartedAt: new Date(),
      currentWarmupDay: 1,
      warmupWeek: 1,
      dailySentToday: 0,
      dailyLimit: accountMaturityType === "FRESH" ? 50 : 500,
    };
  }

  async updateInstance(
    instanceId: string,
    orgId: string,
    payload: { instanceName?: string; notes?: string; accountMaturityType?: "FRESH" | "MATURED" }
  ): Promise<boolean> {
    try {
      await this.db.sql`
        UPDATE whatsapp_sessions 
        SET instance_name = COALESCE(${payload.instanceName || null}, instance_name),
            notes = COALESCE(${payload.notes || null}, notes),
            account_maturity_type = COALESCE(${payload.accountMaturityType || null}, account_maturity_type),
            updated_at = NOW()
        WHERE id = ${instanceId} AND organization_id = ${orgId || 'org-demo'}
      `;
      return true;
    } catch {
      return false;
    }
  }

  async recordInstanceMessageSent(instanceId: string): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      await this.db.sql`
        UPDATE whatsapp_sessions
        SET daily_sent_count = CASE WHEN last_sent_date = ${todayStr} THEN daily_sent_count + 1 ELSE 1 END,
            last_sent_date = ${todayStr},
            last_active_at = NOW(),
            updated_at = NOW()
        WHERE id = ${instanceId}
      `;
    } catch (err: any) {
      this.logger.warn(`Failed to record message send count for ${instanceId}: ${err.message}`);
    }
  }

  async updateDelaySettings(
    instanceId: string,
    orgId: string,
    minDelaySeconds: number,
    maxDelaySeconds: number
  ): Promise<{ minDelaySeconds: number; maxDelaySeconds: number }> {
    const minDelay = Math.max(1, Math.min(Number(minDelaySeconds) || 5, 300));
    const maxDelay = Math.max(minDelay, Math.min(Number(maxDelaySeconds) || 30, 300));

    try {
      await this.db.sql`
        UPDATE whatsapp_sessions 
        SET min_delay_seconds = ${minDelay},
            max_delay_seconds = ${maxDelay},
            updated_at = NOW()
        WHERE id = ${instanceId} AND (organization_id = ${orgId || 'org-demo'} OR organization_id = 'org-demo')
      `;
      this.logger.log(`Updated anti-ban delay settings for ${instanceId}: ${minDelay}s - ${maxDelay}s`);
    } catch (err: any) {
      this.logger.warn(`Failed to update delay settings for ${instanceId}: ${err.message}`);
    }

    return { minDelaySeconds: minDelay, maxDelaySeconds: maxDelay };
  }

  async getInstanceDelaySettings(
    instanceId: string,
    orgId: string
  ): Promise<{ minDelaySeconds: number; maxDelaySeconds: number }> {
    try {
      const rows = await this.db.sql`
        SELECT min_delay_seconds, max_delay_seconds 
        FROM whatsapp_sessions 
        WHERE id = ${instanceId} 
        LIMIT 1
      `;
      if (rows && rows.length > 0) {
        return {
          minDelaySeconds: rows[0].min_delay_seconds != null ? Number(rows[0].min_delay_seconds) : 5,
          maxDelaySeconds: rows[0].max_delay_seconds != null ? Number(rows[0].max_delay_seconds) : 30,
        };
      }
    } catch {}

    return { minDelaySeconds: 5, maxDelaySeconds: 30 };
  }

  async deleteInstance(instanceId: string, orgId: string): Promise<boolean> {
    await this.logoutSession(instanceId, orgId, "shop-main");

    try {
      await this.db.sql`
        DELETE FROM whatsapp_sessions 
        WHERE id = ${instanceId} AND organization_id = ${orgId || 'org-demo'}
      `;
      this.logger.log(`Deleted instance ${instanceId} from Supabase.`);
      return true;
    } catch {
      return false;
    }
  }

  getConnectedInstances(orgId: string): string[] {
    const active: string[] = [];
    for (const [id, socket] of this.sessions.entries()) {
      if (socket?.user?.id && this.sessionStates.get(id) === "CONNECTED") {
        active.push(id);
      }
    }
    return active;
  }

  getSessionStatus(numberId?: string): LiveSessionStatus {
    let resolvedId = numberId || "default";

    // 1. Try exact requested instance ID
    if (numberId && this.sessionStates.get(numberId) === "CONNECTED") {
      const socket = this.sessions.get(numberId);
      if (socket?.user?.id) {
        const rawNum = socket.user.id.split("@")[0].split(":")[0];
        const formattedNum = rawNum ? (rawNum.startsWith("+") ? rawNum : `+${rawNum}`) : null;
        return {
          numberId,
          phoneNumber: formattedNum,
          displayName: socket.user.name || "Shop Main",
          status: "CONNECTED",
          connectedAt: this.sessionConnectedTimes.get(numberId) || Date.now(),
        };
      }
    }

    // 2. Try any active CONNECTED instance
    for (const [id, state] of this.sessionStates.entries()) {
      if (state === "CONNECTED") {
        const socket = this.sessions.get(id);
        if (socket?.user?.id) {
          const rawNum = socket.user.id.split("@")[0].split(":")[0];
          const formattedNum = rawNum ? (rawNum.startsWith("+") ? rawNum : `+${rawNum}`) : null;
          return {
            numberId: id,
            phoneNumber: formattedNum,
            displayName: socket.user.name || "Shop Main",
            status: "CONNECTED",
            connectedAt: this.sessionConnectedTimes.get(id) || Date.now(),
          };
        }
      }
    }

    // 3. Generating QR
    for (const [id, qr] of this.lastQrCache.entries()) {
      return {
        numberId: id,
        phoneNumber: null,
        displayName: null,
        status: "GENERATING_QR",
        qrBase64: qr,
        connectedAt: null,
      };
    }

    return {
      numberId: resolvedId,
      phoneNumber: null,
      displayName: null,
      status: "DISCONNECTED",
      connectedAt: null,
    };
  }

  normalizeWhatsAppJid(rawPhone: string): string {
    const clean = rawPhone.replace(/\D/g, "");
    if (!clean || clean.length < 10) {
      throw new BadRequestException(`Invalid recipient phone number format: "${rawPhone}". Must have at least 10 digits.`);
    }

    // Detect incomplete Indian mobile numbers (e.g. 91 followed by only 9 digits)
    if (clean.startsWith("91") && clean.length === 11) {
      throw new BadRequestException(`Invalid phone number: "${rawPhone}" has only 9 digits after country code 91.`);
    }

    if (clean.length === 10) return `91${clean}@s.whatsapp.net`;
    if (clean.length === 11 && clean.startsWith("0")) return `91${clean.slice(1)}@s.whatsapp.net`;
    if (clean.length === 12 && clean.startsWith("91")) return `${clean}@s.whatsapp.net`;
    return `${clean}@s.whatsapp.net`;
  }

  async sendBroadcastMessage(opts: {
    numberId?: string | null;
    recipientPhoneNumber: string;
    text?: string;
    mediaUrl?: string;
    messageType?: string;
    pollData?: {
      question?: string;
      options?: string[];
      multiple?: boolean;
    };
    actionButtons?: Array<{
      id: string;
      type: "CALL" | "URL" | "QUICK_REPLY" | "COPY_CODE";
      displayText: string;
      value: string;
    }>;
    menuData?: {
      buttonText?: string;
      sectionTitle?: string;
      items?: Array<{ id: string; title: string; description?: string }>;
    };
    textWithMediaMode?: "caption" | "separate";
  }): Promise<{ success: boolean; messageId: string }> {
    const socket = this.getSessionSocket(opts.numberId || undefined);

    if (!socket || !socket.user?.id) {
      throw new BadRequestException("WhatsApp outlet device is not connected. Please pair device first in Settings.");
    }

    const clean = (opts.recipientPhoneNumber || "").replace(/\D/g, "");
    if (!clean || clean.length < 10) {
      throw new BadRequestException(`Invalid recipient phone number format: "${opts.recipientPhoneNumber}". Must have at least 10 digits.`);
    }

    const recipientJid = this.normalizeWhatsAppJid(opts.recipientPhoneNumber);
    this.logger.log(`Checking WhatsApp registration for ${recipientJid}...`);

    let targetJid = recipientJid;
    try {
      const results = await Promise.race([
        socket.onWhatsApp(recipientJid),
        new Promise<any>((resolve) => setTimeout(() => resolve(null), 2500))
      ]);
      if (Array.isArray(results) && results.length > 0 && results[0]?.exists && results[0]?.jid) {
        targetJid = results[0].jid;
        this.logger.log(`Verified WhatsApp recipient: ${targetJid}`);
      }
    } catch (waErr: any) {
      this.logger.warn(`onWhatsApp check warning: ${waErr.message}`);
    }

    try {
      await socket.sendPresenceUpdate("composing", targetJid);
      await new Promise((r) => setTimeout(r, 600));
      await socket.sendPresenceUpdate("paused", targetJid);
    } catch {}

    const textToSend = opts.text || "";
    const isPoll = !!(opts.pollData && opts.pollData.options && opts.pollData.options.length > 0) || opts.messageType?.toLowerCase().includes("poll");
    const isButton = !!(opts.actionButtons && opts.actionButtons.length > 0) || opts.messageType?.toLowerCase().includes("button");
    const isMenu = !!(opts.menuData && opts.menuData.items && opts.menuData.items.length > 0) || opts.messageType?.toLowerCase().includes("list") || opts.messageType?.toLowerCase().includes("menu");

    this.logger.log(`Sending live Baileys broadcast (Type: ${opts.messageType || 'Text'}, Poll: ${isPoll}, Buttons: ${isButton}, Menu: ${isMenu}) to ${targetJid}...`);

    let result: any;

    // Helper: Send Media (Intelligent MIME & Format Detection)
    const sendMedia = async (captionText?: string) => {
      if (!opts.mediaUrl || !opts.mediaUrl.trim()) return null;
      const mediaUrl = opts.mediaUrl.trim();

      // 1. Data URI (Base64)
      if (mediaUrl.startsWith("data:")) {
        const match = mediaUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
        if (match) {
          const mimeType = match[1].toLowerCase();
          const buffer = Buffer.from(match[2], "base64");
          if (mimeType.startsWith("image/")) {
            return await socket.sendMessage(targetJid, { image: buffer, caption: captionText });
          } else if (mimeType.startsWith("video/")) {
            return await socket.sendMessage(targetJid, { video: buffer, caption: captionText });
          } else if (mimeType.startsWith("audio/")) {
            return await socket.sendMessage(targetJid, { audio: buffer, mimetype: mimeType });
          } else {
            const fileName = mimeType.includes("pdf") ? "document.pdf" : "attachment";
            return await socket.sendMessage(targetJid, {
              document: buffer,
              mimetype: mimeType,
              fileName,
              caption: captionText,
            });
          }
        }
      }

      // 2. Remote HTTP / HTTPS Public URL
      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        const urlLower = mediaUrl.toLowerCase();
        const msgTypeLower = (opts.messageType || "").toLowerCase();

        // Check if URL clearly contains image extensions anywhere (even with query params like ?w=800 or CDN hashes)
        let isImage = 
          /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff|avif)(\?|$|#)/i.test(urlLower) ||
          urlLower.includes("images.unsplash.com") ||
          urlLower.includes("picsum.photos") ||
          urlLower.includes("/image") ||
          urlLower.includes("cloudinary.com") ||
          msgTypeLower.includes("image") ||
          msgTypeLower === "media" ||
          msgTypeLower === "text with media";

        let isVideo = 
          /\.(mp4|3gp|mov|avi|mkv|webm)(\?|$|#)/i.test(urlLower) ||
          msgTypeLower.includes("video");

        let isAudio = 
          /\.(mp3|ogg|wav|m4a|aac)(\?|$|#)/i.test(urlLower) ||
          msgTypeLower.includes("audio");

        let isPdf = 
          /\.(pdf)(\?|$|#)/i.test(urlLower) ||
          msgTypeLower.includes("pdf") ||
          msgTypeLower.includes("document");

        // If still ambiguous, inspect headers via fast HEAD request
        let detectedMime: string | null = null;
        if (!isImage && !isVideo && !isAudio && !isPdf) {
          try {
            const headRes = await fetch(mediaUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
            const ct = headRes.headers.get("content-type")?.toLowerCase();
            if (ct) {
              detectedMime = ct;
              if (ct.startsWith("image/")) isImage = true;
              else if (ct.startsWith("video/")) isVideo = true;
              else if (ct.startsWith("audio/")) isAudio = true;
              else if (ct.includes("pdf")) isPdf = true;
            }
          } catch {}
        }

        // Default to Image if undecided (most marketing campaigns use images)
        if (!isImage && !isVideo && !isAudio && !isPdf) {
          isImage = true;
        }

        if (isImage) {
          this.logger.log(`Sending image message from URL: ${mediaUrl}`);
          return await socket.sendMessage(targetJid, { image: { url: mediaUrl }, caption: captionText });
        } else if (isVideo) {
          this.logger.log(`Sending video message from URL: ${mediaUrl}`);
          return await socket.sendMessage(targetJid, { video: { url: mediaUrl }, caption: captionText });
        } else if (isAudio) {
          this.logger.log(`Sending audio message from URL: ${mediaUrl}`);
          return await socket.sendMessage(targetJid, { audio: { url: mediaUrl }, mimetype: "audio/mp4" });
        } else {
          // Extract real filename from URL if possible
          let rawFileName = "document.pdf";
          try {
            const urlPath = new URL(mediaUrl).pathname;
            const baseName = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            if (baseName && baseName.includes('.')) {
              rawFileName = decodeURIComponent(baseName);
            }
          } catch {}

          this.logger.log(`Sending document attachment (${rawFileName}) from URL: ${mediaUrl}`);
          return await socket.sendMessage(targetJid, {
            document: { url: mediaUrl },
            mimetype: detectedMime || (isPdf ? "application/pdf" : "application/octet-stream"),
            fileName: rawFileName,
            caption: captionText,
          });
        }
      }
      return null;
    };

    // 1. POLL DISPATCH (Single Unified WhatsApp Poll Message)
    if (isPoll) {
      const pollQuestion = opts.pollData?.question?.trim() || "";
      const rawOptions = opts.pollData?.options && opts.pollData.options.length > 0 ? opts.pollData.options : ["Yes", "No"];
      const validOptions = rawOptions.filter((o) => o && o.trim() !== "");

      // Merge introductory text & poll question into one single unified poll title without separate messages
      let fullPollTitle = "";
      if (textToSend && textToSend.trim() !== "" && pollQuestion && textToSend.trim() !== pollQuestion) {
        fullPollTitle = `${textToSend.trim()}\n\n❓ ${pollQuestion}`;
      } else {
        fullPollTitle = pollQuestion || textToSend || "Please vote:";
      }

      if (opts.mediaUrl) {
        try { await sendMedia(fullPollTitle); } catch {}
      }

      result = await socket.sendMessage(targetJid, {
        poll: {
          name: fullPollTitle.slice(0, 255),
          values: validOptions.length >= 2 ? validOptions : ["Yes", "No"],
          selectableCount: opts.pollData?.multiple ? validOptions.length : 1,
        },
      });

      if (result?.key?.id) {
        const pollMsgId = result.key.id;
        const pollCreatorJid = (socket.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        const pollEncKey =
          (result.message as any)?.pollCreationMessage?.encKey ||
          (result.message as any)?.pollCreationMessageV2?.encKey ||
          (result.message as any)?.pollCreationMessageV3?.encKey ||
          (result.message as any)?.messageContextInfo?.messageSecret;

        if (pollEncKey) {
          this.pollTrackers.set(pollMsgId, {
            pollMsgId,
            pollCreatorJid,
            pollEncKey,
            options: validOptions.length >= 2 ? validOptions : ["Yes", "No"],
            createdAt: new Date(),
          });
          this.logger.log(`Tracked poll encryption key for msgId=${pollMsgId} with ${validOptions.length} options.`);
        }
      }
    }

    // 2. LEGACY BUTTONS / MENU FALLBACK DISPATCH (Safe Clean Text & Media Formatting)
    else if (isButton && opts.actionButtons && opts.actionButtons.length > 0) {
      let formattedText = (textToSend || "").trim();
      if (formattedText) formattedText += "\n\n";
      formattedText += "━━━━━━━━━━━━━━━━\n";
      opts.actionButtons.forEach((btn, idx) => {
        if (btn.type === "CALL") {
          const cleanPhone = btn.value.replace(/[^\d+]/g, "");
          formattedText += `📞 *${btn.displayText}*: tel:${cleanPhone}\n`;
        } else if (btn.type === "URL") {
          const link = btn.value.startsWith("http") ? btn.value : `https://${btn.value}`;
          formattedText += `🔗 *${btn.displayText}*: ${link}\n`;
        } else if (btn.type === "COPY_CODE") {
          formattedText += `🎟 *${btn.displayText}*: \`${btn.value}\`\n`;
        } else {
          formattedText += `${idx + 1}️⃣ Reply: *${btn.displayText}*\n`;
        }
      });
      formattedText += "━━━━━━━━━━━━━━━━";

      if (opts.mediaUrl) {
        result = await sendMedia(formattedText.trim());
      }
      if (!result) {
        result = await socket.sendMessage(targetJid, { text: formattedText.trim() });
      }
      this.logger.log(`Safe text formatted button-card dispatched to ${targetJid}`);
    }

    // 3. LEGACY LIST / MENU FALLBACK DISPATCH (Safe Numbered Text Menu)
    else if (isMenu && opts.menuData && opts.menuData.items && opts.menuData.items.length > 0) {
      let formattedMenu = (textToSend ? textToSend.trim() + "\n\n" : "");
      formattedMenu += `📋 *${opts.menuData.sectionTitle || "Available Options"}*\n`;
      formattedMenu += "━━━━━━━━━━━━━━━━\n";
      opts.menuData.items.forEach((item, idx) => {
        formattedMenu += `${idx + 1}️⃣ *${item.title}*\n`;
        if (item.description) {
          formattedMenu += `   _${item.description}_\n`;
        }
      });
      formattedMenu += "━━━━━━━━━━━━━━━━\n";
      formattedMenu += `_Reply with the number (e.g. 1) to select._`;

      if (opts.mediaUrl) {
        result = await sendMedia(formattedMenu.trim());
      }
      if (!result) {
        result = await socket.sendMessage(targetJid, { text: formattedMenu.trim() });
      }
      this.logger.log(`Safe numbered text menu dispatched to ${targetJid}`);
    }

    // 4. STANDARD TEXT / MEDIA
    else {
      if (opts.mediaUrl) {
        result = await sendMedia(textToSend);
      }
      if (!result) {
        result = await socket.sendMessage(targetJid, { text: textToSend || " " });
      }
    }

    const messageId = result?.key?.id || `msg-${Date.now()}`;
    this.logger.log(`Successfully dispatched Baileys message to ${targetJid}. Message ID: ${messageId}`);

    return {
      success: true,
      messageId,
    };
  }

  async sendTextMessage(
    numberId: string | null | undefined,
    recipientPhoneNumber: string,
    text: string,
    mediaUrl?: string
  ): Promise<{ success: boolean; messageId: string }> {
    return this.sendBroadcastMessage({
      numberId,
      recipientPhoneNumber,
      text,
      mediaUrl,
    });
  }

  getSessionSocket(numberId?: string): WASocket | null {
    if (numberId && this.sessions.has(numberId)) {
      const s = this.sessions.get(numberId)!;
      if (s.user?.id && this.sessionStates.get(numberId) === "CONNECTED") return s;
    }
    for (const [id, s] of this.sessions.entries()) {
      if (s && s.user?.id && this.sessionStates.get(id) === "CONNECTED") return s;
    }
    return null;
  }

  getActiveSessionNumberId(): string | null {
    for (const [id, s] of this.sessions.entries()) {
      if (s && s.user?.id && this.sessionStates.get(id) === "CONNECTED") {
        return id;
      }
    }
    for (const [id, s] of this.sessions.entries()) {
      if (s && s.user?.id) return id;
    }
    return null;
  }

  async waitForActiveSocket(numberId?: string, timeoutMs: number = 20000): Promise<WASocket | null> {
    const existing = this.getSessionSocket(numberId);
    if (existing) return existing;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 1000));
      const s = this.getSessionSocket(numberId);
      if (s) return s;
    }
    return null;
  }

  async waitForQrCode(numberId: string, timeoutMs = 6000): Promise<string | null> {
    if (this.lastQrCache.has(numberId)) {
      return this.lastQrCache.get(numberId)!;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.lastQrCache.has(numberId)) {
        return this.lastQrCache.get(numberId)!;
      }
      if (this.sessionStates.get(numberId) === "CONNECTED") {
        return null;
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return this.lastQrCache.get(numberId) || null;
  }

  async initSession(numberId: string, orgId: string, shopId: string, forceFresh = false): Promise<WASocket> {
    const authFolderPath = this.getAuthFolderPath(numberId, orgId);

    if (this.sessions.has(numberId)) {
      const existingSocket = this.sessions.get(numberId);
      const isConnected = existingSocket?.user?.id && this.sessionStates.get(numberId) === "CONNECTED";

      if (isConnected && !forceFresh) {
        this.logger.log(`Returning already connected active session for ${numberId}`);
        const userJid = existingSocket.user?.id || "";
        const rawNum = userJid.split("@")[0].split(":")[0];
        const phoneNumber = rawNum ? `+${rawNum}` : null;
        const displayName = existingSocket.user?.name || "Optical Store WhatsApp";
        this.gateway.emitSessionConnected(orgId, shopId, {
          numberId,
          phoneNumber: phoneNumber || "+91 98765 43210",
          displayName,
          status: "CONNECTED",
        });
        return existingSocket;
      }

      this.logger.log(`Cleaning previous in-memory session instance for ${numberId}...`);
      try {
        existingSocket?.end(undefined);
      } catch {}
      this.sessions.delete(numberId);
    }

    if (forceFresh && fs.existsSync(authFolderPath)) {
      this.logger.log(`Purging auth storage folder for fresh re-pairing request: ${authFolderPath}`);
      try {
        fs.rmSync(authFolderPath, { recursive: true, force: true });
      } catch (err: any) {
        this.logger.warn(`Failed to remove auth directory: ${err.message}`);
      }
      this.lastQrCache.delete(numberId);
      this.sessionConnectedTimes.delete(numberId);
    } else if (this.lastQrCache.has(numberId)) {
      const cachedQr = this.lastQrCache.get(numberId)!;
      this.gateway.emitQrCode(orgId, shopId, {
        numberId,
        qrBase64: cachedQr,
        status: "GENERATING_QR",
      });
    }

    const startTime = Date.now();
    this.logger.log(`[PERF] initSession START for numberId=${numberId} (forceFresh=${forceFresh})`);

    this.gateway.emitStatusChanged(orgId, shopId, {
      numberId,
      status: "INITIALIZING",
      reason: "Connecting to WhatsApp Multi-Device Noise Protocol...",
    });

    const { state, saveCreds } = await useMultiFileAuthState(authFolderPath);

    const version = await this.getLatestVersion();
    this.logger.log(`Using WhatsApp protocol version: ${version.join(".")}`);

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Chrome (Windows)", "Chrome", "124.0.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      qrTimeout: 60000,
    });

    socket.ev.on("creds.update", async () => {
      await saveCreds();
      if (state.creds?.me?.id || state.creds?.registered) {
        try {
          const credsJson = JSON.stringify(state.creds);
          await this.db.sql`
            UPDATE whatsapp_sessions 
            SET auth_creds_json = ${credsJson}, updated_at = NOW() 
            WHERE id = ${numberId}
          `;
        } catch {}
      }
    });

    socket.ev.on("connection.update", (update) => {
      this.handleConnectionUpdate(numberId, orgId, shopId, update);
    });

    socket.ev.on("messages.update", (updates: any[]) => {
      for (const item of updates) {
        const msgId = item.key?.id;
        const remoteJid = item.key?.remoteJid || "";
        const rawStatus = item.update?.status;
        let status: number | undefined;

        if (rawStatus === 4 || rawStatus === 5 || rawStatus === "READ" || rawStatus === "PLAYED") {
          status = 4;
        } else if (rawStatus === 3 || rawStatus === "DELIVERY_ACK" || rawStatus === "DELIVERED") {
          status = 3;
        } else if (rawStatus === 2 || rawStatus === "SERVER_ACK" || rawStatus === "SENT") {
          status = 2;
        }

        if (msgId && status !== undefined) {
          const statusStr = status === 4 ? 'READ' : (status === 3 ? 'DELIVERED' : 'SENT');
          this.db.sql`
            UPDATE chat_messages
            SET status = ${statusStr},
                read_at = CASE WHEN ${status === 4} THEN NOW() ELSE read_at END,
                delivered_at = CASE WHEN ${status >= 3} THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
            WHERE message_id = ${msgId} OR id = ${msgId}
          `.catch(() => {});

          this.messageReceiptCallbacks.forEach((cb) => {
            try {
              cb(msgId, remoteJid, status!);
            } catch {}
          });
        }

        // Handle poll updates embedded in message update
        const pollUpdates = item.update?.pollUpdates;
        if (pollUpdates && Array.isArray(pollUpdates)) {
          for (const pUpdate of pollUpdates) {
            const pollMsgId = pUpdate.pollCreationMessageKey?.id || msgId;
            const voterJid = pUpdate.voterJid || remoteJid;
            const tracked = pollMsgId ? this.pollTrackers.get(pollMsgId) : undefined;
            if (tracked && pUpdate.vote) {
              try {
                const decrypted = decryptPollVote(
                  {
                    encPayload: pUpdate.vote.encPayload,
                    encIv: pUpdate.vote.encIv,
                  },
                  {
                    pollCreatorJid: tracked.pollCreatorJid,
                    pollMsgId: tracked.pollMsgId,
                    pollEncKey: tracked.pollEncKey,
                    voterJid: voterJid.split(":")[0] + "@s.whatsapp.net",
                  }
                );

                const selectedOptionNames: string[] = [];
                for (const selHash of decrypted.selectedOptions || []) {
                  for (const optName of tracked.options) {
                    const optHash = crypto.createHash("sha256").update(Buffer.from(optName, "utf-8")).digest();
                    if (Buffer.compare(Buffer.from(selHash), optHash) === 0) {
                      selectedOptionNames.push(optName);
                    }
                  }
                }

                const chosenOption = selectedOptionNames.join(", ") || "Voted";
                this.logger.log(`Decrypted poll vote from ${voterJid}: "${chosenOption}" for poll ${pollMsgId}`);

                const event: IncomingResponseEvent = {
                  instanceId: numberId,
                  orgId,
                  remoteJid: voterJid,
                  pushName: "Customer",
                  type: "POLL_VOTE",
                  value: chosenOption,
                  pollVote: chosenOption,
                  quotedMsgId: pollMsgId,
                  rawMessageId: item.key?.id,
                  timestamp: new Date(),
                };

                this.incomingResponseCallbacks.forEach((cb) => {
                  try { cb(event); } catch {}
                });
              } catch (err: any) {
                this.logger.warn(`Failed to decrypt poll vote in messages.update: ${err.message}`);
              }
            }
          }
        }
      }
    });

    socket.ev.on("message-receipt.update", (receipts: any[]) => {
      for (const item of receipts) {
        const msgId = item.key?.id;
        const remoteJid = item.key?.remoteJid || "";
        const receipt = item.receipt;
        if (msgId && receipt) {
          const isRead = Boolean(receipt.readTimestamp || receipt.playedTimestamp || (receipt as any).read);
          const status = isRead ? 4 : (receipt.deliveryTimestamp ? 3 : 2);
          const statusStr = isRead ? 'READ' : (receipt.deliveryTimestamp ? 'DELIVERED' : 'SENT');

          this.db.sql`
            UPDATE chat_messages
            SET status = ${statusStr},
                read_at = CASE WHEN ${isRead} THEN NOW() ELSE read_at END,
                delivered_at = CASE WHEN ${status >= 3} THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
            WHERE message_id = ${msgId} OR id = ${msgId}
          `.catch(() => {});

          this.messageReceiptCallbacks.forEach((cb) => {
            try {
              cb(msgId, remoteJid, status);
            } catch {}
          });
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages }: any) => {
      for (const msg of messages || []) {
        if (!msg.key?.fromMe && msg.key?.remoteJid && !msg.key.remoteJid.includes("@g.us") && !msg.key.remoteJid.includes("@broadcast")) {
          const remoteJid = msg.key.remoteJid;
          const pushName = msg.pushName || "Customer";

          let responseType: "TEXT" | "BUTTON" | "LIST" | "POLL_VOTE" = "TEXT";
          let responseValue = "";
          let selectedButtonId: string | undefined = undefined;
          let selectedButtonTitle: string | undefined = undefined;
          let selectedListId: string | undefined = undefined;
          let selectedListTitle: string | undefined = undefined;
          let pollVote: string | undefined = undefined;
          let quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

          // 1. Native Flow Interactive Button / List Response
          if (msg.message?.interactiveResponseMessage) {
            const intResp = msg.message.interactiveResponseMessage;
            quotedMsgId = quotedMsgId || intResp.contextInfo?.stanzaId;
            if (intResp.nativeFlowResponseMessage?.paramsJson) {
              try {
                const params = JSON.parse(intResp.nativeFlowResponseMessage.paramsJson);
                selectedButtonId = params.id || "";
                selectedButtonTitle = params.title || intResp.body?.text || selectedButtonId;
                responseType = "BUTTON";
                responseValue = selectedButtonTitle || selectedButtonId || "Button Click";
              } catch {
                responseType = "BUTTON";
                responseValue = intResp.nativeFlowResponseMessage.paramsJson;
              }
            } else if (intResp.body?.text) {
              responseType = "BUTTON";
              responseValue = intResp.body.text;
              selectedButtonTitle = intResp.body.text;
            }
          }

          // 2. List Menu Response (singleSelectReply)
          else if (msg.message?.listResponseMessage?.singleSelectReply) {
            const listReply = msg.message.listResponseMessage.singleSelectReply;
            quotedMsgId = quotedMsgId || msg.message.listResponseMessage.contextInfo?.stanzaId;
            responseType = "LIST";
            selectedListId = listReply.selectedRowId || "";
            selectedListTitle = listReply.title || selectedListId;
            responseValue = `${selectedListTitle}${selectedListId ? ` (${selectedListId})` : ""}`;
          }

          // 3. Template / Quick Reply Button Response
          else if (msg.message?.templateButtonReplyMessage) {
            const tplReply = msg.message.templateButtonReplyMessage;
            quotedMsgId = quotedMsgId || tplReply.contextInfo?.stanzaId;
            responseType = "BUTTON";
            selectedButtonId = tplReply.selectedId || "";
            selectedButtonTitle = tplReply.selectedDisplayText || selectedButtonId;
            responseValue = selectedButtonTitle || selectedButtonId;
          }

          // 4. Legacy Buttons Response Message
          else if (msg.message?.buttonsResponseMessage) {
            const btnReply = msg.message.buttonsResponseMessage;
            quotedMsgId = quotedMsgId || btnReply.contextInfo?.stanzaId;
            responseType = "BUTTON";
            selectedButtonId = btnReply.selectedButtonId || "";
            selectedButtonTitle = btnReply.selectedDisplayText || selectedButtonId;
            responseValue = selectedButtonTitle || selectedButtonId;
          }

          // 5. Poll Vote Message (pollUpdateMessage)
          else if (msg.message?.pollUpdateMessage) {
            const pUpdate = msg.message.pollUpdateMessage;
            const pollMsgId = pUpdate.pollCreationMessageKey?.id;
            quotedMsgId = quotedMsgId || pollMsgId;
            const tracked = pollMsgId ? this.pollTrackers.get(pollMsgId) : undefined;
            if (tracked && pUpdate.vote) {
              try {
                const voterJid = msg.key.participant || remoteJid;
                const decrypted = decryptPollVote(
                  {
                    encPayload: pUpdate.vote.encPayload,
                    encIv: pUpdate.vote.encIv,
                  },
                  {
                    pollCreatorJid: tracked.pollCreatorJid,
                    pollMsgId: tracked.pollMsgId,
                    pollEncKey: tracked.pollEncKey,
                    voterJid: voterJid.split(":")[0] + "@s.whatsapp.net",
                  }
                );

                const selectedOptionNames: string[] = [];
                for (const selHash of decrypted.selectedOptions || []) {
                  for (const optName of tracked.options) {
                    const optHash = crypto.createHash("sha256").update(Buffer.from(optName, "utf-8")).digest();
                    if (Buffer.compare(Buffer.from(selHash), optHash) === 0) {
                      selectedOptionNames.push(optName);
                    }
                  }
                }

                pollVote = selectedOptionNames.join(", ") || "Voted";
                responseType = "POLL_VOTE";
                responseValue = pollVote;
                this.logger.log(`Decrypted poll vote: "${pollVote}" from ${remoteJid}`);
              } catch (err: any) {
                this.logger.warn(`Failed to decrypt pollUpdateMessage: ${err.message}`);
                responseType = "POLL_VOTE";
                responseValue = "Voted";
                pollVote = "Voted";
              }
            } else {
              responseType = "POLL_VOTE";
              responseValue = "Voted";
              pollVote = "Voted";
            }
          }

          // 6. Standard Text Conversation / Extended Text
          else {
            responseType = "TEXT";
            responseValue = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
          }

          // If a user replies to a specific broadcast, update read receipt
          if (quotedMsgId) {
            this.messageReceiptCallbacks.forEach((cb) => {
              try {
                cb(quotedMsgId, remoteJid, 4);
              } catch {}
            });
          }

          if (responseValue) {
            let rawClean = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, "");
            let cleanPhone = rawClean;
            let resolvedContactName = pushName || 'Customer';

            // 1. Direct phone if @s.whatsapp.net (10-13 digits)
            if (remoteJid.includes('@s.whatsapp.net') && rawClean.length >= 10 && rawClean.length <= 13) {
              cleanPhone = rawClean;
            } 
            // 2. Check in-memory LID cache
            else if (this.lidToPhoneMap.has(rawClean)) {
              cleanPhone = this.lidToPhoneMap.get(rawClean)!;
            } 
            // 3. Check alternate Baileys keys
            else {
              const altJid = (msg.key as any).participant || (msg.key as any).remoteJidAlt || (msg.key as any).participantPn || (msg as any).participant;
              if (altJid && typeof altJid === 'string' && !altJid.includes('@lid')) {
                const altClean = altJid.split('@')[0].split(':')[0].replace(/\D/g, "");
                if (altClean.length >= 10 && altClean.length <= 13) {
                  cleanPhone = altClean;
                  this.lidToPhoneMap.set(rawClean, cleanPhone);
                }
              }
            }

            // 4. Resolve real phone number from DB if remoteJid is still an LID or > 13 digits
            if (remoteJid.includes('@lid') || cleanPhone.length > 13) {
              let resolvedRealPhone: string | null = null;

              // A. Match by quoted message ID
              if (quotedMsgId) {
                try {
                  const matched = await this.db.sql`
                    SELECT phone, name FROM campaign_recipients WHERE message_id = ${quotedMsgId} LIMIT 1
                  `;
                  if (matched && matched.length > 0 && matched[0].phone) {
                    resolvedRealPhone = matched[0].phone.replace(/\D/g, "");
                    if (matched[0].name && !matched[0].name.startsWith('Recipient') && matched[0].name !== 'Customer') {
                      resolvedContactName = matched[0].name;
                    }
                  }
                } catch {}

                if (!resolvedRealPhone) {
                  try {
                    const matchedMsg = await this.db.sql`
                      SELECT phone, sender_name FROM chat_messages WHERE message_id = ${quotedMsgId} LIMIT 1
                    `;
                    if (matchedMsg && matchedMsg.length > 0 && matchedMsg[0].phone) {
                      resolvedRealPhone = matchedMsg[0].phone.replace(/\D/g, "");
                    }
                  } catch {}
                }
              }

              // B. Match by pushName in recent campaign recipients
              if (!resolvedRealPhone && pushName && pushName !== 'Customer' && pushName.length >= 3) {
                try {
                  const nameMatches = await this.db.sql`
                    SELECT phone, name FROM campaign_recipients 
                    WHERE name ILIKE ${pushName}
                      AND status IN ('SENT', 'DELIVERED', 'READ')
                    ORDER BY COALESCE(sent_at, created_at) DESC
                    LIMIT 1
                  `;
                  if (nameMatches && nameMatches.length > 0 && nameMatches[0].phone) {
                    resolvedRealPhone = nameMatches[0].phone.replace(/\D/g, "");
                  }
                } catch {}
              }

              // C. Match by recent broadcast sent from this instance (within last 48 hours)
              if (!resolvedRealPhone) {
                try {
                  const latestSent = await this.db.sql`
                    SELECT cr.phone, cr.name 
                    FROM campaign_recipients cr
                    JOIN campaigns c ON c.id = cr.campaign_id
                    WHERE (c.whatsapp_session_id = ${numberId} OR cr.organization_id = ${orgId} OR cr.organization_id = 'org-demo')
                      AND cr.status IN ('SENT', 'DELIVERED', 'READ')
                      AND (cr.sent_at >= NOW() - INTERVAL '48 hours' OR cr.created_at >= NOW() - INTERVAL '48 hours')
                    ORDER BY COALESCE(cr.sent_at, cr.created_at) DESC 
                    LIMIT 1
                  `;
                  if (latestSent && latestSent.length > 0 && latestSent[0].phone) {
                    resolvedRealPhone = latestSent[0].phone.replace(/\D/g, "");
                    if (latestSent[0].name && !latestSent[0].name.startsWith('Recipient')) {
                      resolvedContactName = latestSent[0].name;
                    }
                  }
                } catch {}
              }

              if (resolvedRealPhone && resolvedRealPhone.length >= 10 && resolvedRealPhone.length <= 13) {
                cleanPhone = resolvedRealPhone;
                this.lidToPhoneMap.set(rawClean, cleanPhone);
              } else if (cleanPhone.length > 13) {
                this.logger.warn(`Could not resolve WhatsApp LID message from ${remoteJid} to a phone number`);
              }
            }

            // Persist to Supabase Database
            try {
              let quotedContent: string | null = null;
              let quotedSender: string | null = null;
              const ctxInfo = msg.message?.extendedTextMessage?.contextInfo || 
                              msg.message?.interactiveResponseMessage?.contextInfo || 
                              msg.message?.templateButtonReplyMessage?.contextInfo ||
                              msg.message?.buttonsResponseMessage?.contextInfo;
              if (ctxInfo?.quotedMessage) {
                const qMsg = ctxInfo.quotedMessage;
                quotedContent = qMsg.conversation || 
                                qMsg.extendedTextMessage?.text || 
                                qMsg.imageMessage?.caption || 
                                qMsg.documentMessage?.caption || 
                                (qMsg.imageMessage ? "📷 Photo" : qMsg.documentMessage ? "📄 Document" : null);
                quotedSender = ctxInfo.participant ? (ctxInfo.participant.includes('@lid') ? "You" : `+${ctxInfo.participant.split('@')[0].replace(/\D/g, '')}`) : "You";
              }

              const conversationId = `conv_${orgId}_${cleanPhone.slice(-10)}`;
              const messageId = `msg_in_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

              // Insert message
              await this.db.sql`
                INSERT INTO chat_messages (
                  id, conversation_id, organization_id, instance_id, phone, message_id,
                  direction, sender_name, message_type, content, status,
                  quoted_message_id, quoted_content, quoted_sender,
                  sent_at, delivered_at, created_at
                ) VALUES (
                  ${messageId}, ${conversationId}, ${orgId}, ${numberId}, ${cleanPhone}, ${msg.key?.id || null},
                  'INCOMING', ${resolvedContactName}, ${responseType}, ${responseValue}, 'DELIVERED',
                  ${quotedMsgId || null}, ${quotedContent || null}, ${quotedSender || null},
                  NOW(), NOW(), NOW()
                )
              `;

              // Upsert conversation
              await this.db.sql`
                INSERT INTO chat_conversations (
                  id, organization_id, instance_id, phone, contact_name,
                  last_message, last_message_at, last_message_type, last_message_direction,
                  unread_count, status, created_at, updated_at
                ) VALUES (
                  ${conversationId}, ${orgId}, ${numberId}, ${cleanPhone}, ${resolvedContactName},
                  ${responseValue}, NOW(), ${responseType}, 'INCOMING',
                  1, 'AWAITING_REPLY', NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                  last_message = EXCLUDED.last_message,
                  last_message_at = NOW(),
                  last_message_type = EXCLUDED.last_message_type,
                  last_message_direction = 'INCOMING',
                  unread_count = chat_conversations.unread_count + 1,
                  status = 'AWAITING_REPLY',
                  contact_name = COALESCE(EXCLUDED.contact_name, chat_conversations.contact_name),
                  updated_at = NOW()
              `;

              // Broadcast live via WebSocket
              this.gateway.emitChatMessage(orgId, {
                id: messageId,
                conversationId,
                organizationId: orgId,
                instanceId: numberId,
                phone: cleanPhone,
                messageId: msg.key?.id,
                direction: "INCOMING",
                senderName: resolvedContactName,
                messageType: responseType,
                content: responseValue,
                status: "DELIVERED",
                quotedMessageId: quotedMsgId || undefined,
                quotedContent: quotedContent || undefined,
                quotedSender: quotedSender || undefined,
                sentAt: new Date(),
                deliveredAt: new Date(),
                createdAt: new Date(),
              });

              this.gateway.emitConversationUpdated(orgId, {
                conversationId,
                lastMessage: responseValue,
                lastMessageAt: new Date(),
                lastMessageDirection: "INCOMING",
                status: "AWAITING_REPLY",
              });
            } catch (chatDbErr: any) {
              this.logger.warn(`Failed to persist incoming chat message to DB: ${chatDbErr.message}`);
            }

            // Inbound Auto-Unsubscribe / Opt-Out Engine Listener
            try {
              const unsubSettingsRows = await this.db.sql`
                SELECT enabled, trigger_keywords, auto_reply_confirmation, confirmation_message
                FROM public.unsubscriber_settings
                WHERE organization_id = ${orgId} OR organization_id = 'org-demo'
                ORDER BY updated_at DESC LIMIT 1
              `;
              const unsubSettings = unsubSettingsRows?.[0] || { enabled: true, trigger_keywords: 'STOP,UNSUBSCRIBE,OPTOUT' };

              if (unsubSettings.enabled !== false) {
                const keywords = (unsubSettings.trigger_keywords || 'STOP')
                  .split(',')
                  .map((k: string) => k.trim().toUpperCase())
                  .filter(Boolean);

                const incomingUpper = (responseValue || '').trim().toUpperCase();
                const matchedKeyword = keywords.find((k: string) => incomingUpper === k || incomingUpper.startsWith(k + ' ') || incomingUpper.includes(k));

                const cleanDigits = cleanPhone.replace(/\D/g, "");
                if (matchedKeyword && cleanDigits.length >= 10 && cleanDigits.length <= 13) {
                  this.logger.log(`Opt-out keyword '${matchedKeyword}' detected from ${cleanDigits} on instance ${numberId}`);
                  const unsubId = `unsub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
                  
                  const effectiveOrgId = orgId && orgId !== "org_default" ? orgId : "org-demo";
                  await this.db.sql`
                    INSERT INTO public.unsubscribers (
                      id, organization_id, phone, name, trigger_keyword, instance_id, source, unsubscribed_at, created_at, updated_at
                    ) VALUES (
                      ${unsubId}, ${effectiveOrgId}, ${cleanDigits}, ${resolvedContactName || null}, ${matchedKeyword}, ${numberId}, 'AUTO_KEYWORD', NOW(), NOW(), NOW()
                    )
                    ON CONFLICT (organization_id, phone) DO UPDATE SET
                      trigger_keyword = EXCLUDED.trigger_keyword,
                      instance_id = COALESCE(EXCLUDED.instance_id, unsubscribers.instance_id),
                      unsubscribed_at = NOW(),
                      updated_at = NOW()
                  `.catch((err) => {
                    this.logger.warn(`Failed to insert unsubscriber ${cleanDigits}: ${err.message}`);
                  });

                  // Update contacts tag to UNSUBSCRIBED
                  await this.db.sql`
                    UPDATE public.contacts
                    SET tags = CASE 
                      WHEN tags IS NULL OR tags = '[]'::jsonb THEN '["UNSUBSCRIBED"]'::jsonb
                      WHEN NOT tags ? 'UNSUBSCRIBED' THEN tags || '["UNSUBSCRIBED"]'::jsonb
                      ELSE tags
                    END
                    WHERE (organization_id = ${effectiveOrgId} OR organization_id = 'org-demo' OR organization_id = ${orgId})
                      AND (phone = ${cleanDigits} OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanDigits.slice(-10)})
                  `.catch(() => {});

                  // Optional confirmation reply
                  if (unsubSettings.auto_reply_confirmation !== false) {
                    const confMsg = unsubSettings.confirmation_message || 'You have been successfully unsubscribed. You will no longer receive promotional broadcasts from us.';
                    await socket.sendMessage(remoteJid, { text: confMsg }).catch(() => {});
                  }
                }
              }
            } catch (unsubErr: any) {
              this.logger.warn(`Error in auto-unsubscriber listener: ${unsubErr.message}`);
            }

            const event: IncomingResponseEvent = {
              instanceId: numberId,
              orgId,
              remoteJid,
              resolvedPhone: cleanPhone,
              pushName: resolvedContactName,
              type: responseType,
              value: responseValue,
              buttonId: selectedButtonId,
              buttonTitle: selectedButtonTitle,
              listId: selectedListId,
              listTitle: selectedListTitle,
              pollVote,
              quotedMsgId,
              rawMessageId: msg.key.id,
              timestamp: new Date(),
            };

            this.incomingResponseCallbacks.forEach((cb) => {
              try { cb(event); } catch (err: any) {
                this.logger.error(`Error in incomingResponseCallback: ${err.message}`);
              }
            });

            this.incomingMessageCallbacks.forEach((cb) => {
              try {
                cb(numberId, orgId, remoteJid, responseValue, pushName);
              } catch (err: any) {
                this.logger.error(`Error in incomingMessageCallback: ${err.message}`);
              }
            });
          }
        }
      }
    });

    this.sessions.set(numberId, socket);
    this.logger.log(`[PERF] initSession complete in ${Date.now() - startTime}ms for ${numberId}`);

    return socket;
  }

  private startKeepAlive(numberId: string) {
    if (this.keepAliveTimers.has(numberId)) {
      clearInterval(this.keepAliveTimers.get(numberId)!);
      this.keepAliveTimers.delete(numberId);
    }

    const timer = setInterval(async () => {
      const socket = this.sessions.get(numberId);
      if (socket && this.sessionStates.get(numberId) === "CONNECTED") {
        try {
          await socket.sendPresenceUpdate("available");
        } catch {}
      } else {
        clearInterval(timer);
        this.keepAliveTimers.delete(numberId);
      }
    }, 25000);

    this.keepAliveTimers.set(numberId, timer);
  }

  private async handleConnectionUpdate(
    numberId: string,
    orgId: string,
    shopId: string,
    update: Partial<ConnectionState>
  ) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.logger.log(`Authentic Baileys QR code received for session ${numberId}`);
      try {
        const qrBase64 = await qrcode.toDataURL(qr, {
          margin: 1,
          scale: 6,
          color: { dark: "#0f172a", light: "#ffffff" },
        });

        this.lastQrCache.set(numberId, qrBase64);
        this.sessionStates.set(numberId, "GENERATING_QR");

        // Save QR cache to DB
        this.db.sql`
          UPDATE whatsapp_sessions 
          SET qr_cache = ${qrBase64}, status = 'GENERATING_QR', updated_at = NOW() 
          WHERE id = ${numberId}
        `.catch(() => {});

        this.gateway.emitQrCode(orgId, shopId, {
          numberId,
          qrBase64,
          status: "GENERATING_QR",
        });
      } catch (qrErr: any) {
        this.logger.error(`QR encode error: ${qrErr.message}`);
      }
    }

    if (connection === "open") {
      this.logger.log(`Session ${numberId} CONNECTED successfully! Persistent link active.`);
      this.sessionStates.set(numberId, "CONNECTED");
      this.lastQrCache.delete(numberId);
      this.sessionConnectedTimes.set(numberId, Date.now());

      this.reconnectAttempts.delete(numberId);
      if (this.reconnectTimers.has(numberId)) {
        clearTimeout(this.reconnectTimers.get(numberId)!);
        this.reconnectTimers.delete(numberId);
      }

      this.startKeepAlive(numberId);

      const userJid = this.sessions.get(numberId)?.user?.id || "";
      const rawNum = userJid.split("@")[0].split(":")[0];
      const phoneNumber = rawNum ? `+${rawNum}` : "+91 98765 43210";
      const displayName = this.sessions.get(numberId)?.user?.name || "Optical Store WhatsApp";

      try {
        const authFolder = this.getAuthFolderPath(numberId, orgId);
        const credsPath = path.join(authFolder, "creds.json");
        let credsJsonStr: string | null = null;
        if (fs.existsSync(credsPath)) {
          try {
            credsJsonStr = fs.readFileSync(credsPath, "utf-8");
          } catch {}
        }

        await this.db.sql`
          INSERT INTO whatsapp_sessions (id, organization_id, phone_number, display_name, status, auth_dir_key, qr_cache, auth_creds_json, connected_at, last_active_at)
          VALUES (${numberId}, ${orgId || 'org-demo'}, ${phoneNumber}, ${displayName}, 'CONNECTED', ${authFolder}, NULL, ${credsJsonStr}, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            phone_number = EXCLUDED.phone_number,
            display_name = EXCLUDED.display_name,
            status = 'CONNECTED',
            qr_cache = NULL,
            auth_creds_json = COALESCE(EXCLUDED.auth_creds_json, whatsapp_sessions.auth_creds_json),
            connected_at = NOW(),
            last_active_at = NOW(),
            updated_at = NOW()
        `;

        // Check if this phone number already has historical maturity data from previous pairings
        try {
          const existingHistory = await this.db.sql`
            SELECT account_maturity_type, warmup_started_at 
            FROM whatsapp_sessions 
            WHERE phone_number = ${phoneNumber} AND (organization_id = ${orgId || 'org-demo'} OR organization_id = 'org-demo') AND id != ${numberId}
            ORDER BY updated_at DESC 
            LIMIT 1
          `;
          if (existingHistory && existingHistory.length > 0 && existingHistory[0].account_maturity_type === "MATURED") {
            await this.db.sql`
              UPDATE whatsapp_sessions 
              SET account_maturity_type = 'MATURED'
              WHERE id = ${numberId}
            `;
            this.logger.log(`Restored historical MATURED status for re-connected number ${phoneNumber}`);
          }
        } catch {}
      } catch {}

      this.gateway.emitSessionConnected(orgId, shopId, {
        numberId,
        phoneNumber,
        displayName,
        status: "CONNECTED",
      });

      this.onConnectedCallbacks.forEach((cb) => {
        try { cb(numberId); } catch {}
      });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;

      if (this.keepAliveTimers.has(numberId)) {
        clearInterval(this.keepAliveTimers.get(numberId)!);
        this.keepAliveTimers.delete(numberId);
      }

      try {
        await this.db.sql`
          UPDATE whatsapp_sessions 
          SET status = ${isLoggedOut ? 'LOGGED_OUT' : 'DISCONNECTED'}, updated_at = NOW() 
          WHERE id = ${numberId}
        `;
      } catch {}

      if (isLoggedOut) {
        this.sessionStates.set(numberId, "LOGGED_OUT");
        this.lastQrCache.delete(numberId);
        this.sessionConnectedTimes.delete(numberId);
        this.reconnectAttempts.delete(numberId);

        const authFolderPath = this.getAuthFolderPath(numberId, orgId);
        if (fs.existsSync(authFolderPath)) {
          try { fs.rmSync(authFolderPath, { recursive: true, force: true }); } catch {}
        }

        this.gateway.emitStatusChanged(orgId, shopId, {
          numberId,
          status: "LOGGED_OUT",
          reason: "Device was unlinked from WhatsApp mobile app.",
        });
      } else {
        this.sessionStates.set(numberId, "DISCONNECTED");

        this.gateway.emitStatusChanged(orgId, shopId, {
          numberId,
          status: "DISCONNECTED",
          reason: lastDisconnect?.error?.message || "Connection closed.",
        });

        const wasConnected = this.sessionConnectedTimes.has(numberId);
        const authFolder = this.getAuthFolderPath(numberId, orgId);
        const credsPath = path.join(authFolder, "creds.json");
        let isRegistered = false;
        if (fs.existsSync(credsPath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
            if (parsed && (parsed.registered || parsed.me?.id)) isRegistered = true;
          } catch {}
        }

        // Only auto-reconnect if it was an active paired session or temporary restart
        if (isRestartRequired || wasConnected || isRegistered) {
          const currentAttempts = (this.reconnectAttempts.get(numberId) || 0) + 1;
          this.reconnectAttempts.set(numberId, currentAttempts);

          const delay = isRestartRequired ? 1000 : Math.min(2000 * Math.pow(1.5, Math.min(currentAttempts - 1, 5)), 30000);

          if (this.reconnectTimers.has(numberId)) {
            clearTimeout(this.reconnectTimers.get(numberId)!);
          }

          const timer = setTimeout(() => {
            this.reconnectTimers.delete(numberId);
            this.initSession(numberId, orgId, shopId, false).catch(() => {});
          }, delay);

          this.reconnectTimers.set(numberId, timer);
        } else {
          this.logger.log(`Pairing session for unlinked instance ${numberId} ended. Ready for on-demand pairing.`);
          this.lastQrCache.delete(numberId);
        }
      }
    }
  }

  async logoutSession(numberId: string, orgId: string, shopId: string): Promise<void> {
    if (this.keepAliveTimers.has(numberId)) {
      clearInterval(this.keepAliveTimers.get(numberId)!);
      this.keepAliveTimers.delete(numberId);
    }
    if (this.reconnectTimers.has(numberId)) {
      clearTimeout(this.reconnectTimers.get(numberId)!);
      this.reconnectTimers.delete(numberId);
    }
    this.reconnectAttempts.delete(numberId);

    const socket = this.sessions.get(numberId);
    if (socket) {
      try { await socket.logout(); } catch {}
      try { socket.end(undefined); } catch {}
      this.sessions.delete(numberId);
    }

    this.sessionStates.set(numberId, "LOGGED_OUT");
    this.lastQrCache.delete(numberId);
    this.sessionConnectedTimes.delete(numberId);

    const authFolderPath = this.getAuthFolderPath(numberId, orgId);
    if (fs.existsSync(authFolderPath)) {
      try { fs.rmSync(authFolderPath, { recursive: true, force: true }); } catch {}
    }

    try {
      await this.db.sql`
        UPDATE whatsapp_sessions 
        SET status = 'LOGGED_OUT', qr_cache = NULL, updated_at = NOW() 
        WHERE id = ${numberId}
      `;
    } catch {}

    this.gateway.emitStatusChanged(orgId, shopId, {
      numberId,
      status: "LOGGED_OUT",
      reason: "Session logged out by user request.",
    });
  }

  async purgeSession(numberId: string): Promise<void> {
    await this.logoutSession(numberId, "org-demo", "shop-main");
  }
}
