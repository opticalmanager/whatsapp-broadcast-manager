import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { WhatsAppSessionManagerService, IncomingResponseEvent } from "../whatsapp-session/whatsapp-session.service";
import { DatabaseService } from "../../database/database.service";
import { SettingsService } from "../settings/settings.service";
import * as fs from "fs";
import * as path from "path";

export interface RecipientRecord {
  id: string;
  phone: string;
  name?: string;
  messageId?: string;
  status?: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "INVALID_NUMBER" | "NON_WHATSAPP" | "PAUSED" | "CANCELLED" | string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  errorMessage?: string;
  pollVote?: string;
  pollVotedAt?: Date;
  replyText?: string;
  repliedAt?: Date;
  buttonClicked?: string;
  buttonClickedAt?: Date;
  listItemSelected?: string;
}

export interface CampaignItem {
  id: string;
  organizationId: string;
  shopId: string;
  whatsappNumberId: string;
  templateId?: string;
  name: string;
  targetAudienceType: string;
  audienceNames?: string[];
  scheduledAt: Date;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  recipients?: RecipientRecord[];
  messageText?: string;
  mediaUrl?: string;
  createdAt: Date;
}

import { UnsubscribersService } from "../unsubscribers/unsubscribers.service";

@Injectable()
export class CampaignsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignsService.name);
  private campaignsStore: Map<string, CampaignItem> = new Map();
  private activeDispatches: Set<string> = new Set();
  private readonly storageFilePath = path.join(process.cwd(), "campaigns_storage.json");
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly baileysService: WhatsAppSessionManagerService,
    private readonly db: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly unsubscribersService: UnsubscribersService
  ) {}

  async onModuleInit() {
    await this.loadFromDatabase();
    this.loadFromDisk();

    this.baileysService.addOnConnectedListener((_numberId) => {
      this.logger.log("WhatsApp connection confirmed active. Checking for campaigns to auto-resume...");
      this.autoResumePendingCampaigns();
    });

    this.baileysService.addOnMessageReceiptListener((msgId, remoteJid, status) => {
      this.handleReceiptUpdate(msgId, remoteJid, status);
    });

    this.baileysService.addOnIncomingResponseListener((event) => {
      this.handleIncomingResponse(event);
    });

    this.startBackgroundScheduler();

    setTimeout(() => {
      this.autoResumePendingCampaigns();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  private startBackgroundScheduler() {
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.checkDueScheduledCampaigns();
      } catch (err: any) {
        this.logger.debug(`[Scheduler] Error checking due campaigns: ${err.message}`);
      }
    }, 15000);
    this.logger.log("[Scheduler] 24/7 background campaign scheduler started (15s polling).");
  }

  private async checkDueScheduledCampaigns() {
    const now = new Date();

    for (const cmp of this.campaignsStore.values()) {
      if (cmp.status === "SCHEDULED" && new Date(cmp.scheduledAt) <= now) {
        this.logger.log(`[Scheduler] Campaign "${cmp.name}" (${cmp.id}) is due for dispatch! Starting now...`);
        cmp.status = "PROCESSING";
        this.saveToDisk();

        try {
          await this.db.sql`
            UPDATE campaigns SET status = 'PROCESSING', updated_at = NOW() WHERE id = ${cmp.id}
          `;
        } catch {}

        this.startLiveBaileysDispatch(cmp, cmp.messageText || "", cmp.mediaUrl).catch((err) => {
          this.logger.error(`[Scheduler] Failed to dispatch scheduled campaign ${cmp.id}: ${err.message}`);
        });
      }
    }
  }

  private async loadFromDatabase() {
    try {
      const rows = await this.db.sql`
        SELECT * FROM campaigns WHERE created_at IS NOT NULL AND created_at > '2026-01-01' ORDER BY created_at DESC LIMIT 50
      `;

      if (rows && rows.length > 0) {
        for (const r of rows) {
          if (!r.created_at || new Date(r.created_at).getFullYear() < 2026) continue;
          const recRows = await this.db.sql`
            SELECT * FROM campaign_recipients WHERE campaign_id = ${r.id} ORDER BY created_at ASC
          `;

          const recipients: RecipientRecord[] = (recRows || []).map((rec: any) => ({
            id: rec.id,
            phone: rec.phone,
            name: rec.name || "Customer",
            messageId: rec.message_id || undefined,
            status: rec.status,
            sentAt: rec.sent_at ? new Date(rec.sent_at) : undefined,
            deliveredAt: rec.delivered_at ? new Date(rec.delivered_at) : undefined,
            readAt: rec.read_at ? new Date(rec.read_at) : undefined,
            pollVote: rec.poll_vote || undefined,
            pollVotedAt: rec.poll_voted_at ? new Date(rec.poll_voted_at) : undefined,
            replyText: rec.reply_text || undefined,
            repliedAt: rec.replied_at ? new Date(rec.replied_at) : undefined,
            buttonClicked: rec.button_clicked || undefined,
            buttonClickedAt: rec.button_clicked_at ? new Date(rec.button_clicked_at) : undefined,
            errorMessage: rec.error_message || undefined,
          }));

          const parseJson = (val: any) => {
            if (!val) return undefined;
            if (typeof val === "object") return val;
            try { return JSON.parse(val); } catch { return undefined; }
          };

          const cmp: CampaignItem & Record<string, any> = {
            id: r.id,
            organizationId: r.organization_id,
            shopId: "shop-main",
            whatsappNumberId: r.whatsapp_session_id || "default",
            name: r.name,
            targetAudienceType: r.target_audience_type || "ALL",
            scheduledAt: new Date(r.scheduled_at),
            status: r.status,
            totalRecipients: r.total_recipients || recipients.length,
            sentCount: r.sent_count || 0,
            deliveredCount: r.delivered_count || 0,
            readCount: r.read_count || 0,
            failedCount: r.failed_count || 0,
            recipients,
            messageText: r.message_text,
            mediaUrl: r.media_url,
            createdAt: new Date(r.created_at),
            contentType: r.content_type || (r.poll_question ? "poll" : r.media_url ? "media" : "text"),
            pollQuestion: r.poll_question || undefined,
            pollOptions: parseJson(r.poll_options),
            pollData: parseJson(r.poll_data),
            actionButtons: parseJson(r.action_buttons),
            buttons: parseJson(r.action_buttons),
            menuData: parseJson(r.menu_data),
          };

          this.campaignsStore.set(cmp.id, cmp);
        }
        this.logger.log(`Loaded ${rows.length} campaigns from Supabase database.`);
      }
    } catch (err: any) {
      this.logger.warn(`Database campaign load warning: ${err.message}`);
    }
  }

  handleIncomingResponse(event: IncomingResponseEvent) {
    const rawClean = (event.resolvedPhone || event.remoteJid).split("@")[0].split(":")[0].replace(/\D/g, "");
    const cleanJidPhone10 = rawClean.slice(-10);
    this.logger.log(`[CampaignsService] Processing incoming ${event.type} from ${rawClean} (Phone10: ${cleanJidPhone10}, Value: "${event.value}")`);

    for (const cmp of this.campaignsStore.values()) {
      if (!cmp.recipients || cmp.recipients.length === 0) continue;

      let hasMatch = false;
      for (const rec of cmp.recipients) {
        const cleanRecPhone10 = (rec.phone || "").replace(/\D/g, "").slice(-10);
        const isMatch =
          (event.quotedMsgId && rec.messageId && rec.messageId === event.quotedMsgId) ||
          (cleanJidPhone10 && cleanRecPhone10 && cleanJidPhone10 === cleanRecPhone10);

        if (isMatch) {
          hasMatch = true;

          // Always mark as READ and DELIVERED when interacting
          rec.status = "READ";
          rec.readAt = rec.readAt || new Date();
          rec.deliveredAt = rec.deliveredAt || new Date();

          if (event.type === "POLL_VOTE") {
            rec.pollVote = event.value || event.pollVote || "Voted";
            rec.pollVotedAt = event.timestamp || new Date();
            this.logger.log(`[Poll Response] Recorded vote for ${rec.phone} in "${cmp.name}": "${rec.pollVote}"`);
          } else if (event.type === "BUTTON") {
            rec.buttonClicked = event.buttonTitle || event.buttonId || event.value;
            rec.buttonClickedAt = event.timestamp || new Date();
            rec.replyText = `🔘 ${rec.buttonClicked}`;
            rec.repliedAt = event.timestamp || new Date();
            this.logger.log(`[Button Response] Recorded click for ${rec.phone} in "${cmp.name}": "${rec.buttonClicked}"`);
          } else if (event.type === "LIST") {
            rec.listItemSelected = event.listTitle || event.listId || event.value;
            rec.replyText = `📋 ${rec.listItemSelected}`;
            rec.repliedAt = event.timestamp || new Date();
            this.logger.log(`[List Response] Recorded selection for ${rec.phone} in "${cmp.name}": "${rec.listItemSelected}"`);
          } else {
            rec.replyText = event.value;
            rec.repliedAt = event.timestamp || new Date();
            this.logger.log(`[Chat Reply] Recorded reply for ${rec.phone} in "${cmp.name}": "${rec.replyText}"`);

            // Check if incoming text matches an action button
            const rawButtons = (cmp as any).actionButtons || (cmp as any).buttons || [];
            const matchingBtn = rawButtons.find((b: any) => {
              const label = (b.displayText || b.text || b.id || "").toLowerCase().trim();
              const val = (event.value || "").toLowerCase().trim();
              return label === val || (val && label.includes(val)) || (label && val.includes(label));
            });
            if (matchingBtn && !rec.buttonClicked) {
              rec.buttonClicked = matchingBtn.displayText || matchingBtn.text || matchingBtn.id;
              rec.buttonClickedAt = event.timestamp || new Date();
              this.logger.log(`[Button Match] Matched button "${rec.buttonClicked}" for ${rec.phone} from text reply.`);
            }

            // Check if incoming text matches a list menu item
            const rawMenuItems = (cmp as any).menuData?.items || [];
            const matchingMenuItem = rawMenuItems.find((m: any) => {
              const title = (m.title || m.id || "").toLowerCase().trim();
              const val = (event.value || "").toLowerCase().trim();
              return title === val || (val && title.includes(val)) || (title && val.includes(title));
            });
            if (matchingMenuItem && !rec.listItemSelected) {
              rec.listItemSelected = matchingMenuItem.title || matchingMenuItem.id;
              this.logger.log(`[Menu Match] Matched menu "${rec.listItemSelected}" for ${rec.phone} from text reply.`);
            }

            // Check if incoming text matches a poll option
            const pollOptions = (cmp as any).pollOptions || [];
            const matchingPollOpt = pollOptions.find((opt: string) => {
              const optNorm = opt.toLowerCase().trim();
              const val = (event.value || "").toLowerCase().trim();
              return optNorm === val || (val && optNorm.includes(val)) || (optNorm && val.includes(optNorm));
            });
            if (matchingPollOpt && !rec.pollVote) {
              rec.pollVote = matchingPollOpt;
              rec.pollVotedAt = event.timestamp || new Date();
              this.logger.log(`[Poll Match] Matched poll vote "${rec.pollVote}" for ${rec.phone} from text reply.`);
            }
          }

          // Persist recipient to database
          this.db.sql`
            UPDATE campaign_recipients
            SET 
              status = 'READ',
              read_at = COALESCE(read_at, NOW()),
              delivered_at = COALESCE(delivered_at, NOW()),
              poll_vote = COALESCE(${rec.pollVote || null}, poll_vote),
              poll_voted_at = COALESCE(${rec.pollVotedAt ? rec.pollVotedAt.toISOString() : null}::timestamptz, poll_voted_at),
              reply_text = COALESCE(${rec.replyText || null}, reply_text),
              replied_at = COALESCE(${rec.repliedAt ? rec.repliedAt.toISOString() : null}::timestamptz, replied_at),
              button_clicked = COALESCE(${rec.buttonClicked || null}, button_clicked),
              button_clicked_at = COALESCE(${rec.buttonClickedAt ? rec.buttonClickedAt.toISOString() : null}::timestamptz, button_clicked_at)
            WHERE id = ${rec.id} 
               OR (campaign_id = ${cmp.id} AND (
                 (message_id IS NOT NULL AND message_id = ${rec.messageId || ''}) 
                 OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanJidPhone10}
               ))
          `.catch((err) => {
            this.logger.debug(`Failed to update campaign_recipients in DB: ${err.message}`);
          });
        }
      }

      if (hasMatch) {
        cmp.sentCount = (cmp.recipients || []).filter(
          (r) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ"
        ).length;
        cmp.deliveredCount = (cmp.recipients || []).filter(
          (r) => r.status === "DELIVERED" || r.status === "READ"
        ).length;
        cmp.readCount = (cmp.recipients || []).filter((r) => r.status === "READ").length;

        this.saveToDisk();

        this.db.sql`
          UPDATE campaigns 
          SET sent_count = ${cmp.sentCount}, delivered_count = ${cmp.deliveredCount}, read_count = ${cmp.readCount}, updated_at = NOW()
          WHERE id = ${cmp.id}
        `.catch(() => {});
      }
    }

    // Direct database update across any campaign where this phone number was sent a broadcast
    this.db.sql`
      UPDATE campaign_recipients
      SET 
        status = 'READ',
        read_at = COALESCE(read_at, NOW()),
        delivered_at = COALESCE(delivered_at, NOW()),
        poll_vote = COALESCE(${event.type === 'POLL_VOTE' ? (event.value || 'Voted') : null}, poll_vote),
        poll_voted_at = CASE WHEN ${event.type === 'POLL_VOTE'} THEN NOW() ELSE poll_voted_at END,
        reply_text = ${event.value},
        replied_at = NOW(),
        button_clicked = COALESCE(${event.type === 'BUTTON' ? (event.buttonTitle || event.buttonId || event.value) : null}, button_clicked),
        button_clicked_at = CASE WHEN ${event.type === 'BUTTON'} THEN NOW() ELSE button_clicked_at END
      WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanJidPhone10}
        AND (status IN ('SENT', 'DELIVERED', 'READ') OR sent_at IS NOT NULL)
    `.catch((err) => {
      this.logger.debug(`Direct DB reply update note: ${err.message}`);
    });
  }

  handleReceiptUpdate(msgId: string, remoteJid: string, status: number) {
    if (!msgId) return;

    for (const cmp of this.campaignsStore.values()) {
      if (!cmp.recipients || cmp.recipients.length === 0) continue;

      let hasMatch = false;
      for (const rec of cmp.recipients) {
        // Strict messageId matching: Only update read receipt for the exact broadcast message that was read!
        const isMatch = Boolean(rec.messageId && rec.messageId === msgId);

        if (isMatch) {
          hasMatch = true;
          if (status === 4 || status === 5) {
            rec.status = "READ";
            rec.readAt = rec.readAt || new Date();
            rec.deliveredAt = rec.deliveredAt || new Date();

            this.db.sql`
              UPDATE campaign_recipients 
              SET status = 'READ', read_at = NOW(), delivered_at = COALESCE(delivered_at, NOW())
              WHERE id = ${rec.id} OR (campaign_id = ${cmp.id} AND message_id = ${msgId})
            `.catch(() => {});
          } else if (status === 3) {
            if (rec.status !== "READ") {
              rec.status = "DELIVERED";
              rec.deliveredAt = rec.deliveredAt || new Date();

              this.db.sql`
                UPDATE campaign_recipients 
                SET status = 'DELIVERED', delivered_at = NOW()
                WHERE id = ${rec.id} OR (campaign_id = ${cmp.id} AND message_id = ${msgId})
              `.catch(() => {});
            }
          }
        }
      }

      if (hasMatch) {
        cmp.sentCount = (cmp.recipients || []).filter(
          (r) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ"
        ).length;
        cmp.deliveredCount = (cmp.recipients || []).filter(
          (r) => r.status === "DELIVERED" || r.status === "READ"
        ).length;
        cmp.readCount = (cmp.recipients || []).filter((r) => r.status === "READ").length;
        cmp.failedCount = (cmp.recipients || []).filter((r) => r.status === "FAILED").length;

        this.saveToDisk();

        this.db.sql`
          UPDATE campaigns 
          SET sent_count = ${cmp.sentCount}, delivered_count = ${cmp.deliveredCount}, read_count = ${cmp.readCount}, failed_count = ${cmp.failedCount}, updated_at = NOW()
          WHERE id = ${cmp.id}
        `.catch(() => {});

        this.logger.log(
          `[WhatsApp Receipt] Msg ${msgId} status=${status} -> Updated "${cmp.name}" (Delivered: ${cmp.deliveredCount}, Read: ${cmp.readCount})`
        );
      }
    }
  }

  private saveToDisk() {
    try {
      const list = Array.from(this.campaignsStore.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(list, null, 2), "utf-8");
    } catch (err: any) {
      this.logger.warn(`Failed to persist campaigns to disk: ${err.message}`);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, "utf-8");
        const list: any[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((c) => {
            if (c.createdAt && new Date(c.createdAt).getFullYear() >= 2026) {
              const existing = this.campaignsStore.get(c.id);
              if (existing) {
                // Enrich existing loaded campaign with rich interactive metadata
                (existing as any).contentType = (existing as any).contentType || c.contentType;
                (existing as any).pollQuestion = (existing as any).pollQuestion || c.pollQuestion || c.pollData?.question;
                (existing as any).pollOptions = (existing as any).pollOptions || c.pollOptions || c.pollData?.options;
                (existing as any).pollData = (existing as any).pollData || c.pollData;
                (existing as any).actionButtons = (existing as any).actionButtons || c.actionButtons || c.buttons;
                (existing as any).buttons = (existing as any).buttons || c.buttons || c.actionButtons;
                (existing as any).menuData = (existing as any).menuData || c.menuData;
                (existing as any).messageType = (existing as any).messageType || c.messageType;
              } else {
                this.campaignsStore.set(c.id, c);
              }
            }
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load campaigns from disk: ${err.message}`);
    }
  }

  autoResumePendingCampaigns() {
    for (const cmp of this.campaignsStore.values()) {
      if (cmp.status === "PROCESSING" || cmp.status === "PAUSED") {
        const delivered = (cmp.recipients || []).filter((r) => r.status === "DELIVERED").length;
        const permaFailed = (cmp.recipients || []).filter(
          (r) => r.status === "FAILED" && r.errorMessage?.includes("not registered on WhatsApp")
        ).length;

        if (delivered + permaFailed < cmp.totalRecipients && !this.activeDispatches.has(cmp.id)) {
          (cmp.recipients || []).forEach((r) => {
            if (r.status === "FAILED" && !r.errorMessage?.includes("not registered on WhatsApp")) {
              r.status = "PENDING";
            }
          });
          cmp.status = "PROCESSING";
          this.saveToDisk();

          this.logger.log(`[Auto-Resume] Resuming campaign ${cmp.id} (${cmp.name})...`);
          this.startLiveBaileysDispatch(cmp, cmp.messageText || "", cmp.mediaUrl).catch((err) => {
            this.logger.error(`Error in resumed dispatch loop for ${cmp.id}: ${err.message}`);
          });
        }
      }
    }
  }

  syncFromFrontend(orgId: string, items: any[]): CampaignItem[] {
    if (!Array.isArray(items)) return this.findAll(orgId);

    items.forEach((item) => {
      if (!item.id) return;
      if (!this.campaignsStore.has(item.id)) {
        const activeNumberId =
          item.whatsappNumberId ||
          this.baileysService.getActiveSessionNumberId() ||
          `num-${(orgId || "org-demo").slice(0, 8)}`;

        const recs: RecipientRecord[] = (item.recipients || []).map((r: any, idx: number) => ({
          id: r.id || `rc-sync-${idx}`,
          phone: r.phone,
          name: r.name || "Customer",
          status: r.status || "PENDING",
          errorMessage: r.errorMessage,
        }));

        const newCmp: CampaignItem = {
          id: item.id,
          organizationId: orgId || "org-demo",
          shopId: item.shopId || "shop-main",
          whatsappNumberId: activeNumberId,
          templateId: item.templateId || "tpl-custom",
          name: item.name || "Campaign",
          targetAudienceType: item.targetAudienceType || "MULTI_AUDIENCE",
          audienceNames: item.audienceNames || ["Selected Segment"],
          scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : new Date(),
          status: item.status || "PROCESSING",
          totalRecipients: Math.max(recs.length, item.totalRecipients || 1),
          sentCount: item.sentCount || 0,
          deliveredCount: item.deliveredCount || 0,
          readCount: item.readCount || 0,
          failedCount: item.failedCount || 0,
          recipients: recs,
          messageText: item.messageText,
          mediaUrl: item.mediaUrl,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        };

        this.campaignsStore.set(newCmp.id, newCmp);
      }
    });

    this.saveToDisk();
    this.autoResumePendingCampaigns();
    return this.findAll(orgId);
  }

  findAll(orgId: string): CampaignItem[] {
    const list = Array.from(this.campaignsStore.values()).filter(
      (c) =>
        c.createdAt &&
        new Date(c.createdAt).getFullYear() >= 2026 &&
        (!orgId || orgId === "" || orgId === "org-demo" || !c.organizationId || c.organizationId === "org-demo" || c.organizationId === orgId)
    );
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findOne(id: string): CampaignItem {
    const cmp = this.campaignsStore.get(id);
    if (!cmp) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }
    return cmp;
  }

  getRecipients(campaignId: string): RecipientRecord[] {
    const cmp = this.campaignsStore.get(campaignId);
    if (cmp && cmp.recipients && cmp.recipients.length > 0) {
      return cmp.recipients;
    }
    return [];
  }

  async getCampaignReport(campaignId: string) {
    let cmp = this.campaignsStore.get(campaignId) as any;
    if (!cmp) {
      try {
        const rows = await this.db.sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`;
        if (rows && rows.length > 0) {
          const r = rows[0];
          const parseJson = (val: any) => {
            if (!val) return undefined;
            if (typeof val === "object") return val;
            try { return JSON.parse(val); } catch { return undefined; }
          };
          cmp = {
            id: r.id,
            organizationId: r.organization_id,
            shopId: "shop-main",
            whatsappNumberId: r.whatsapp_session_id || "default",
            name: r.name,
            targetAudienceType: r.target_audience_type || "ALL",
            scheduledAt: new Date(r.scheduled_at),
            status: r.status,
            totalRecipients: r.total_recipients || 0,
            sentCount: r.sent_count || 0,
            deliveredCount: r.delivered_count || 0,
            readCount: r.read_count || 0,
            failedCount: r.failed_count || 0,
            recipients: [],
            messageText: r.message_text,
            mediaUrl: r.media_url,
            createdAt: new Date(r.created_at),
            contentType: r.content_type || (r.poll_question ? "poll" : r.media_url ? "media" : "text"),
            pollQuestion: r.poll_question || undefined,
            pollOptions: parseJson(r.poll_options),
            pollData: parseJson(r.poll_data),
            actionButtons: parseJson(r.action_buttons),
            buttons: parseJson(r.action_buttons),
            menuData: parseJson(r.menu_data),
          };
          this.campaignsStore.set(cmp.id, cmp);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fetch campaign ${campaignId} from DB: ${err.message}`);
      }
    }

    if (!cmp) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found.`);
    }

    // Query latest campaign_recipients from DB
    let dbRecipients: any[] = [];
    try {
      dbRecipients = await this.db.sql`
        SELECT * FROM campaign_recipients WHERE campaign_id = ${campaignId} ORDER BY created_at ASC
      `;
    } catch {}

    let rawRecipients: RecipientRecord[] = (dbRecipients && dbRecipients.length > 0)
      ? dbRecipients.map((rec: any, idx: number) => ({
          id: rec.id || `rc-${idx}`,
          phone: rec.phone,
          name: rec.name || "Customer",
          messageId: rec.message_id || undefined,
          status: rec.status,
          sentAt: rec.sent_at ? new Date(rec.sent_at) : undefined,
          deliveredAt: rec.delivered_at ? new Date(rec.delivered_at) : undefined,
          readAt: rec.read_at ? new Date(rec.read_at) : undefined,
          pollVote: rec.poll_vote || undefined,
          pollVotedAt: rec.poll_voted_at ? new Date(rec.poll_voted_at) : undefined,
          replyText: rec.reply_text || undefined,
          repliedAt: rec.replied_at ? new Date(rec.replied_at) : undefined,
          buttonClicked: rec.button_clicked || undefined,
          buttonClickedAt: rec.button_clicked_at ? new Date(rec.button_clicked_at) : undefined,
          errorMessage: rec.error_message || undefined,
        }))
      : (cmp.recipients || []);

    // Also query chat_messages for all incoming customer replies
    const phoneClean10List = Array.from(new Set(rawRecipients.map((r) => (r.phone || "").replace(/\D/g, "").slice(-10)).filter(Boolean)));
    let incomingChatMsgs: any[] = [];
    if (phoneClean10List.length > 0) {
      try {
        incomingChatMsgs = await this.db.sql`
          SELECT id, phone, sender_name, content, message_type, created_at
          FROM chat_messages
          WHERE direction = 'INCOMING'
            AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ANY(${phoneClean10List})
          ORDER BY created_at DESC
        `;
      } catch (err: any) {
        this.logger.debug(`Could not query incoming chat messages: ${err.message}`);
      }
    }

    // Merge incoming messages into recipients if not already present
    for (const rec of rawRecipients) {
      const rec10 = (rec.phone || "").replace(/\D/g, "").slice(-10);
      const match = incomingChatMsgs.find((m: any) => (m.phone || "").replace(/\D/g, "").slice(-10) === rec10);
      if (match) {
        if (!rec.replyText) {
          rec.replyText = match.content;
          rec.repliedAt = new Date(match.created_at);
        }
        if (rec.status !== "READ") {
          rec.status = "READ";
          rec.readAt = rec.readAt || new Date(match.created_at);
          rec.deliveredAt = rec.deliveredAt || new Date(match.created_at);
        }
      }
    }

    const connectedSession = this.baileysService.getSessionStatus(cmp.whatsappNumberId);
    let senderInstance = "Shop Main";
    if (connectedSession?.phoneNumber) {
      const name = connectedSession.displayName || "Shop Main";
      senderInstance = `${name} (${connectedSession.phoneNumber})`;
    } else if (connectedSession?.displayName) {
      senderInstance = connectedSession.displayName;
    }

    // 1. Extract genuine real poll votes from recipients who voted
    const realVoters = rawRecipients
      .filter((r: any) => !!r.pollVote)
      .map((r: any) => ({
        name: r.name,
        phone: r.phone,
        option: r.pollVote,
        votedAt: r.pollVotedAt || r.sentAt || new Date(),
      }));

    const isPoll = 
      cmp.contentType === "poll" || 
      !!cmp.pollQuestion || 
      realVoters.length > 0 || 
      Boolean(cmp.messageType && cmp.messageType.toLowerCase().includes("poll")) ||
      Boolean(cmp.name && cmp.name.toLowerCase().includes("poll")) ||
      Boolean(cmp.messageText && cmp.messageText.toLowerCase().includes("poll"));
    
    // Dynamically gather poll options from campaign config AND from voter selections
    const pollOptionsSet = new Set<string>();
    if (Array.isArray(cmp.pollOptions)) {
      cmp.pollOptions.forEach((o: string) => o && pollOptionsSet.add(o.trim()));
    }
    if (Array.isArray(cmp.pollData?.options)) {
      cmp.pollData.options.forEach((o: string) => o && pollOptionsSet.add(o.trim()));
    }
    realVoters.forEach((v: any) => {
      if (v.option && v.option !== "Voted") {
        pollOptionsSet.add(v.option.trim());
      }
    });

    const pollOptionsList: string[] = pollOptionsSet.size > 0 ? Array.from(pollOptionsSet) : (isPoll ? ["Yes", "No"] : []);
    const totalVotes = realVoters.length;

    const pollAnalytics = {
      isPoll,
      question: cmp.pollQuestion || cmp.pollData?.question || (isPoll ? (cmp.messageText || "Poll Question") : ""),
      totalVotes,
      options: pollOptionsList.map((opt: string) => {
        const optLower = opt.toLowerCase().trim();
        const votes = realVoters.filter((v: any) => {
          const vOpt = (v.option || "").toLowerCase().trim();
          return vOpt === optLower || vOpt.includes(optLower) || (optLower && optLower.includes(vOpt));
        }).length;
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        return { text: opt, votes, percentage };
      }),
      voters: realVoters,
    };

    const msgType = isPoll ? "Poll" : cmp.contentType === "button" ? "Button" : cmp.contentType === "list" ? "List/Menu" : cmp.mediaUrl ? "Text With Media" : "Text";

    const previewWidget = {
      type: isPoll ? "poll" : (cmp.contentType || (cmp.mediaUrl ? "media" : "text")),
      pollQuestion: pollAnalytics.question,
      pollOptions: pollOptionsList,
      buttons: cmp.buttons || cmp.actionButtons || [],
      menuData: cmp.menuData,
      mediaUrl: cmp.mediaUrl,
    };

    // 2. Map enriched recipients
    const enrichedRecipients = rawRecipients.map((r, idx) => {
      const cleanPhone = (r.phone || "").replace(/\D/g, "");
      let status = (r.status as string) || "PENDING";
      let failureCategory: string | undefined = undefined;

      if (cleanPhone.length < 10 || (cleanPhone.startsWith("91") && cleanPhone.length === 11)) {
        status = "INVALID_NUMBER";
        failureCategory = "INVALID_NUMBER";
        r.errorMessage = r.errorMessage || (cleanPhone.length < 10 ? "Invalid phone number format (less than 10 digits)" : "Invalid Indian mobile number (only 9 digits)");
      } else if (
        r.errorMessage?.toLowerCase().includes("unsubscribed") || 
        r.errorMessage?.toLowerCase().includes("opted out") || 
        r.status === "SKIPPED_UNSUBSCRIBED"
      ) {
        status = "FAILED";
        failureCategory = "UNSUBSCRIBED";
        r.errorMessage = "Recipient opted out (Unsubscribed)";
      } else if (r.errorMessage?.toLowerCase().includes("not registered") || r.errorMessage?.toLowerCase().includes("non whatsapp") || r.status === "NON_WHATSAPP" || status === "NON_WHATSAPP") {
        status = "NON_WHATSAPP";
        failureCategory = "NON_WHATSAPP";
      } else if (r.status === "FAILED" || status === "FAILED") {
        status = "FAILED";
        failureCategory = "FAILED";
      } else if (cmp.status === "PAUSED" && (r.status === "PENDING" || !r.status)) {
        status = "PAUSED";
      } else if (cmp.status === "CANCELLED" && (r.status === "PENDING" || !r.status)) {
        status = "CANCELLED";
      } else if (r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ") {
        status = r.status;
      }

      return {
        id: r.id || `rc-${idx}`,
        phone: r.phone,
        name: r.name || "Customer",
        senderInstance,
        instanceName: senderInstance,
        instanceNumber: connectedSession?.phoneNumber || "",
        messageType: msgType,
        messageText: cmp.messageText || "Campaign Broadcast Message",
        previewWidget,
        status,
        failureCategory,
        failureReason: r.errorMessage || (status === "NON_WHATSAPP" ? "Not registered on WhatsApp" : status === "INVALID_NUMBER" ? (cleanPhone.length < 10 ? "Invalid phone digits (less than 10 digits)" : "Missing mobile digit (only 9 digits)") : undefined),
        pollVote: r.pollVote || null,
        pollVotedAt: r.pollVotedAt || null,
        replyText: r.replyText || null,
        repliedAt: r.repliedAt || null,
        buttonClicked: r.buttonClicked || null,
        buttonClickedAt: r.buttonClickedAt || null,
        listItemSelected: r.listItemSelected || null,
        createdAt: cmp.createdAt || new Date(),
        sentAt: (status === "INVALID_NUMBER" || status === "NON_WHATSAPP" || status === "FAILED") ? null : (r.sentAt || (["SENT", "DELIVERED", "READ"].includes(status) ? (r.deliveredAt || cmp.createdAt) : null)),
        deliveredAt: (status === "INVALID_NUMBER" || status === "NON_WHATSAPP" || status === "FAILED") ? null : (r.deliveredAt || null),
        readAt: r.readAt || null,
      };
    });

    const totalMessages = Math.max(cmp.totalRecipients || 0, enrichedRecipients.length);
    const sentCount = enrichedRecipients.filter(r => ["SENT", "DELIVERED", "READ"].includes(r.status)).length;
    const pendingCount = enrichedRecipients.filter(r => r.status === "PENDING" || r.status === "QUEUED" || r.status === "SENDING").length;
    const pausedCount = enrichedRecipients.filter(r => r.status === "PAUSED").length;
    const cancelledCount = enrichedRecipients.filter(r => r.status === "CANCELLED").length;
    const invalidNumberCount = enrichedRecipients.filter(r => r.status === "INVALID_NUMBER").length;
    const nonWhatsappCount = enrichedRecipients.filter(r => r.status === "NON_WHATSAPP").length;
    const failedCount = enrichedRecipients.filter(r => r.status === "FAILED").length;
    const deliveredCount = enrichedRecipients.filter(r => r.status === "DELIVERED" || r.status === "READ").length;
    const readCount = enrichedRecipients.filter(r => r.status === "READ").length;

    // Calculate 100% genuine real replies from recipients who replied + all incoming messages
    const repliesMap = new Map<string, any>();
    for (const r of enrichedRecipients) {
      if (r.replyText) {
        const r10 = (r.phone || "").replace(/\D/g, "").slice(-10);
        repliesMap.set(r10, {
          id: `rep-${r.id}`,
          phone: r.phone,
          name: r.name,
          text: r.replyText,
          receivedAt: r.repliedAt || new Date(),
        });
      }
    }
    for (const m of incomingChatMsgs) {
      const m10 = (m.phone || "").replace(/\D/g, "").slice(-10);
      if (!repliesMap.has(m10)) {
        const rec = enrichedRecipients.find((r) => (r.phone || "").replace(/\D/g, "").slice(-10) === m10);
        repliesMap.set(m10, {
          id: `rep-${m.id}`,
          phone: rec?.phone || m.phone,
          name: rec?.name || m.sender_name || "Customer",
          text: m.content,
          receivedAt: new Date(m.created_at),
        });
      }
    }
    const realReplies = Array.from(repliesMap.values()).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Button Click Analytics
    const rawButtons = cmp.actionButtons || cmp.buttons || [];
    const buttonAnalytics = {
      hasButtons: rawButtons.length > 0 || enrichedRecipients.some(r => !!r.buttonClicked),
      buttons: rawButtons.map((btn: any) => {
        const btnId = (btn.id || btn.value || "").toLowerCase().trim();
        const label = (btn.displayText || btn.text || btnId).trim();
        const labelLower = label.toLowerCase();

        const clicks = enrichedRecipients.filter((r: any) => {
          const bc = (r.buttonClicked || "").toLowerCase().trim();
          const rep = (r.replyText || "").toLowerCase().trim();
          return (
            (bc && (bc === labelLower || bc === btnId || bc.includes(labelLower) || labelLower.includes(bc))) ||
            (rep && (rep === labelLower || rep.includes(labelLower) || labelLower.includes(rep)))
          );
        }).length;

        const clickRate = deliveredCount > 0 ? Math.round((clicks / deliveredCount) * 100) : 0;
        return {
          id: btn.id || btn.value || "",
          type: btn.type || "BUTTON",
          displayText: label,
          clicks,
          clickRate,
        };
      }),
      totalClicks: enrichedRecipients.filter((r: any) => {
        if (r.buttonClicked) return true;
        const rep = (r.replyText || "").toLowerCase().trim();
        return rawButtons.some((b: any) => {
          const l = (b.displayText || b.text || b.id || "").toLowerCase().trim();
          return l && (rep.includes(l) || l.includes(rep));
        });
      }).length,
    };

    // List Menu Analytics
    const rawMenuItems = cmp.menuData?.items || [];
    const listAnalytics = {
      hasList: rawMenuItems.length > 0 || enrichedRecipients.some(r => !!r.listItemSelected),
      sectionTitle: cmp.menuData?.sectionTitle || "Available Options",
      items: rawMenuItems.map((item: any) => {
        const itemId = (item.id || "").toLowerCase().trim();
        const itemTitle = (item.title || itemId).trim();
        const titleLower = itemTitle.toLowerCase();

        const selections = enrichedRecipients.filter((r: any) => {
          const lis = (r.listItemSelected || "").toLowerCase().trim();
          const rep = (r.replyText || "").toLowerCase().trim();
          return (
            (lis && (lis === titleLower || lis === itemId || lis.includes(titleLower) || titleLower.includes(lis))) ||
            (rep && (rep === titleLower || rep.includes(titleLower) || titleLower.includes(rep)))
          );
        }).length;

        const selectionRate = deliveredCount > 0 ? Math.round((selections / deliveredCount) * 100) : 0;
        return {
          id: item.id || "",
          title: itemTitle,
          description: item.description || "",
          selections,
          selectionRate,
        };
      }),
      totalSelections: enrichedRecipients.filter(r => !!r.listItemSelected).length,
    };

    return {
      campaign: {
        id: cmp.id,
        name: cmp.name,
        status: cmp.status,
        scheduledAt: cmp.scheduledAt,
        createdAt: cmp.createdAt,
        messageText: cmp.messageText,
        mediaUrl: cmp.mediaUrl,
        contentType: cmp.contentType,
        targetAudienceType: cmp.targetAudienceType,
        audienceNames: cmp.audienceNames,
      },
      kpis: {
        totalMessages,
        sentCount,
        pendingCount,
        pausedCount,
        cancelledCount,
        failedCount,
        invalidNumberCount,
        nonWhatsappCount,
        deliveredCount,
        readCount,
        deliveredRate: sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0,
        readRate: deliveredCount > 0 ? Math.round((readCount / deliveredCount) * 100) : 0,
        replyRate: deliveredCount > 0 ? Math.round((realReplies.length / deliveredCount) * 100) : 0,
        voteRate: deliveredCount > 0 ? Math.round((totalVotes / deliveredCount) * 100) : 0,
      },
      recipients: enrichedRecipients,
      pollAnalytics,
      buttonAnalytics,
      listAnalytics,
      replies: realReplies,
    };
  }

  async addRecipientsToSenderList(orgId: string, campaignId: string, filterType: "ALL" | "FAILED" | "NON_WHATSAPP" | "DELIVERED", targetName?: string) {
    const report = await this.getCampaignReport(campaignId);
    let filtered = report.recipients;

    if (filterType === "FAILED") {
      filtered = report.recipients.filter(r => ["FAILED", "INVALID_NUMBER", "NON_WHATSAPP"].includes(r.status));
    } else if (filterType === "NON_WHATSAPP") {
      filtered = report.recipients.filter(r => r.status === "NON_WHATSAPP");
    } else if (filterType === "DELIVERED") {
      filtered = report.recipients.filter(r => ["SENT", "DELIVERED", "READ"].includes(r.status));
    }

    const defaultAudienceName = targetName || (filterType === "FAILED" ? `Failed Retargeting - ${report.campaign.name}` : `Sender List - ${report.campaign.name}`);

    for (const rec of filtered) {
      try {
        await this.db.sql`
          INSERT INTO contacts (organization_id, phone, name, tags, updated_at)
          VALUES (${orgId || 'org-demo'}, ${rec.phone}, ${rec.name || 'Customer'}, ARRAY[${defaultAudienceName}]::text[], NOW())
          ON CONFLICT (organization_id, phone) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, contacts.name),
            tags = array_append(contacts.tags, ${defaultAudienceName}),
            updated_at = NOW()
        `;
      } catch {}
    }

    return {
      success: true,
      audienceName: defaultAudienceName,
      count: filtered.length,
      message: `Added ${filtered.length} contact(s) to "${defaultAudienceName}".`,
    };
  }

  async retryRecipient(campaignId: string, recipientId: string) {
    const cmp = this.findOne(campaignId);
    const rec = (cmp.recipients || []).find((r) => r.id === recipientId || r.phone === recipientId);
    if (!rec) {
      throw new NotFoundException(`Recipient ${recipientId} not found in campaign ${campaignId}.`);
    }

    this.logger.log(`Retrying dispatch for recipient ${rec.phone} in campaign "${cmp.name}"...`);
    rec.status = "SENDING";
    this.saveToDisk();

    try {
      const activeNumberId = cmp.whatsappNumberId || this.baileysService.getActiveSessionNumberId();
      const sendRes = await this.baileysService.sendBroadcastMessage({
        numberId: activeNumberId,
        recipientPhoneNumber: rec.phone,
        text: cmp.messageText || "Campaign Broadcast",
        mediaUrl: cmp.mediaUrl,
        pollData: (cmp as any).pollData || ((cmp as any).pollQuestion ? { question: (cmp as any).pollQuestion, options: (cmp as any).pollOptions } : undefined),
        actionButtons: (cmp as any).actionButtons || (cmp as any).buttons,
        menuData: (cmp as any).menuData,
      });

      if (sendRes.success) {
        rec.status = "DELIVERED";
        rec.messageId = sendRes.messageId;
        rec.deliveredAt = new Date();
        rec.sentAt = rec.sentAt || new Date();
        rec.errorMessage = undefined;

        this.db.sql`
          UPDATE campaign_recipients 
          SET status = 'DELIVERED', message_id = ${sendRes.messageId || null}, delivered_at = NOW(), error_message = NULL
          WHERE id = ${rec.id} OR (campaign_id = ${cmp.id} AND phone = ${rec.phone})
        `.catch(() => {});
      } else {
        rec.status = "FAILED";
        rec.errorMessage = "Dispatch failed";
      }
    } catch (err: any) {
      rec.status = "FAILED";
      rec.errorMessage = err.message || "Retry send failed";
    }

    cmp.sentCount = (cmp.recipients || []).filter(r => ["SENT", "DELIVERED", "READ"].includes(r.status)).length;
    cmp.deliveredCount = (cmp.recipients || []).filter(r => ["DELIVERED", "READ"].includes(r.status)).length;
    cmp.failedCount = (cmp.recipients || []).filter(r => r.status === "FAILED").length;
    this.saveToDisk();

    return {
      success: rec.status === "DELIVERED" || rec.status === "SENT",
      recipient: rec,
      message: (rec.status === "DELIVERED" || rec.status === "SENT") ? `Message resent successfully to ${rec.phone}!` : `Failed to resend to ${rec.phone}: ${rec.errorMessage}`,
    };
  }

  async retryFailedRecipients(campaignId: string) {
    const cmp = this.findOne(campaignId);
    const failedRecs = (cmp.recipients || []).filter(r => r.status === "FAILED");
    let successCount = 0;

    for (const rec of failedRecs) {
      const res = await this.retryRecipient(campaignId, rec.id);
      if (res.success) successCount++;
    }

    return {
      success: true,
      total: failedRecs.length,
      retriedSuccess: successCount,
      message: `Retried ${failedRecs.length} failed messages (${successCount} successful).`,
    };
  }

  async createAndLaunch(
    orgId: string,
    payload: {
      shopId?: string;
      whatsappNumberId?: string;
      sendFromInstances?: string[];
      name: string;
      targetAudienceType?: string;
      audienceNames?: string[];
      templateId?: string;
      recipients?: Array<{ id: string; phone: string; name?: string; variables?: Record<string, string> }>;
      messageText: string;
      mediaUrl?: string;
      scheduledAt?: string;
      warmupRamp?: boolean;
      batchSize?: number;
      batchPause?: number;
      textWithMediaMode?: "caption" | "separate";
      contentType?: string;
    }
  ): Promise<CampaignItem> {
    const rawRecipients = payload.recipients || [];
    const isScheduled = !!payload.scheduledAt && payload.scheduledAt.trim() !== "";
    const scheduledDate = isScheduled ? new Date(payload.scheduledAt!) : new Date();

    const activeNumberId =
      payload.whatsappNumberId ||
      this.baileysService.getActiveSessionNumberId() ||
      `num-${(orgId || "org-demo").slice(0, 8)}`;

    const recipientsList: RecipientRecord[] = rawRecipients.map((r, i) => ({
      id: r.id || `rc-${Date.now()}-${i}`,
      phone: r.phone,
      name: r.name || "Customer",
      status: "PENDING",
    }));

    const rawPollData = (payload as any).pollData;
    const rawButtons = (payload as any).actionButtons || (payload as any).buttons;
    const rawMenu = (payload as any).menuData;
    const rawMsgType = (payload as any).messageTypeOption;

    const isPoll = Boolean(rawPollData && rawPollData.options?.length > 0) || (payload as any).pollQuestion || rawMsgType?.toLowerCase().includes("poll");
    const isButton = Boolean(rawButtons && rawButtons.length > 0) || rawMsgType?.toLowerCase().includes("button");
    const isMenu = Boolean(rawMenu && rawMenu.items?.length > 0) || rawMsgType?.toLowerCase().includes("list") || rawMsgType?.toLowerCase().includes("menu");

    const msgType = rawMsgType || (isPoll ? (payload.mediaUrl ? "Poll With Media" : "Poll") : isButton ? (payload.mediaUrl ? "Button With Media" : "Button") : isMenu ? (payload.mediaUrl ? "List/Menu With Media" : "List/Menu") : (payload.mediaUrl ? "Text With Media" : "Text"));
    const contentType = isPoll ? "poll" : isButton ? "button" : isMenu ? "list" : (payload.mediaUrl ? "media" : "text");

    const newCampaign: CampaignItem & Record<string, any> = {
      id: `cmp-${Date.now()}`,
      organizationId: orgId || "org-demo",
      shopId: payload.shopId || "shop-main",
      whatsappNumberId: activeNumberId,
      templateId: payload.templateId || "tpl-custom",
      name: payload.name || "Untitled Campaign",
      targetAudienceType: payload.targetAudienceType || "MULTI_AUDIENCE",
      audienceNames: payload.audienceNames && payload.audienceNames.length > 0 ? payload.audienceNames : ["Selected Audiences"],
      scheduledAt: scheduledDate,
      status: isScheduled ? "SCHEDULED" : "PROCESSING",
      totalRecipients: Math.max(recipientsList.length, 1),
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      recipients: recipientsList,
      messageText: payload.messageText,
      mediaUrl: payload.mediaUrl,
      createdAt: new Date(),
      warmupRamp: payload.warmupRamp ?? false,
      batchSize: payload.batchSize ?? 0,
      batchPause: payload.batchPause ?? 60,
      sendFromInstances: payload.sendFromInstances || [],
      textWithMediaMode: payload.textWithMediaMode || "caption",
      contentType,
      messageType: msgType,
      pollData: rawPollData || ((payload as any).pollQuestion && (payload as any).pollOptions ? { question: (payload as any).pollQuestion, options: (payload as any).pollOptions, multiple: (payload as any).pollMultiple } : undefined),
      pollQuestion: rawPollData?.question || (payload as any).pollQuestion,
      pollOptions: rawPollData?.options || (payload as any).pollOptions,
      pollMultiple: rawPollData?.multiple ?? (payload as any).pollMultiple,
      actionButtons: rawButtons,
      buttons: rawButtons,
      menuData: rawMenu,
    };

    this.campaignsStore.set(newCampaign.id, newCampaign);
    this.saveToDisk();

    try {
      await this.db.sql`
        INSERT INTO campaigns (
          id, organization_id, whatsapp_session_id, name, target_audience_type, 
          message_text, media_url, status, scheduled_at, total_recipients, 
          sent_count, delivered_count, read_count, failed_count, created_at, updated_at,
          content_type, poll_question, poll_options, action_buttons, menu_data, poll_data
        ) VALUES (
          ${newCampaign.id}, ${newCampaign.organizationId}, ${newCampaign.whatsappNumberId}, ${newCampaign.name},
          ${newCampaign.targetAudienceType}, ${newCampaign.messageText || ''}, ${newCampaign.mediaUrl || null},
          ${newCampaign.status}, ${scheduledDate.toISOString()}, ${newCampaign.totalRecipients},
          0, 0, 0, 0, NOW(), NOW(),
          ${newCampaign.contentType || null}, ${newCampaign.pollQuestion || null},
          ${newCampaign.pollOptions ? JSON.stringify(newCampaign.pollOptions) : null}::jsonb,
          ${newCampaign.actionButtons ? JSON.stringify(newCampaign.actionButtons) : null}::jsonb,
          ${newCampaign.menuData ? JSON.stringify(newCampaign.menuData) : null}::jsonb,
          ${newCampaign.pollData ? JSON.stringify(newCampaign.pollData) : null}::jsonb
        )
      `;

      for (const rec of recipientsList) {
        await this.db.sql`
          INSERT INTO campaign_recipients (id, campaign_id, organization_id, phone, name, status, created_at)
          VALUES (${rec.id}, ${newCampaign.id}, ${newCampaign.organizationId}, ${rec.phone}, ${rec.name || 'Customer'}, 'PENDING', NOW())
          ON CONFLICT (id) DO NOTHING
        `;
      }
      this.logger.log(`Persisted campaign ${newCampaign.id} and ${recipientsList.length} recipients to Supabase.`);
    } catch (dbErr: any) {
      this.logger.warn(`Failed to save campaign to Supabase: ${dbErr.message}`);
    }

    if (!isScheduled && recipientsList.length > 0) {
      this.startLiveBaileysDispatch(newCampaign, payload.messageText, payload.mediaUrl).catch((err) => {
        this.logger.error(`Critical error in dispatch loop for ${newCampaign.id}: ${err.message}`, err.stack);
      });
    }

    this.logger.log(`Created campaign ${newCampaign.id} (${newCampaign.name}) with ${newCampaign.totalRecipients} recipients.`);
    return newCampaign;
  }

  
  public resolveSpintax(text: string): string {
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


  private async startLiveBaileysDispatch(campaign: CampaignItem & Record<string, any>, templateText: string, mediaUrl?: string) {
    if (this.activeDispatches.has(campaign.id)) {
      this.logger.log(`Dispatch loop for ${campaign.id} is already actively running. Skipping duplicate call.`);
      return;
    }

    this.activeDispatches.add(campaign.id);
    this.logger.log(`Starting live multi-instance Baileys broadcast loop for campaign ${campaign.id}...`);

    try {
      let allConnected = this.baileysService.getConnectedInstances(campaign.organizationId);

      if (allConnected.length === 0) {
        this.logger.log(`Waiting for an active WhatsApp instance socket for org ${campaign.organizationId}...`);
        const socket = await this.baileysService.waitForActiveSocket(campaign.whatsappNumberId, 25000);
        if (socket?.user?.id) {
          allConnected = this.baileysService.getConnectedInstances(campaign.organizationId);
          if (allConnected.length === 0 && campaign.whatsappNumberId) {
            allConnected = [campaign.whatsappNumberId];
          }
        }
      }

      if (allConnected.length === 0) {
        this.logger.warn(`No connected WhatsApp socket found for ${campaign.organizationId}. Pausing campaign for auto-resume upon connection.`);
        return;
      }

      // Filter by selected sendFromInstances if specified
      let activePool = allConnected;
      if (Array.isArray(campaign.sendFromInstances) && campaign.sendFromInstances.length > 0) {
        const filtered = allConnected.filter((id) => campaign.sendFromInstances.includes(id));
        if (filtered.length > 0) {
          activePool = filtered;
        }
      }

      this.logger.log(`[Load Balancer] Distributing campaign ${campaign.id} across ${activePool.length} active instance(s): ${activePool.join(", ")}`);

      // Load master broadcast settings and unsubscriber rules for this organization
      const globalSettings = await this.settingsService.getSettings(campaign.organizationId);
      const unsubSettings = await this.unsubscribersService.getSettings(campaign.organizationId);
      const unsubscribedPhones = await this.unsubscribersService.getUnsubscribedPhonesSet(campaign.organizationId);

      const switchAfter = Math.max(1, globalSettings.switchAccountAfter || 1);
      const defaultPrefix = (globalSettings.defaultCountryCode || "91").replace(/\D/g, "") || "91";

      for (let i = 0; i < campaign.recipients!.length; i++) {
        if (campaign.status === "PAUSED" || campaign.status === "CANCELLED") {
          this.logger.log(`Campaign ${campaign.id} is ${campaign.status}. Stopping dispatch loop.`);
          this.saveToDisk();
          return;
        }

        // Delivery Time Window Safeguard (e.g. 10:00 AM to 07:00 PM)
        if (globalSettings.deliveryWindowEnabled) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [startH, startM] = (globalSettings.deliveryWindowStart || "10:00").split(":").map(Number);
          const [endH, endM] = (globalSettings.deliveryWindowEnd || "19:00").split(":").map(Number);
          const startMinutes = (startH || 10) * 60 + (startM || 0);
          const endMinutes = (endH || 19) * 60 + (endM || 0);

          if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
            this.logger.warn(`[Delivery Window] Current time is outside active business hours (${globalSettings.deliveryWindowStart} - ${globalSettings.deliveryWindowEnd}). Pausing campaign ${campaign.id} until active window.`);
            campaign.status = "PAUSED";
            this.saveToDisk();
            return;
          }
        }

        const rec = campaign.recipients![i];

        if (rec.status === "DELIVERED" || rec.status === "READ" || (rec.status === "FAILED" && rec.errorMessage?.includes("not registered on WhatsApp"))) {
          continue;
        }

        // Strict Unsubscriber / Opt-Out Never-Send Safeguard
        const cleanDigits = (rec.phone || "").replace(/\D/g, "");
        if (unsubscribedPhones.has(cleanDigits) || (cleanDigits.length > 10 && unsubscribedPhones.has(cleanDigits.slice(-10)))) {
          this.logger.log(`Skipping broadcast for ${rec.phone} (Recipient is in Unsubscribers opt-out list)`);
          rec.status = "FAILED";
          rec.errorMessage = "Recipient opted out (Unsubscribed)";
          (rec as any).failureCategory = "UNSUBSCRIBED";
          campaign.failedCount = (campaign.recipients || []).filter(r => r.status === "FAILED").length;
          this.db.sql`
            UPDATE campaign_recipients 
            SET status = 'FAILED', error_message = 'Recipient opted out (Unsubscribed)'
            WHERE id = ${rec.id}
          `.catch(() => {});
          this.saveToDisk();
          continue;
        }

        rec.status = "SENDING";
        this.saveToDisk();

        const currentPool = this.baileysService.getConnectedInstances(campaign.organizationId);
        const viablePool = currentPool.length > 0 ? currentPool : activePool;
        
        // Smart Daily Cap Safeguard: Check daily limits for all numbers (Fresh: progressive 50-500, Matured: 500/day)
        const allInstanceRecords = await this.baileysService.getInstances(campaign.organizationId);
        const eligibleInstances = viablePool.filter((instId) => {
          const instRec = allInstanceRecords.find((r) => r.id === instId);
          if (!instRec) return true;
          const limit = instRec.dailyLimit || (instRec.accountMaturityType === "FRESH" ? 50 : 500);
          return (instRec.dailySentToday || 0) < limit;
        });

        const dispatchPool = eligibleInstances.length > 0 ? eligibleInstances : viablePool;
        // Multi-Account Switch After X messages
        const instanceIdx = Math.floor(i / switchAfter) % dispatchPool.length;
        const targetInstanceId = dispatchPool[instanceIdx];

        // Auto-prepend default country code if missing (e.g. 10 digit local phone)
        let formattedPhone = (rec.phone || "").replace(/\D/g, "");
        if (formattedPhone.length === 10) {
          formattedPhone = defaultPrefix + formattedPhone;
          rec.phone = formattedPhone;
        }

        // 1. Personalized variables substitution with comprehensive real data mapping
        const formattedPhoneDisplay = rec.phone ? (rec.phone.startsWith("+") ? rec.phone : "+" + rec.phone) : "+91 98765 43210";
        let textToSend = (templateText || campaign.messageText || "")
          .replace(/\{\{name\}\}/gi, rec.name || "Valued Customer")
          .replace(/\{\{customer_name\}\}/gi, rec.name || "Valued Customer")
          .replace(/\{\{whatsapp_name\}\}/gi, rec.name || "Valued Customer")
          .replace(/\{\{phone\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{whatsapp_number\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{mobile\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{number\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{shop_name\}\}/gi, "Dhaba Opticals")
          .replace(/\{\{business_name\}\}/gi, "Dhaba Opticals")
          .replace(/\{\{city\}\}/gi, (rec as any).city || "Main City")
          .replace(/\{\{location\}\}/gi, (rec as any).city || "Main City")
          .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"))
          .replace(/\{\{today\}\}/gi, new Date().toLocaleDateString("en-GB"))
          .replace(/\{\{voucher_code\}\}/gi, "FESTIVAL20")
          .replace(/\{\{coupon_code\}\}/gi, "FESTIVAL20")
          .replace(/\{\{discount\}\}/gi, "20%");

        if ((rec as any).variables) {
          const vObj = (rec as any).variables;
          Object.keys(vObj).forEach((vKey) => {
            const regex = new RegExp(`\\{\\{${vKey}\\}\\}`, "gi");
            textToSend = textToSend.replace(regex, vObj[vKey] || "");
          });
        }

        for (let vIdx = 1; vIdx <= 7; vIdx++) {
          const vVal = (rec as any)[`var${vIdx}`];
          if (vVal) {
            textToSend = textToSend.replace(new RegExp(`\\{\\{var${vIdx}\\}\\}`, "gi"), String(vVal));
          }
        }

        // 2. Anti-Ban Spintax Resolution
        textToSend = this.resolveSpintax(textToSend);

        // 3. Automated Opt-Out Disclaimer Appending in Italic Format (when enabled)
        if (unsubSettings.enabled && unsubSettings.optoutText) {
          let optoutDisclaimer = unsubSettings.optoutText.trim();
          // Ensure enclosed in WhatsApp italic syntax (_..._)
          if (!optoutDisclaimer.startsWith("_") && !optoutDisclaimer.endsWith("_")) {
            optoutDisclaimer = `_${optoutDisclaimer}_`;
          }
          if (optoutDisclaimer && !textToSend.includes(optoutDisclaimer)) {
            textToSend = textToSend.trim() + "\n\n" + optoutDisclaimer;
          }
        }

        const pollPayload = (campaign.pollData && campaign.pollData.options?.length > 0)
          ? {
              question: this.resolveSpintax(campaign.pollData.question),
              options: (campaign.pollData.options || []).map((o: string) => this.resolveSpintax(o)),
              multiple: campaign.pollData.multiple,
            }
          : (campaign.pollQuestion && campaign.pollOptions?.length > 0)
          ? {
              question: this.resolveSpintax(campaign.pollQuestion),
              options: (campaign.pollOptions || []).map((o: string) => this.resolveSpintax(o)),
              multiple: campaign.pollMultiple,
            }
          : undefined;

        const broadcastOptions = {
          numberId: targetInstanceId,
          recipientPhoneNumber: rec.phone,
          text: textToSend,
          mediaUrl: mediaUrl || campaign.mediaUrl,
          messageType: campaign.messageType || campaign.contentType,
          pollData: pollPayload,
          actionButtons: campaign.actionButtons,
          menuData: campaign.menuData,
          textWithMediaMode: campaign.textWithMediaMode,
        };

        try {
          const cleanDigits = (rec.phone || "").replace(/\D/g, "");
          if (cleanDigits.length < 10) {
            rec.status = "INVALID_NUMBER";
            rec.errorMessage = "Invalid phone number format (less than 10 digits)";
            campaign.failedCount = campaign.recipients!.filter((r) => ["FAILED", "INVALID_NUMBER", "NON_WHATSAPP"].includes(r.status)).length;
            this.db.sql`
              UPDATE campaign_recipients 
              SET status = 'INVALID_NUMBER', error_message = ${rec.errorMessage}
              WHERE id = ${rec.id}
            `.catch(() => {});
            this.saveToDisk();
            continue;
          }

          let result;
          try {
            result = await this.baileysService.sendBroadcastMessage(broadcastOptions);
          } catch (firstErr: any) {
            if (firstErr.message?.includes("not registered on WhatsApp") || firstErr.message?.toLowerCase().includes("non whatsapp") || firstErr.message?.includes("Invalid recipient phone number")) {
              throw firstErr;
            }
            this.logger.warn(`Dispatch attempt on instance ${targetInstanceId} failed for ${rec.phone} (${firstErr.message}). Retrying with pool...`);
            const fallbackInstance = dispatchPool[(i + 1) % dispatchPool.length];
            result = await this.baileysService.sendBroadcastMessage({
              ...broadcastOptions,
              numberId: fallbackInstance,
            });
          }

          if (result && result.success) {
            rec.messageId = result.messageId;
            rec.status = "DELIVERED";
            rec.sentAt = new Date();
            rec.deliveredAt = new Date();
            rec.errorMessage = undefined;

            // Record send count in DB for warmup daily cap tracking
            this.baileysService.recordInstanceMessageSent(targetInstanceId).catch(() => {});

            campaign.sentCount = campaign.recipients!.filter(
              (r) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ"
            ).length;
            campaign.deliveredCount = campaign.recipients!.filter(
              (r) => r.status === "DELIVERED" || r.status === "READ"
            ).length;
            campaign.readCount = campaign.recipients!.filter((r) => r.status === "READ").length;

            this.db.sql`
              UPDATE campaign_recipients 
              SET status = 'DELIVERED', message_id = ${result.messageId}, sent_at = NOW(), delivered_at = NOW(), error_message = NULL
              WHERE id = ${rec.id}
            `.catch(() => {});

            this.logger.log(`[Broadcast via ${targetInstanceId}] DELIVERED to ${rec.phone} (Msg ID: ${result.messageId}) [${i + 1}/${campaign.recipients!.length}]`);
          } else {
            rec.status = "FAILED";
            rec.errorMessage = "Failed to deliver message via WhatsApp device.";
            campaign.failedCount = campaign.recipients!.filter((r) => ["FAILED", "INVALID_NUMBER", "NON_WHATSAPP"].includes(r.status)).length;

            this.db.sql`
              UPDATE campaign_recipients 
              SET status = 'FAILED', error_message = 'Failed to deliver message'
              WHERE id = ${rec.id}
            `.catch(() => {});
          }
        } catch (err: any) {
          const errMsg = err.message || "";
          if (errMsg.includes("not registered on WhatsApp") || errMsg.toLowerCase().includes("non whatsapp")) {
            rec.status = "NON_WHATSAPP";
            rec.errorMessage = "Recipient number is not registered on WhatsApp";
          } else if (errMsg.includes("Invalid recipient phone number") || errMsg.includes("10 digits")) {
            rec.status = "INVALID_NUMBER";
            rec.errorMessage = "Invalid phone number format (less than 10 digits)";
          } else {
            rec.status = "FAILED";
            rec.errorMessage = errMsg || "WhatsApp device disconnected or number unreachable.";
          }

          campaign.failedCount = campaign.recipients!.filter((r) => ["FAILED", "INVALID_NUMBER", "NON_WHATSAPP"].includes(r.status)).length;

          this.db.sql`
            UPDATE campaign_recipients 
            SET status = ${rec.status}, error_message = ${rec.errorMessage}
            WHERE id = ${rec.id}
          `.catch(() => {});
          this.logger.warn(`Dispatch status for ${rec.phone}: ${rec.status} (${rec.errorMessage})`);
        }

        this.saveToDisk();

        this.db.sql`
          UPDATE campaigns 
          SET sent_count = ${campaign.sentCount}, delivered_count = ${campaign.deliveredCount}, read_count = ${campaign.readCount}, failed_count = ${campaign.failedCount}, updated_at = NOW()
          WHERE id = ${campaign.id}
        `.catch(() => {});

        // Pacing & Anti-Ban delays (Global Settings & Human Jitter)
        if (i < campaign.recipients!.length - 1) {
          const minSec = Math.max(1, globalSettings.minDelaySec || 15);
          const maxSec = Math.max(minSec, globalSettings.maxDelaySec || 20);

          let delayMs = (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;

          // Number Warmup Ramp (First ~30% sends use up to 1.5x delay)
          const isWarmupPhase = Boolean(campaign.warmupRamp) && (i < campaign.recipients!.length * 0.3);
          if (isWarmupPhase) {
            delayMs = Math.round(delayMs * 1.5);
          }

          // 1. Sleep Mode Check (from Settings -> Sleep Mode)
          if (globalSettings.sleepEnabled && globalSettings.sleepAfterMessages > 0 && (i + 1) % globalSettings.sleepAfterMessages === 0) {
            const sleepSec = Math.max(1, globalSettings.sleepForSeconds || 10);
            this.logger.log(`[Sleep Mode] Reached ${globalSettings.sleepAfterMessages} messages. Sleeping for ${sleepSec}s before resuming...`);
            await new Promise((resolve) => setTimeout(resolve, sleepSec * 1000));
          }
          // 2. Custom Batch Pause (from Campaign Composer override if configured)
          else if (Number(campaign.batchSize) > 0 && (i + 1) % Number(campaign.batchSize) === 0) {
            const batchPauseSec = Number(campaign.batchPause) || 60;
            this.logger.log(`[Batch Pacing] Reached batch of ${campaign.batchSize}. Pausing ${batchPauseSec}s before resuming...`);
            await new Promise((resolve) => setTimeout(resolve, batchPauseSec * 1000));
          }
          // 3. Regular Human Anti-Ban Jitter
          else {
            this.logger.log(`[Anti-Ban Jitter] Account ${targetInstanceId} applying ${Math.round(delayMs / 1000)}s dynamic delay (${minSec}s - ${maxSec}s window)...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      const hasPending = campaign.recipients!.some((r) => r.status === "PENDING" || r.status === "SENDING");
      if (!hasPending && campaign.status === "PROCESSING") {
        campaign.status = "COMPLETED";

        this.db.sql`
          UPDATE campaigns SET status = 'COMPLETED', updated_at = NOW() WHERE id = ${campaign.id}
        `.catch(() => {});
      }
      this.saveToDisk();
      this.logger.log(`Completed multi-instance Baileys broadcast campaign ${campaign.id}! ${campaign.deliveredCount} delivered, ${campaign.failedCount} failed.`);
    } finally {
      this.activeDispatches.delete(campaign.id);
    }
  }

  async pauseCampaign(id: string): Promise<CampaignItem> {
    const cmp = this.findOne(id);
    cmp.status = "PAUSED";
    this.saveToDisk();
    try {
      await this.db.sql`UPDATE campaigns SET status = 'PAUSED', updated_at = NOW() WHERE id = ${id}`;
    } catch {}
    this.logger.log(`Paused campaign ${id}`);
    return cmp;
  }

  async resumeCampaign(id: string, fallbackData?: any): Promise<CampaignItem> {
    let cmp = this.campaignsStore.get(id);

    if (!cmp && fallbackData) {
      this.syncFromFrontend(fallbackData.organizationId || "org-demo", [fallbackData]);
      cmp = this.campaignsStore.get(id);
    }

    if (!cmp) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }

    (cmp.recipients || []).forEach((r) => {
      if (r.status === "FAILED" && !r.errorMessage?.includes("not registered on WhatsApp")) {
        r.status = "PENDING";
      }
    });

    cmp.status = "PROCESSING";
    this.saveToDisk();
    try {
      await this.db.sql`UPDATE campaigns SET status = 'PROCESSING', updated_at = NOW() WHERE id = ${id}`;
    } catch {}
    this.logger.log(`Resumed campaign ${id} (${cmp.name})`);

    if (!this.activeDispatches.has(id)) {
      this.startLiveBaileysDispatch(cmp, cmp.messageText || "", cmp.mediaUrl).catch((err) => {
        this.logger.error(`Error in resumed dispatch loop for ${id}: ${err.message}`);
      });
    }

    return cmp;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const exists = this.campaignsStore.has(id);
    if (exists) {
      this.campaignsStore.delete(id);
      this.saveToDisk();
      try {
        await this.db.sql`DELETE FROM campaigns WHERE id = ${id}`;
      } catch {}
      this.logger.log(`Deleted campaign ${id}`);
      return true;
    }
    return false;
  }
}
