import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import makeWASocket, {
  WASocket,
  DisconnectReason,
  ConnectionState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode";
import pino from "pino";
import { BaileysAuthStoreService } from "./baileys-auth-store.service";
import { BroadcastGateway } from "./whatsapp.gateway";

@Injectable()
export class WhatsAppSessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppSessionManagerService.name);
  private sessions: Map<string, WASocket> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly authStoreService: BaileysAuthStoreService,
    private readonly gateway: BroadcastGateway
  ) {}

  onModuleDestroy() {
    this.logger.log("Shutting down all active Baileys socket connections...");
    for (const [numberId, socket] of this.sessions.entries()) {
      try {
        socket.end(undefined);
      } catch (err) {
        // Ignored
      }
    }
    this.sessions.clear();
  }

  /**
   * Initializes or returns an active Baileys WASocket connection for a WhatsApp number.
   */
  async initSession(numberId: string, orgId: string, shopId: string): Promise<WASocket> {
    if (this.sessions.has(numberId)) {
      return this.sessions.get(numberId)!;
    }

    this.logger.log(`Initializing Baileys session for numberId=${numberId} (Org: ${orgId}, Shop: ${shopId})`);

    const { state, saveCreds } = await this.authStoreService.useRedisAuthState(numberId);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "warn" }),
      browser: ["OpticalManager Broadcast", "Chrome", "120.0.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      this.handleConnectionUpdate(numberId, orgId, shopId, update);
    });

    this.sessions.set(numberId, socket);
    return socket;
  }

  /**
   * Evaluates Baileys connection updates (QR code generation, connection success, disconnect handling).
   */
  private async handleConnectionUpdate(
    numberId: string,
    orgId: string,
    shopId: string,
    update: Partial<ConnectionState>
  ) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.logger.log(`New QR code generated for session ${numberId}`);
      try {
        const qrBase64 = await qrcode.toDataURL(qr);
        this.gateway.emitQrCode(orgId, shopId, {
          numberId,
          qrBase64,
          status: "GENERATING_QR",
        });
      } catch (qrErr: any) {
        this.logger.error(`Failed to encode QR code: ${qrErr.message}`);
      }
    }

    if (connection === "open") {
      this.logger.log(`Baileys session connected successfully for ${numberId}`);
      const userJid = this.sessions.get(numberId)?.user?.id || "";
      const phoneNumber = userJid.split("@")[0].split(":")[0];
      const displayName = this.sessions.get(numberId)?.user?.name || "Optical Store WhatsApp";

      this.gateway.emitSessionConnected(orgId, shopId, {
        numberId,
        phoneNumber,
        displayName,
        status: "CONNECTED",
      });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const reason = (lastDisconnect?.error as Boom)?.message || "Connection Closed";

      this.logger.warn(`Baileys session ${numberId} closed (Status: ${statusCode}, Reason: ${reason})`);

      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        this.logger.warn(`User logged out Baileys session ${numberId}. Purging auth keys.`);
        await this.purgeSession(numberId);
        this.gateway.emitStatusChanged(orgId, shopId, {
          numberId,
          status: "LOGGED_OUT",
          reason: "Logged out by phone user.",
        });
      } else {
        this.logger.log(`Attempting background reconnection for session ${numberId} in 5s...`);
        this.gateway.emitStatusChanged(orgId, shopId, {
          numberId,
          status: "RECONNECTING",
          reason,
        });

        // Clear existing reconnect timer if any
        if (this.reconnectTimers.has(numberId)) {
          clearTimeout(this.reconnectTimers.get(numberId));
        }

        const timer = setTimeout(() => {
          this.sessions.delete(numberId);
          this.initSession(numberId, orgId, shopId).catch((err) => {
            this.logger.error(`Reconnection failed for session ${numberId}: ${err.message}`);
          });
        }, 5000);

        this.reconnectTimers.set(numberId, timer);
      }
    }
  }

  /**
   * Retrieves an active socket instance for sending messages.
   */
  getSessionSocket(numberId: string): WASocket | null {
    return this.sessions.get(numberId) || null;
  }

  /**
   * Purges session socket and stored auth keys.
   */
  async purgeSession(numberId: string): Promise<void> {
    const socket = this.sessions.get(numberId);
    if (socket) {
      try {
        socket.end(undefined);
      } catch (err) {
        // Ignored
      }
      this.sessions.delete(numberId);
    }
    await this.authStoreService.purgeSessionKeys(numberId);
  }
}
