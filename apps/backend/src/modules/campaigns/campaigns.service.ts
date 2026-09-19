import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { WhatsAppSessionManagerService, IncomingResponseEvent } from "../whatsapp-session/whatsapp-session.service";
import { DatabaseService } from "../../database/database.service";
import { SettingsService } from "../settings/settings.service";
import { normalizePublicMediaUrl } from "../media/media-url.utils";
import { WabaService } from "../waba/waba.service";
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
  variables?: Record<string, string>;
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
  pauseReason?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  recipients?: RecipientRecord[];
  messageText?: string;
  mediaUrl?: string;
  contentType?: string;
  pollQuestion?: string;
  createdAt: Date;
  // WABA Fields
  channelType?: "WABA" | "BAILEYS";
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
  variableMappings?: Record<string, string>;
  headerMediaUrl?: string;
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
    private readonly unsubscribersService: UnsubscribersService,
    private readonly wabaService: WabaService
  ) {}

  async onModuleInit() {
    await this.loadFromDatabase();
    this.loadFromDisk();

    this.baileysService.addOnConnectedListener((numberId, orgId) => {
      this.logger.log(`WhatsApp connection confirmed active for ${numberId} (org: ${orgId}). Checking for campaigns to auto-resume...`);
      this.autoResumePendingCampaigns(orgId);
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

        if (cmp.channelType === "WABA" || cmp.metaTemplateName) {
          this.startLiveWabaDispatch(cmp).catch((err) => {
            this.logger.error(`[Scheduler] Failed to dispatch scheduled WABA campaign ${cmp.id}: ${err.message}`);
          });
        } else {
          this.startLiveBaileysDispatch(cmp, cmp.messageText || "", cmp.mediaUrl).catch((err) => {
            this.logger.error(`[Scheduler] Failed to dispatch scheduled campaign ${cmp.id}: ${err.message}`);
          });
        }
      }
    }
  }

  private async loadFromDatabase() {
    try {
      const rows = await this.db.sql`
        SELECT * FROM campaigns WHERE created_at IS NOT NULL ORDER BY created_at DESC LIMIT 100
      `;

      if (rows && rows.length > 0) {
        for (const r of rows) {
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
            pauseReason: r.pause_reason || undefined,
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
            channelType: r.channel_type || (r.meta_template_name ? "WABA" : "BAILEYS"),
            metaTemplateName: r.meta_template_name || undefined,
            metaTemplateLanguage: r.meta_template_language || undefined,
            variableMappings: parseJson(r.variable_mappings),
            headerMediaUrl: r.header_media_url || undefined,
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
    const eventTime = event.timestamp || new Date();
    this.logger.log(`[CampaignsService] Processing incoming ${event.type} from ${rawClean} (Phone10: ${cleanJidPhone10}, Value: "${event.value}")`);

    // 1. Find the target campaign: Prioritize exact quoted message, otherwise find latest campaign sent to this number
    const sortedCampaigns = Array.from(this.campaignsStore.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    let targetCmp: any = null;
    let targetRec: RecipientRecord | null = null;

    for (const cmp of sortedCampaigns) {
      if (!cmp.recipients || cmp.recipients.length === 0) continue;

      for (const rec of cmp.recipients) {
        const cleanRecPhone10 = (rec.phone || "").replace(/\D/g, "").slice(-10);
        const isQuotedMatch = Boolean(event.quotedMsgId && rec.messageId && rec.messageId === event.quotedMsgId);
        const isPhoneMatch = Boolean(cleanJidPhone10 && cleanRecPhone10 && cleanJidPhone10 === cleanRecPhone10);

        if (isQuotedMatch) {
          targetCmp = cmp;
          targetRec = rec;
          break;
        } else if (!targetRec && isPhoneMatch) {
          const recSentTime = rec.sentAt ? new Date(rec.sentAt).getTime() : new Date(cmp.createdAt || 0).getTime();
          // Only associate if the campaign was sent before or at the time this reply arrived
          if (recSentTime <= eventTime.getTime() + 10 * 1000) {
            targetCmp = cmp;
            targetRec = rec;
            break;
          }
        }
      }
      if (targetRec) break;
    }

    if (targetCmp && targetRec) {
      targetRec.status = "READ";
      targetRec.readAt = targetRec.readAt || eventTime;
      targetRec.deliveredAt = targetRec.deliveredAt || eventTime;

      if (event.type === "POLL_VOTE") {
        targetRec.pollVote = event.value || event.pollVote || "Voted";
        targetRec.pollVotedAt = eventTime;
        this.logger.log(`[Poll Response] Recorded vote for ${targetRec.phone} in "${targetCmp.name}": "${targetRec.pollVote}"`);
      } else if (event.type === "BUTTON") {
        targetRec.buttonClicked = event.buttonTitle || event.buttonId || event.value;
        targetRec.buttonClickedAt = eventTime;
        targetRec.replyText = `🔘 ${targetRec.buttonClicked}`;
        targetRec.repliedAt = eventTime;
        this.logger.log(`[Button Response] Recorded click for ${targetRec.phone} in "${targetCmp.name}": "${targetRec.buttonClicked}"`);
      } else if (event.type === "LIST") {
        targetRec.listItemSelected = event.listTitle || event.listId || event.value;
        targetRec.replyText = `📋 ${targetRec.listItemSelected}`;
        targetRec.repliedAt = eventTime;
        this.logger.log(`[List Response] Recorded selection for ${targetRec.phone} in "${targetCmp.name}": "${targetRec.listItemSelected}"`);
      } else {
        targetRec.replyText = event.value;
        targetRec.repliedAt = eventTime;
        this.logger.log(`[Chat Reply] Recorded reply for ${targetRec.phone} in "${targetCmp.name}": "${targetRec.replyText}"`);

        // Check button match
        const rawButtons = (targetCmp as any).actionButtons || (targetCmp as any).buttons || [];
        const matchingBtn = rawButtons.find((b: any) => {
          const label = (b.displayText || b.text || b.id || "").toLowerCase().trim();
          const val = (event.value || "").toLowerCase().trim();
          return label === val || (val && label.includes(val)) || (label && val.includes(label));
        });
        if (matchingBtn && !targetRec.buttonClicked) {
          targetRec.buttonClicked = matchingBtn.displayText || matchingBtn.text || matchingBtn.id;
          targetRec.buttonClickedAt = eventTime;
        }

        // Check menu match
        const rawMenuItems = (targetCmp as any).menuData?.items || [];
        const matchingMenuItem = rawMenuItems.find((m: any) => {
          const title = (m.title || m.id || "").toLowerCase().trim();
          const val = (event.value || "").toLowerCase().trim();
          return title === val || (val && title.includes(val)) || (title && val.includes(title));
        });
        if (matchingMenuItem && !targetRec.listItemSelected) {
          targetRec.listItemSelected = matchingMenuItem.title || matchingMenuItem.id;
        }

        // Check poll match
        const pollOptions = (targetCmp as any).pollOptions || [];
        const matchingPollOpt = pollOptions.find((opt: string) => {
          const optNorm = opt.toLowerCase().trim();
          const val = (event.value || "").toLowerCase().trim();
          return optNorm === val || (val && optNorm.includes(val)) || (optNorm && val.includes(optNorm));
        });
        if (matchingPollOpt && !targetRec.pollVote) {
          targetRec.pollVote = matchingPollOpt;
          targetRec.pollVotedAt = eventTime;
        }
      }

      // Strictly persist ONLY this recipient row in Postgres
      this.db.sql`
        UPDATE campaign_recipients
        SET 
          status = 'READ',
          read_at = COALESCE(read_at, ${eventTime.toISOString()}::timestamptz),
          delivered_at = COALESCE(delivered_at, ${eventTime.toISOString()}::timestamptz),
          poll_vote = COALESCE(${targetRec.pollVote || null}, poll_vote),
          poll_voted_at = COALESCE(${targetRec.pollVotedAt ? targetRec.pollVotedAt.toISOString() : null}::timestamptz, poll_voted_at),
          reply_text = COALESCE(${targetRec.replyText || null}, reply_text),
          replied_at = COALESCE(${targetRec.repliedAt ? targetRec.repliedAt.toISOString() : null}::timestamptz, replied_at),
          button_clicked = COALESCE(${targetRec.buttonClicked || null}, button_clicked),
          button_clicked_at = COALESCE(${targetRec.buttonClickedAt ? targetRec.buttonClickedAt.toISOString() : null}::timestamptz, button_clicked_at)
        WHERE id = ${targetRec.id}
      `.catch((err) => {
        this.logger.debug(`Failed to update campaign_recipients in DB: ${err.message}`);
      });

      targetCmp.sentCount = (targetCmp.recipients || []).filter(
        (r: any) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ"
      ).length;
      targetCmp.deliveredCount = (targetCmp.recipients || []).filter(
        (r: any) => r.status === "DELIVERED" || r.status === "READ"
      ).length;
      targetCmp.readCount = (targetCmp.recipients || []).filter((r: any) => r.status === "READ").length;

      this.saveToDisk();

      this.db.sql`
        UPDATE campaigns 
        SET sent_count = ${targetCmp.sentCount}, delivered_count = ${targetCmp.deliveredCount}, read_count = ${targetCmp.readCount}, updated_at = NOW()
        WHERE id = ${targetCmp.id}
      `.catch(() => {});
    } else {
      // Database Fallback: Find the most recent broadcast sent to this number before or at reply time
      (async () => {
        try {
          const dbMatches = await this.db.sql`
            SELECT cr.id, cr.campaign_id, cr.phone, cr.name, cr.sent_at, c.created_at as camp_created_at
            FROM campaign_recipients cr
            JOIN campaigns c ON c.id = cr.campaign_id
            WHERE RIGHT(REGEXP_REPLACE(cr.phone, '\\D', '', 'g'), 10) = ${cleanJidPhone10}
              AND (cr.sent_at IS NOT NULL OR c.created_at <= ${eventTime.toISOString()}::timestamptz)
            ORDER BY COALESCE(cr.sent_at, c.created_at) DESC
            LIMIT 1
          `;
          if (dbMatches && dbMatches.length > 0) {
            const matchRow = dbMatches[0];
            await this.db.sql`
              UPDATE campaign_recipients
              SET 
                status = 'READ',
                read_at = COALESCE(read_at, ${eventTime.toISOString()}::timestamptz),
                delivered_at = COALESCE(delivered_at, ${eventTime.toISOString()}::timestamptz),
                poll_vote = COALESCE(${event.type === 'POLL_VOTE' ? (event.value || 'Voted') : null}, poll_vote),
                poll_voted_at = CASE WHEN ${event.type === 'POLL_VOTE'} THEN ${eventTime.toISOString()}::timestamptz ELSE poll_voted_at END,
                reply_text = ${event.value},
                replied_at = ${eventTime.toISOString()}::timestamptz,
                button_clicked = COALESCE(${event.type === 'BUTTON' ? (event.buttonTitle || event.buttonId || event.value) : null}, button_clicked),
                button_clicked_at = CASE WHEN ${event.type === 'BUTTON'} THEN ${eventTime.toISOString()}::timestamptz ELSE button_clicked_at END
              WHERE id = ${matchRow.id}
            `;
            
            await this.db.sql`
              UPDATE campaigns 
              SET read_count = read_count + 1, updated_at = NOW()
              WHERE id = ${matchRow.campaign_id}
            `.catch(() => {});
          }
        } catch (err: any) {
          this.logger.debug(`DB campaign reply update note: ${err.message}`);
        }
      })();
    }
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

  autoResumePendingCampaigns(targetOrgId?: string) {
    for (const cmp of this.campaignsStore.values()) {
      if (targetOrgId && cmp.organizationId && cmp.organizationId !== targetOrgId) {
        continue;
      }

      // Do NOT auto-resume if user manually paused it
      if ((cmp as any).manualUserPause) continue;

      // If paused due to delivery window, only auto-resume when window opens
      if ((cmp as any).pauseReason === "PAUSED_OUTSIDE_DELIVERY_WINDOW") {
        const tz = "Asia/Kolkata";
        const currentMinutes = this.getLocalTimeMinutes(tz);
        const [startH, startM] = ["10", "00"].map(Number);
        const [endH, endM] = ["19", "00"].map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
          continue; // still outside delivery window
        }
      }

      const connected = this.baileysService.getConnectedInstances(cmp.organizationId);
      if (connected.length === 0) continue;

      const isAutoPaused = cmp.status === "PAUSED" && ((cmp as any).pauseReason === "AUTO_PAUSED_DEVICE_DISCONNECTED" || (cmp as any).pauseReason === "PAUSED_OUTSIDE_DELIVERY_WINDOW" || !(cmp as any).manualUserPause);
      const isProcessing = cmp.status === "PROCESSING";

      if ((isAutoPaused || isProcessing) && !this.activeDispatches.has(cmp.id)) {
        const hasPendingRecipients = (cmp.recipients || []).some(
          (r) => r.status === "PENDING" || r.status === "QUEUED" || r.status === "SENDING" || (r.status === "FAILED" && r.errorMessage?.includes("not connected"))
        );

        if (hasPendingRecipients) {
          // Re-queue any recipients that had falsely failed due to disconnected device
          (cmp.recipients || []).forEach((r) => {
            if (r.status === "FAILED" && (r.errorMessage?.includes("not connected") || r.errorMessage?.includes("disconnected"))) {
              r.status = "PENDING";
              r.errorMessage = undefined;
            }
          });

          cmp.status = "PROCESSING";
          (cmp as any).pauseReason = undefined;
          this.saveToDisk();

          this.db.sql`
            UPDATE campaigns SET status = 'PROCESSING', pause_reason = NULL, updated_at = NOW() WHERE id = ${cmp.id}
          `.catch(() => {});

          this.logger.log(`[Auto-Resume] Resuming campaign "${cmp.name}" (${cmp.id}) across connected WhatsApp instances: ${connected.join(", ")}...`);
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
          this.baileysService.getActiveSessionNumberId(orgId) ||
          `num-${(orgId || "tenant").slice(0, 8)}`;

        const recs: RecipientRecord[] = (item.recipients || []).map((r: any, idx: number) => ({
          id: r.id || `rc-sync-${idx}`,
          phone: r.phone,
          name: r.name || "Customer",
          status: r.status || "PENDING",
          errorMessage: r.errorMessage,
        }));

        const newCmp: CampaignItem = {
          id: item.id,
          organizationId: orgId,
          shopId: item.shopId || "shop-main",
          whatsappNumberId: activeNumberId,
          templateId: item.templateId || "tpl-custom",
          name: item.name || "Campaign",
          targetAudienceType: item.targetAudienceType || "MULTI_AUDIENCE",
          audienceNames: item.audienceNames || ["Selected Segment"],
          scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : new Date(),
          status: item.status || "PROCESSING",
          pauseReason: item.pauseReason || undefined,
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
    const targetOrg = (orgId || "").trim();
    if (!targetOrg) return [];
    const list = Array.from(this.campaignsStore.values()).filter(
      (c) => Boolean(c && c.id && c.organizationId === targetOrg)
    );
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  findOne(orgId: string, id: string): CampaignItem {
    const cmp = this.campaignsStore.get(id);
    if (!cmp || cmp.organizationId !== orgId) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }
    return cmp;
  }

  getRecipients(orgId: string, campaignId: string): RecipientRecord[] {
    const cmp = this.campaignsStore.get(campaignId);
    if (!cmp || cmp.organizationId !== orgId) {
      throw new NotFoundException(`Campaign ${campaignId} not found.`);
    }
    return cmp.recipients || [];
  }

  async getCampaignReport(orgId: string, campaignId: string) {
    let cmp = this.campaignsStore.get(campaignId) as any;
    if (!cmp) {
      try {
        const rows = await this.db.sql`SELECT * FROM campaigns WHERE id = ${campaignId} AND organization_id = ${orgId} LIMIT 1`;
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
            pauseReason: r.pause_reason || undefined,
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
            channelType: r.channel_type || (r.meta_template_name ? "WABA" : "BAILEYS"),
            metaTemplateName: r.meta_template_name || undefined,
            metaTemplateLanguage: r.meta_template_language || undefined,
            variableMappings: parseJson(r.variable_mappings),
            headerMediaUrl: r.header_media_url || undefined,
          };
          this.campaignsStore.set(cmp.id, cmp);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to fetch campaign ${campaignId} from DB: ${err.message}`);
      }
    }

    if (!cmp || cmp.organizationId !== orgId) {
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

    // Merge incoming messages into recipients ONLY IF the message was created on or after this campaign broadcast was sent!
    for (const rec of rawRecipients) {
      const rec10 = (rec.phone || "").replace(/\D/g, "").slice(-10);
      const recSentTime = rec.sentAt ? new Date(rec.sentAt).getTime() : (cmp.createdAt ? new Date(cmp.createdAt).getTime() : 0);

      // Strict temporal match: Only incoming messages received AFTER this campaign broadcast was sent (with 10s grace period)
      const match = incomingChatMsgs.find((m: any) => {
        const m10 = (m.phone || "").replace(/\D/g, "").slice(-10);
        const mTime = new Date(m.created_at).getTime();
        return m10 === rec10 && mTime >= (recSentTime - 10 * 1000);
      });

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

    const connectedSession = this.baileysService.getSessionStatus(cmp.organizationId, cmp.whatsappNumberId);
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
      const rec = enrichedRecipients.find((r) => (r.phone || "").replace(/\D/g, "").slice(-10) === m10);
      const recSentTime = rec?.sentAt ? new Date(rec.sentAt).getTime() : (cmp.createdAt ? new Date(cmp.createdAt).getTime() : 0);
      const mTime = new Date(m.created_at).getTime();

      // Only add to replies if message arrived AFTER the broadcast was sent to this recipient
      if (mTime >= (recSentTime - 10 * 1000) && !repliesMap.has(m10)) {
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
        pauseReason: cmp.pauseReason || (cmp as any).pauseReason,
        scheduledAt: cmp.scheduledAt,
        createdAt: cmp.createdAt,
        messageText: cmp.messageText,
        mediaUrl: cmp.mediaUrl,
        contentType: cmp.contentType,
        targetAudienceType: cmp.targetAudienceType,
        audienceNames: cmp.audienceNames,
        channelType: cmp.channelType || (cmp.metaTemplateName ? "WABA" : "BAILEYS"),
        metaTemplateName: cmp.metaTemplateName,
        metaTemplateLanguage: cmp.metaTemplateLanguage,
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
    const report = await this.getCampaignReport(orgId, campaignId);
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
          VALUES (${orgId}, ${rec.phone}, ${rec.name || 'Customer'}, ARRAY[${defaultAudienceName}]::text[], NOW())
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

  async retryRecipient(orgId: string, campaignId: string, recipientId: string) {
    const cmp = this.findOne(orgId, campaignId);
    const rec = (cmp.recipients || []).find((r) => r.id === recipientId || r.phone === recipientId);
    if (!rec) {
      throw new NotFoundException(`Recipient ${recipientId} not found in campaign ${campaignId}.`);
    }

    this.logger.log(`Retrying dispatch for recipient ${rec.phone} in campaign "${cmp.name}"...`);
    rec.status = "SENDING";
    this.saveToDisk();

    try {
      const activeNumberId = cmp.whatsappNumberId || this.baileysService.getActiveSessionNumberId(cmp.organizationId);
      const sendRes = await this.baileysService.sendBroadcastMessage({
        numberId: activeNumberId,
        orgId: cmp.organizationId,
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

  async retryFailedRecipients(orgId: string, campaignId: string) {
    const cmp = this.findOne(orgId, campaignId);
    const failedRecs = (cmp.recipients || []).filter(r => r.status === "FAILED");
    let successCount = 0;

    for (const rec of failedRecs) {
      const res = await this.retryRecipient(orgId, campaignId, rec.id);
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
      messageText?: string;
      mediaUrl?: string;
      scheduledAt?: string;
      warmupRamp?: boolean;
      batchSize?: number;
      batchPause?: number;
      textWithMediaMode?: "caption" | "separate";
      contentType?: string;
      channelType?: "WABA" | "BAILEYS";
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      variableMappings?: Record<string, string>;
      headerMediaUrl?: string;
    }
  ): Promise<CampaignItem> {
    const rawRecipients = payload.recipients || [];
    const isScheduled = !!payload.scheduledAt && payload.scheduledAt.trim() !== "";
    const scheduledDate = isScheduled ? new Date(payload.scheduledAt!) : new Date();

    const activeNumberId =
      payload.whatsappNumberId ||
      this.baileysService.getActiveSessionNumberId(orgId) ||
      `num-${(orgId || "tenant").slice(0, 8)}`;

    const recipientsList: RecipientRecord[] = rawRecipients.map((r, i) => ({
      id: r.id || `rc-${Date.now()}-${i}`,
      phone: r.phone,
      name: r.name || "Customer",
      status: "PENDING",
      variables: r.variables || {},
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

    const channelType = (payload as any).channelType || ((payload as any).metaTemplateName ? "WABA" : "WABA");
    const metaTemplateName = (payload as any).metaTemplateName || null;
    const metaTemplateLanguage = (payload as any).metaTemplateLanguage || "en_US";
    const variableMappings = (payload as any).variableMappings || {};
    const headerMediaUrl = (payload as any).headerMediaUrl || payload.mediaUrl || null;

    const newCampaign: CampaignItem & Record<string, any> = {
      id: `cmp-${Date.now()}`,
      organizationId: orgId,
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
      mediaUrl: payload.mediaUrl ? normalizePublicMediaUrl(payload.mediaUrl) : undefined,
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
      channelType,
      metaTemplateName,
      metaTemplateLanguage,
      variableMappings,
      headerMediaUrl,
    };

    this.campaignsStore.set(newCampaign.id, newCampaign);
    this.saveToDisk();

    try {
      await this.db.sql`
        INSERT INTO campaigns (
          id, organization_id, whatsapp_session_id, name, target_audience_type, 
          message_text, media_url, status, scheduled_at, total_recipients, 
          sent_count, delivered_count, read_count, failed_count, created_at, updated_at,
          content_type, poll_question, poll_options, action_buttons, menu_data, poll_data,
          channel_type, template_id, meta_template_name, meta_template_language, variable_mappings, header_media_url
        ) VALUES (
          ${newCampaign.id}, ${newCampaign.organizationId}, ${newCampaign.whatsappNumberId}, ${newCampaign.name},
          ${newCampaign.targetAudienceType}, ${newCampaign.messageText || ''}, ${newCampaign.mediaUrl || null},
          ${newCampaign.status}, ${scheduledDate.toISOString()}, ${newCampaign.totalRecipients},
          0, 0, 0, 0, NOW(), NOW(),
          ${newCampaign.contentType || null}, ${newCampaign.pollQuestion || null},
          ${newCampaign.pollOptions ? JSON.stringify(newCampaign.pollOptions) : null}::jsonb,
          ${newCampaign.actionButtons ? JSON.stringify(newCampaign.actionButtons) : null}::jsonb,
          ${newCampaign.menuData ? JSON.stringify(newCampaign.menuData) : null}::jsonb,
          ${newCampaign.pollData ? JSON.stringify(newCampaign.pollData) : null}::jsonb,
          ${channelType},
          ${newCampaign.templateId || null},
          ${metaTemplateName},
          ${metaTemplateLanguage},
          ${JSON.stringify(variableMappings)}::jsonb,
          ${headerMediaUrl}
        )
      `;

      for (const rec of recipientsList) {
        await this.db.sql`
          INSERT INTO campaign_recipients (id, campaign_id, organization_id, phone, name, status, variables, created_at)
          VALUES (
            ${rec.id}, 
            ${newCampaign.id}, 
            ${newCampaign.organizationId}, 
            ${rec.phone}, 
            ${rec.name || 'Customer'}, 
            'PENDING', 
            ${JSON.stringify(rec.variables || {})}::jsonb, 
            NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
      this.logger.log(`Persisted campaign ${newCampaign.id} (${channelType}) and ${recipientsList.length} recipients to Supabase.`);
    } catch (dbErr: any) {
      this.logger.warn(`Failed to save campaign to Supabase: ${dbErr.message}`);
    }

    if (!isScheduled && recipientsList.length > 0) {
      if (channelType === "WABA" || metaTemplateName) {
        this.startLiveWabaDispatch(newCampaign).catch((err) => {
          this.logger.error(`Critical error in WABA dispatch loop for ${newCampaign.id}: ${err.message}`, err.stack);
        });
      } else {
        this.startLiveBaileysDispatch(newCampaign, payload.messageText || "", newCampaign.mediaUrl).catch((err) => {
          this.logger.error(`Critical error in dispatch loop for ${newCampaign.id}: ${err.message}`, err.stack);
        });
      }
    }

    this.logger.log(`Created campaign ${newCampaign.id} (${newCampaign.name}) with ${newCampaign.totalRecipients} recipients.`);
    return newCampaign;
  }

  /**
   * High-Speed Concurrent Meta Cloud API (WABA) Campaign Dispatcher
   */
  private async startLiveWabaDispatch(campaign: CampaignItem & Record<string, any>) {
    if (this.activeDispatches.has(campaign.id)) {
      this.logger.log(`[WABA Dispatch] Dispatch loop for campaign ${campaign.id} is already running.`);
      return;
    }

    this.activeDispatches.add(campaign.id);
    this.logger.log(`[WABA Dispatch] Starting high-speed Meta Cloud API dispatch for campaign ${campaign.id} ("${campaign.name}")...`);

    try {
      const orgId = campaign.organizationId;
      const wabaConfig = await this.wabaService.getConfig(orgId);
      if (!wabaConfig || !wabaConfig.phoneNumberId || !wabaConfig.accessToken) {
        throw new Error("WABA credentials (Phone Number ID & Access Token) not configured. Please configure in Settings.");
      }

      // Load Template Details if templateId is present
      let templateDetails: any = null;
      if (campaign.templateId && campaign.templateId !== "tpl-custom") {
        try {
          const tplRows = await this.db.sql`
            SELECT * FROM broadcast_templates 
            WHERE id = ${campaign.templateId} AND (organization_id = ${orgId} OR organization_id = 'system')
            LIMIT 1
          `;
          if (tplRows && tplRows.length > 0) {
            templateDetails = tplRows[0];
          }
        } catch (err: any) {
          this.logger.warn(`Could not load template details for ${campaign.templateId}: ${err.message}`);
        }
      }

      const metaTemplateName = campaign.metaTemplateName || templateDetails?.meta_template_name;
      if (!metaTemplateName) {
        throw new Error("No Meta template specified for WABA campaign dispatch.");
      }
      const metaLang = campaign.metaTemplateLanguage || templateDetails?.language || "en_US";
      const headerType = (templateDetails?.header_type || "NONE").toUpperCase();
      const defaultHeaderContent = campaign.headerMediaUrl || templateDetails?.header_content || templateDetails?.media_url;
      const variableMappings = campaign.variableMappings || {};

      // Load pending recipients from DB
      const pendingRows = await this.db.sql`
        SELECT * FROM campaign_recipients
        WHERE campaign_id = ${campaign.id} AND status = 'PENDING'
        ORDER BY created_at ASC
      `;

      this.logger.log(`[WABA Dispatch] Found ${pendingRows.length} pending recipients for campaign ${campaign.id}. Launching parallel worker pool...`);

      const CONCURRENCY = 5; // 5 parallel HTTP workers to respect Cloud API rate limits
      let currentIndex = 0;
      let processedBatchCount = 0;

      const processRecipient = async (rec: any) => {
        if (campaign.status === "PAUSED") {
          return;
        }

        const phone = (rec.phone || "").replace(/\D/g, "");
        if (!phone || phone.length < 10) {
          await this.db.sql`
            UPDATE campaign_recipients
            SET status = 'FAILED', error_message = 'Invalid phone number format'
            WHERE id = ${rec.id}
          `;
          campaign.failedCount = (campaign.failedCount || 0) + 1;
          const target = (campaign.recipients || []).find((r: any) => r.id === rec.id);
          if (target) {
            target.status = "FAILED";
            target.errorMessage = "Invalid phone number format";
          }
          return;
        }

        // Parse recipient variables if string
        let recVars = rec.variables;
        if (typeof recVars === "string") {
          try { recVars = JSON.parse(recVars); } catch { recVars = {}; }
        }

        // Build Meta components array
        const components: any[] = [];

        // 1. Header Component
        if (headerType === "TEXT" && defaultHeaderContent) {
          components.push({
            type: "header",
            parameters: [{ type: "text", text: defaultHeaderContent }]
          });
        } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
          const mediaUrl = recVars?.header_media_url || defaultHeaderContent;
          if (mediaUrl && mediaUrl.startsWith("http")) {
            components.push({
              type: "header",
              parameters: [{
                type: headerType.toLowerCase(),
                [headerType.toLowerCase()]: { link: mediaUrl }
              }]
            });
          }
        }

        // 2. Body Component with positional parameters {{1}}, {{2}}, ...
        const bodyParams: Array<{ type: "text"; text: string }> = [];
        const paramKeys = Object.keys(variableMappings)
          .filter(k => /^\d+$/.test(k))
          .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        if (paramKeys.length > 0) {
          for (const k of paramKeys) {
            const mappedField = variableMappings[k];
            let val = "";
            if (rec[mappedField] !== undefined) {
              val = String(rec[mappedField]);
            } else if (recVars && recVars[mappedField] !== undefined) {
              val = String(recVars[mappedField]);
            } else if (recVars && recVars[k] !== undefined) {
              val = String(recVars[k]);
            } else {
              val = mappedField; // Static text constant
            }
            bodyParams.push({ type: "text", text: val || `Val ${k}` });
          }
        } else if (recVars && typeof recVars === "object") {
          const recKeys = Object.keys(recVars)
            .filter(k => /^\d+$/.test(k))
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
          for (const k of recKeys) {
            bodyParams.push({ type: "text", text: String(recVars[k] || "") });
          }
        }

        if (bodyParams.length > 0) {
          components.push({
            type: "body",
            parameters: bodyParams
          });
        }

        // Send via Meta Cloud API
        const sendRes = await this.wabaService.sendTemplateMessage(
          orgId,
          phone,
          metaTemplateName,
          metaLang,
          components
        );

        if (sendRes.success && sendRes.messageId) {
          await this.db.sql`
            UPDATE campaign_recipients
            SET 
              status = 'SENT',
              message_id = ${sendRes.messageId},
              sent_at = NOW(),
              error_message = NULL
            WHERE id = ${rec.id}
          `;
          campaign.sentCount = (campaign.sentCount || 0) + 1;
          const target = (campaign.recipients || []).find((r: any) => r.id === rec.id);
          if (target) {
            target.status = "SENT";
            target.messageId = sendRes.messageId;
            target.sentAt = new Date();
          }
        } else {
          const errorMsg = sendRes.error || "Meta Cloud API delivery failed";
          await this.db.sql`
            UPDATE campaign_recipients
            SET 
              status = 'FAILED',
              error_message = ${errorMsg}
            WHERE id = ${rec.id}
          `;
          campaign.failedCount = (campaign.failedCount || 0) + 1;
          const target = (campaign.recipients || []).find((r: any) => r.id === rec.id);
          if (target) {
            target.status = "FAILED";
            target.errorMessage = errorMsg;
          }
        }

        processedBatchCount++;
        if (processedBatchCount % 10 === 0) {
          await this.db.sql`
            UPDATE campaigns
            SET 
              sent_count = ${campaign.sentCount},
              failed_count = ${campaign.failedCount},
              updated_at = NOW()
            WHERE id = ${campaign.id}
          `.catch(() => {});
        }
      };

      // Launch concurrent workers
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (currentIndex < pendingRows.length) {
          if (campaign.status === "PAUSED") {
            this.logger.log(`[WABA Dispatch] Campaign ${campaign.id} paused. Halting worker.`);
            break;
          }
          const index = currentIndex++;
          if (index < pendingRows.length) {
            await processRecipient(pendingRows[index]);
            // Tiny 20ms pause between worker iterations
            await new Promise(r => setTimeout(r, 20));
          }
        }
      });

      await Promise.all(workers);

      // Final count sync
      const finalCounts = await this.db.sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED', 'READ'))::int as sent,
          COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int as delivered,
          COUNT(*) FILTER (WHERE status = 'READ')::int as read,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending
        FROM campaign_recipients
        WHERE campaign_id = ${campaign.id}
      `;

      const counts = finalCounts[0] || {};
      campaign.sentCount = counts.sent || campaign.sentCount;
      campaign.deliveredCount = counts.delivered || 0;
      campaign.readCount = counts.read || 0;
      campaign.failedCount = counts.failed || campaign.failedCount;

      if (campaign.status !== "PAUSED") {
        campaign.status = (counts.pending || 0) === 0 ? "COMPLETED" : "PROCESSING";
      }

      await this.db.sql`
        UPDATE campaigns
        SET 
          status = ${campaign.status},
          sent_count = ${campaign.sentCount},
          delivered_count = ${campaign.deliveredCount},
          read_count = ${campaign.readCount},
          failed_count = ${campaign.failedCount},
          updated_at = NOW()
        WHERE id = ${campaign.id}
      `;

      this.logger.log(`[WABA Dispatch] Finished dispatch for ${campaign.id}: Status=${campaign.status}, Sent=${campaign.sentCount}, Failed=${campaign.failedCount}`);
    } catch (err: any) {
      this.logger.error(`[WABA Dispatch] Error dispatching campaign ${campaign.id}: ${err.message}`, err.stack);
      campaign.status = "FAILED";
      await this.db.sql`
        UPDATE campaigns SET status = 'FAILED', updated_at = NOW() WHERE id = ${campaign.id}
      `.catch(() => {});
    } finally {
      this.activeDispatches.delete(campaign.id);
      this.saveToDisk();
    }
  }

  public getLocalTimeMinutes(timeZoneStr?: string): number {
    try {
      const tz = timeZoneStr || "Asia/Kolkata";
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(new Date());
      const hourPart = parts.find((p) => p.type === "hour")?.value || "0";
      const minutePart = parts.find((p) => p.type === "minute")?.value || "0";
      return parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);
    } catch {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
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
        const socket = await this.baileysService.waitForActiveSocket(campaign.whatsappNumberId, 25000, campaign.organizationId);
        if (socket?.user?.id) {
          allConnected = this.baileysService.getConnectedInstances(campaign.organizationId);
          if (allConnected.length === 0 && campaign.whatsappNumberId) {
            allConnected = [campaign.whatsappNumberId];
          }
        }
      }

      if (allConnected.length === 0) {
        this.logger.warn(`No connected WhatsApp socket found for ${campaign.organizationId}. Setting campaign to PAUSED.`);
        campaign.status = "PAUSED";
        (campaign as any).pauseReason = "AUTO_PAUSED_DEVICE_DISCONNECTED";
        this.saveToDisk();
        this.db.sql`UPDATE campaigns SET status = 'PAUSED', pause_reason = 'AUTO_PAUSED_DEVICE_DISCONNECTED', updated_at = NOW() WHERE id = ${campaign.id}`.catch(() => {});
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

      // Pre-warm media buffer in memory so all recipients reuse the downloaded buffer instantly
      const effectiveMediaUrl = mediaUrl || campaign.mediaUrl;
      if (effectiveMediaUrl) {
        await this.baileysService.prewarmMediaBuffer(effectiveMediaUrl);
      }

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

        // Live Connection Check: Verify active WhatsApp instance before sending each message
        let liveConnectedPool = this.baileysService.getConnectedInstances(campaign.organizationId);
        if (liveConnectedPool.length === 0) {
          this.logger.warn(`[Auto-Pause] No connected WhatsApp instance found for ${campaign.organizationId}. Checking for active socket...`);
          const recovered = await this.baileysService.waitForActiveSocket(campaign.whatsappNumberId, 15000, campaign.organizationId);
          if (recovered?.user?.id) {
            liveConnectedPool = this.baileysService.getConnectedInstances(campaign.organizationId);
            if (liveConnectedPool.length === 0 && campaign.whatsappNumberId) {
              liveConnectedPool = [campaign.whatsappNumberId];
            }
          } else {
            this.logger.warn(`[Auto-Pause] WhatsApp device is currently disconnected. Automatically pausing campaign "${campaign.name}" (${campaign.id}). Remaining ${campaign.recipients!.length - i} pending messages will resume automatically once WhatsApp reconnects.`);
            campaign.status = "PAUSED";
            (campaign as any).pauseReason = "AUTO_PAUSED_DEVICE_DISCONNECTED";
            this.saveToDisk();
            this.db.sql`
              UPDATE campaigns 
              SET status = 'PAUSED', pause_reason = 'AUTO_PAUSED_DEVICE_DISCONNECTED', updated_at = NOW() 
              WHERE id = ${campaign.id}
            `.catch(() => {});
            return; // Cleanly exit without marking remaining recipients failed!
          }
        }

        // Delivery Time Window Safeguard (e.g. 10:00 AM to 07:00 PM in user's timezone)
        // If user manually clicked Resume, bypass delivery window restriction so they can send on demand!
        if (globalSettings.deliveryWindowEnabled && !(campaign as any).manualResume) {
          const tz = (globalSettings.defaultCountryCode === "91" || globalSettings.defaultCountryName === "India") ? "Asia/Kolkata" : "UTC";
          const currentMinutes = this.getLocalTimeMinutes(tz);
          const [startH, startM] = (globalSettings.deliveryWindowStart || "10:00").split(":").map(Number);
          const [endH, endM] = (globalSettings.deliveryWindowEnd || "19:00").split(":").map(Number);
          const startMinutes = (startH || 10) * 60 + (startM || 0);
          const endMinutes = (endH || 19) * 60 + (endM || 0);

          if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
            this.logger.warn(`[Delivery Window] Current time is outside active business hours (${globalSettings.deliveryWindowStart} - ${globalSettings.deliveryWindowEnd} in ${tz}). Pausing campaign ${campaign.id} until active window.`);
            campaign.status = "PAUSED";
            (campaign as any).pauseReason = "PAUSED_OUTSIDE_DELIVERY_WINDOW";
            this.saveToDisk();
            this.db.sql`
              UPDATE campaigns 
              SET status = 'PAUSED', pause_reason = 'PAUSED_OUTSIDE_DELIVERY_WINDOW', updated_at = NOW() 
              WHERE id = ${campaign.id}
            `.catch(() => {});
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

        const currentPool = liveConnectedPool.length > 0 ? liveConnectedPool : this.baileysService.getConnectedInstances(campaign.organizationId);
        let viablePool = currentPool.length > 0 ? currentPool : activePool;
        if (Array.isArray(campaign.sendFromInstances) && campaign.sendFromInstances.length > 0) {
          const filtered = viablePool.filter((id) => campaign.sendFromInstances.includes(id));
          if (filtered.length > 0) viablePool = filtered;
        }
        
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
        const instanceIdx = Math.floor(i / switchAfter) % Math.max(1, dispatchPool.length);
        const targetInstanceId = dispatchPool[instanceIdx] || viablePool[0] || campaign.whatsappNumberId;

        // Auto-prepend default country code if missing (e.g. 10 digit local phone)
        let formattedPhone = (rec.phone || "").replace(/\D/g, "");
        if (formattedPhone.length === 10) {
          formattedPhone = defaultPrefix + formattedPhone;
          rec.phone = formattedPhone;
        }

        // 1. Personalized variables substitution with authentic WhatsApp Name and dynamic tokens
        const rawRecName = (rec.name || "").trim();
        const isGenericName = !rawRecName || rawRecName.startsWith("Recipient") || rawRecName === "Customer" || rawRecName === "Valued Customer";

        let explicitWhatsappName: string | null | undefined = 
          (rec as any).whatsappName || 
          (rec as any).whatsapp_name || 
          (rec as any).pushName || 
          (rec as any).push_name || 
          (rec as any).variables?.whatsapp_name || 
          (rec as any).variables?.['whatsapp-name'] ||
          (rec as any).variables?.whatsappname ||
          (rec as any).variables?.push_name ||
          (rec as any).variables?.pushName;

        if (!explicitWhatsappName && formattedPhone) {
          explicitWhatsappName = await this.baileysService.getResolvedPushName(formattedPhone, campaign.organizationId);
        }

        const validWhatsappName = (explicitWhatsappName && !explicitWhatsappName.startsWith("Recipient") && explicitWhatsappName !== "Customer" && explicitWhatsappName !== "Valued Customer") ? explicitWhatsappName.trim() : "";
        const validDisplayName = !isGenericName ? rawRecName : validWhatsappName;

        const formattedPhoneDisplay = rec.phone ? (rec.phone.startsWith("+") ? rec.phone : "+" + rec.phone) : "+91 98765 43210";
        let textToSend = (templateText || campaign.messageText || "");

        // A. WhatsApp Name tokens (Must leave blank if not available)
        textToSend = textToSend
          .replace(/\{\{whatsapp[-_]?name\}\}/gi, validWhatsappName)
          .replace(/\{\{push[-_]?name\}\}/gi, validWhatsappName);

        // B. Name / Customer Name tokens (Leaves blank if no real name exists)
        textToSend = textToSend
          .replace(/\{\{customer[-_]?name\}\}/gi, validDisplayName)
          .replace(/\{\{name\}\}/gi, validDisplayName)
          .replace(/\{\{whatsapp[-_]?number\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{phone\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{mobile\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{number\}\}/gi, formattedPhoneDisplay)
          .replace(/\{\{shop[-_]?name\}\}/gi, "Dhaba Opticals")
          .replace(/\{\{business[-_]?name\}\}/gi, "Dhaba Opticals")
          .replace(/\{\{city\}\}/gi, (rec as any).city || "Main City")
          .replace(/\{\{location\}\}/gi, (rec as any).city || "Main City")
          .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"))
          .replace(/\{\{today\}\}/gi, new Date().toLocaleDateString("en-GB"))
          .replace(/\{\{voucher[-_]?code\}\}/gi, "FESTIVAL20")
          .replace(/\{\{coupon[-_]?code\}\}/gi, "FESTIVAL20")
          .replace(/\{\{discount\}\}/gi, "20%");

        if ((rec as any).variables) {
          const vObj = (rec as any).variables;
          Object.keys(vObj).forEach((vKey) => {
            const regex = new RegExp(`\\{\\{${vKey.replace(/-/g, "[-_]?")}\\}\\}`, "gi");
            textToSend = textToSend.replace(regex, vObj[vKey] || "");
          });
        }

        for (let vIdx = 1; vIdx <= 7; vIdx++) {
          const vVal = (rec as any)[`var${vIdx}`];
          if (vVal) {
            textToSend = textToSend.replace(new RegExp(`\\{\\{var${vIdx}\\}\\}`, "gi"), String(vVal));
          }
        }

        // Clean up accidental double spaces created when a name token is blank
        textToSend = textToSend
          .replace(/ +([,!.?:;])/g, "$1")
          .replace(/  +/g, " ");

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
          orgId: campaign.organizationId,
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
          const isDisconnected = errMsg.includes("not connected") || errMsg.includes("Connection Closed") || errMsg.includes("Socket disconnected") || errMsg.includes("restart required") || errMsg.includes("Connection Lost");

          if (isDisconnected) {
            this.logger.warn(`[Auto-Pause on Disconnect] WhatsApp instance disconnected while dispatching to ${rec.phone}. Checking for quick reconnect before pausing...`);
            // Give it 8 seconds to see if Baileys auto-restarted
            const recheckSocket = await this.baileysService.waitForActiveSocket(targetInstanceId, 8000, campaign.organizationId);
            if (recheckSocket?.user?.id) {
              this.logger.log(`WhatsApp socket quickly recovered for ${targetInstanceId}. Retrying recipient ${rec.phone}...`);
              rec.status = "PENDING";
              i--; // Retry this recipient
              continue;
            }

            rec.status = "PENDING"; // Keep recipient in PENDING so it can be sent once reconnected!
            rec.errorMessage = undefined;
            campaign.status = "PAUSED";
            (campaign as any).pauseReason = "AUTO_PAUSED_DEVICE_DISCONNECTED";
            this.saveToDisk();

            this.db.sql`
              UPDATE campaigns 
              SET status = 'PAUSED', pause_reason = 'AUTO_PAUSED_DEVICE_DISCONNECTED', updated_at = NOW() 
              WHERE id = ${campaign.id}
            `.catch(() => {});

            return; // Cleanly exit dispatch loop!
          }

          if (errMsg.includes("not registered on WhatsApp") || errMsg.toLowerCase().includes("non whatsapp") || errMsg.includes("Non-WhatsApp")) {
            rec.status = "NON_WHATSAPP";
            rec.errorMessage = "Not registered on WhatsApp (Non-WhatsApp number)";
            (rec as any).failureCategory = "NON_WHATSAPP";
          } else if (errMsg.includes("Invalid recipient phone number") || errMsg.includes("10 digits") || errMsg.includes("Landline")) {
            rec.status = "INVALID_NUMBER";
            rec.errorMessage = "Invalid phone number format / Landline";
            (rec as any).failureCategory = "INVALID_NUMBER";
          } else {
            rec.status = "FAILED";
            rec.errorMessage = errMsg || "Failed to deliver message via WhatsApp device.";
            (rec as any).failureCategory = "FAILED";
          }

          campaign.failedCount = campaign.recipients!.filter((r) => ["FAILED", "INVALID_NUMBER", "NON_WHATSAPP"].includes(r.status)).length;

          this.db.sql`
            UPDATE campaign_recipients 
            SET status = ${rec.status}, error_message = ${rec.errorMessage}
            WHERE id = ${rec.id}
          `.catch(() => {});
          this.logger.warn(`Dispatch result for ${rec.phone}: ${rec.status} (${rec.errorMessage})`);
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

          let waitTimeMs = delayMs;

          // 1. Sleep Mode Check (from Settings -> Sleep Mode)
          if (globalSettings.sleepEnabled && globalSettings.sleepAfterMessages > 0 && (i + 1) % globalSettings.sleepAfterMessages === 0) {
            const sleepSec = Math.max(1, globalSettings.sleepForSeconds || 10);
            this.logger.log(`[Sleep Mode] Reached ${globalSettings.sleepAfterMessages} messages. Sleeping for ${sleepSec}s before resuming...`);
            waitTimeMs = sleepSec * 1000;
          }
          // 2. Custom Batch Pause (from Campaign Composer override if configured)
          else if (Number(campaign.batchSize) > 0 && (i + 1) % Number(campaign.batchSize) === 0) {
            const batchPauseSec = Number(campaign.batchPause) || 60;
            this.logger.log(`[Batch Pacing] Reached batch of ${campaign.batchSize}. Pausing ${batchPauseSec}s before resuming...`);
            waitTimeMs = batchPauseSec * 1000;
          }
          // 3. Regular Human Anti-Ban Jitter
          else {
            this.logger.log(`[Anti-Ban Jitter] Account ${targetInstanceId} applying ${Math.round(delayMs / 1000)}s dynamic delay (${minSec}s - ${maxSec}s window)...`);
          }

          // Interruptible sleep: checks if campaign was paused or cancelled every 500ms
          const sleepStart = Date.now();
          while (Date.now() - sleepStart < waitTimeMs) {
            if ((campaign as any).status === "PAUSED" || (campaign as any).status === "CANCELLED") {
              this.logger.log(`Campaign ${campaign.id} status is ${campaign.status}. Stopping delay.`);
              return;
            }
            await new Promise((r) => setTimeout(r, 500));
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

  async pauseCampaign(orgId: string, id: string): Promise<CampaignItem> {
    const cmp = this.findOne(orgId, id);
    cmp.status = "PAUSED";
    (cmp as any).manualUserPause = true;
    (cmp as any).pauseReason = "MANUAL_USER_PAUSE";
    this.saveToDisk();
    try {
      await this.db.sql`UPDATE campaigns SET status = 'PAUSED', pause_reason = 'MANUAL_USER_PAUSE', updated_at = NOW() WHERE id = ${id} AND (organization_id = ${orgId} OR organization_id = 'org-demo')`;
    } catch {}
    this.logger.log(`Paused campaign ${id} for org ${orgId}`);
    return cmp;
  }

  async resumeCampaign(orgId: string, id: string, fallbackData?: any): Promise<CampaignItem> {
    let cmp = this.campaignsStore.get(id);

    if (!cmp && fallbackData && (fallbackData.organizationId === orgId || orgId === "org-demo")) {
      this.syncFromFrontend(orgId, [fallbackData]);
      cmp = this.campaignsStore.get(id);
    }

    if (!cmp) {
      try {
        const rows = await this.db.sql`SELECT * FROM campaigns WHERE id = ${id} AND (organization_id = ${orgId} OR organization_id = 'org-demo') LIMIT 1`;
        if (rows && rows.length > 0) {
          const r = rows[0];
          cmp = {
            id: r.id,
            organizationId: r.organization_id || orgId,
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
          };
          this.campaignsStore.set(cmp.id, cmp);
        }
      } catch {}
    }

    if (!cmp) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }

    // Load recipients from database if missing or empty
    if (!cmp.recipients || cmp.recipients.length === 0) {
      try {
        const recRows = await this.db.sql`
          SELECT * FROM campaign_recipients WHERE campaign_id = ${id} ORDER BY created_at ASC
        `;
        if (recRows && recRows.length > 0) {
          cmp.recipients = recRows.map((rec: any) => ({
            id: rec.id,
            phone: rec.phone,
            name: rec.name || "Customer",
            messageId: rec.message_id || undefined,
            status: rec.status,
            sentAt: rec.sent_at ? new Date(rec.sent_at) : undefined,
            deliveredAt: rec.delivered_at ? new Date(rec.delivered_at) : undefined,
            readAt: rec.read_at ? new Date(rec.read_at) : undefined,
            errorMessage: rec.error_message || undefined,
          }));
        }
      } catch (err: any) {
        this.logger.warn(`Failed to reload recipients from DB for ${id}: ${err.message}`);
      }
    }

    // Reset non-delivered/failed recipients to PENDING so resumed dispatch will process them
    (cmp.recipients || []).forEach((r) => {
      if (
        r.status === "PAUSED" ||
        r.status === "SENDING" ||
        !r.status ||
        (r.status === "FAILED" && !r.errorMessage?.includes("not registered on WhatsApp") && !r.errorMessage?.includes("Invalid recipient phone number"))
      ) {
        r.status = "PENDING";
        r.errorMessage = undefined;
      }
    });

    cmp.status = "PROCESSING";
    (cmp as any).manualResume = true;
    (cmp as any).manualUserPause = false;
    (cmp as any).pauseReason = undefined;
    this.saveToDisk();

    try {
      await this.db.sql`
        UPDATE campaigns 
        SET status = 'PROCESSING', pause_reason = NULL, updated_at = NOW() 
        WHERE id = ${id}
      `;
    } catch {}

    this.logger.log(`Resumed campaign ${id} (${cmp.name}) for org ${orgId}`);

    // Clear any previous dispatch registration to prevent getting blocked by isAlreadyRunning guard
    this.activeDispatches.delete(id);

    if (cmp.channelType === "WABA" || cmp.metaTemplateName) {
      this.startLiveWabaDispatch(cmp).catch((err) => {
        this.logger.error(`Error in resumed WABA dispatch loop for ${id}: ${err.message}`);
      });
    } else {
      this.startLiveBaileysDispatch(cmp, cmp.messageText || "", cmp.mediaUrl).catch((err) => {
        this.logger.error(`Error in resumed dispatch loop for ${id}: ${err.message}`);
      });
    }

    return cmp;
  }

  async deleteCampaign(orgId: string, id: string): Promise<boolean> {
    const cmp = this.campaignsStore.get(id);
    if (!cmp || cmp.organizationId !== orgId) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }

    this.campaignsStore.delete(id);
    this.saveToDisk();
    try {
      await this.db.sql`DELETE FROM campaigns WHERE id = ${id} AND organization_id = ${orgId}`;
    } catch {}
    this.logger.log(`Deleted campaign ${id} for org ${orgId}`);
    return true;
  }
}
