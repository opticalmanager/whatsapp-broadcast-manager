import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { SaveWabaConfigDto, TestWabaConnectionDto } from "./dto/waba-config.dto";

export interface WabaConfigRecord {
  organizationId: string;
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  appId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  messagingTier?: string;
  codeVerificationStatus?: string;
  status: "CONNECTED" | "DISCONNECTED" | "AUTH_ERROR";
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WabaService {
  private readonly logger = new Logger(WabaService.name);
  private readonly GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get WABA configuration for an organization
   */
  async getConfig(orgId: string): Promise<WabaConfigRecord | null> {
    const effectiveOrg = orgId || "org-demo";
    try {
      const rows = await this.db.sql`
        SELECT * FROM public.waba_configurations 
        WHERE organization_id = ${effectiveOrg}
        LIMIT 1
      `;

      if (rows && rows.length > 0) {
        return this.mapRow(rows[0]);
      }

      // Fallback to default demo org if exists
      if (effectiveOrg !== "org-demo") {
        const demoRows = await this.db.sql`
          SELECT * FROM public.waba_configurations 
          WHERE organization_id = 'org-demo'
          LIMIT 1
        `;
        if (demoRows && demoRows.length > 0) {
          return this.mapRow(demoRows[0]);
        }
      }
      return null;
    } catch (err: any) {
      this.logger.warn(`Failed to fetch WABA config for ${orgId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Save WABA configuration and automatically verify connection
   */
  async saveConfig(orgId: string, dto: SaveWabaConfigDto): Promise<{ success: boolean; message: string; data: WabaConfigRecord }> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhoneId = dto.phoneNumberId?.trim();
    const cleanWabaId = dto.wabaId?.trim();
    const cleanToken = dto.accessToken?.trim();
    const cleanVerify = dto.webhookVerifyToken?.trim();
    const cleanAppId = dto.appId?.trim() || null;

    if (!cleanPhoneId || !cleanWabaId || !cleanToken || !cleanVerify) {
      throw new BadRequestException("Phone Number ID, WABA ID, Access Token, and Webhook Verify Token are required.");
    }

    try {
      await this.db.sql`
        INSERT INTO public.waba_configurations (
          organization_id, phone_number_id, waba_id, access_token, 
          webhook_verify_token, app_id, status, updated_at
        ) VALUES (
          ${effectiveOrg}, ${cleanPhoneId}, ${cleanWabaId}, ${cleanToken}, 
          ${cleanVerify}, ${cleanAppId}, 'DISCONNECTED', NOW()
        )
        ON CONFLICT (organization_id) DO UPDATE SET
          phone_number_id = EXCLUDED.phone_number_id,
          waba_id = EXCLUDED.waba_id,
          access_token = EXCLUDED.access_token,
          webhook_verify_token = EXCLUDED.webhook_verify_token,
          app_id = EXCLUDED.app_id,
          updated_at = NOW()
      `;

      this.logger.log(`Saved WABA credentials for org ${effectiveOrg}. Running connection test...`);
      
      // Automatically test connection
      const testResult = await this.testConnection(effectiveOrg, { phoneNumberId: cleanPhoneId, accessToken: cleanToken });
      const updatedConfig = await this.getConfig(effectiveOrg);

      return {
        success: testResult.success,
        message: testResult.success 
          ? "WABA credentials saved and verified with Meta Cloud API successfully!" 
          : `WABA credentials saved, but connection test failed: ${testResult.message}`,
        data: updatedConfig!,
      };
    } catch (err: any) {
      this.logger.error(`Error saving WABA config for ${effectiveOrg}: ${err.message}`);
      throw new BadRequestException(err.message || "Failed to save WABA configuration.");
    }
  }

  /**
   * Test live connection to Meta Cloud API v20.0
   */
  async testConnection(orgId: string, override?: TestWabaConnectionDto): Promise<{ success: boolean; message: string; data?: any }> {
    const effectiveOrg = orgId || "org-demo";
    let phoneId = override?.phoneNumberId?.trim();
    let token = override?.accessToken?.trim();

    if (!phoneId || !token) {
      const cfg = await this.getConfig(effectiveOrg);
      if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
        throw new BadRequestException("WABA credentials are not configured. Please enter Phone Number ID and Access Token.");
      }
      phoneId = cfg.phoneNumberId;
      token = cfg.accessToken;
    }

    const endpoint = `${this.GRAPH_API_BASE}/${phoneId}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier,code_verification_status`;

    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        const errorMsg = json.error?.message || `Meta API error (${res.status})`;
        const errorCode = json.error?.code || res.status;
        this.logger.warn(`Meta API connection test failed for ${phoneId}: [Code ${errorCode}] ${errorMsg}`);

        await this.db.sql`
          UPDATE public.waba_configurations 
          SET status = 'AUTH_ERROR', last_tested_at = NOW(), updated_at = NOW()
          WHERE organization_id = ${effectiveOrg}
        `.catch(() => {});

        return {
          success: false,
          message: `Meta API verification failed: ${errorMsg} (Error code: ${errorCode})`,
          data: json.error,
        };
      }

      // Success: Extract verified business details
      const verifiedName = json.verified_name || "Verified Business";
      const displayPhoneNumber = json.display_phone_number || "";
      const qualityRating = json.quality_rating || "GREEN";
      const messagingTier = json.messaging_limit_tier || "TIER_1K";
      const codeVerificationStatus = json.code_verification_status || "VERIFIED";

      await this.db.sql`
        UPDATE public.waba_configurations
        SET 
          display_phone_number = ${displayPhoneNumber},
          verified_name = ${verifiedName},
          quality_rating = ${qualityRating},
          messaging_tier = ${messagingTier},
          code_verification_status = ${codeVerificationStatus},
          status = 'CONNECTED',
          last_tested_at = NOW(),
          updated_at = NOW()
        WHERE organization_id = ${effectiveOrg}
      `;

      this.logger.log(`WABA connection test passed for ${effectiveOrg}: ${verifiedName} (${displayPhoneNumber}) - Tier: ${messagingTier}, Rating: ${qualityRating}`);

      return {
        success: true,
        message: `Successfully connected to Meta Cloud API! Verified: ${verifiedName} (${displayPhoneNumber})`,
        data: {
          verifiedName,
          displayPhoneNumber,
          qualityRating,
          messagingTier,
          codeVerificationStatus,
          status: "CONNECTED",
        },
      };
    } catch (err: any) {
      this.logger.error(`Network error during Meta connection test: ${err.message}`);
      return {
        success: false,
        message: `Network error reaching Meta Cloud API: ${err.message}`,
      };
    }
  }

  /**
   * Verify webhook token during Meta handshake
   */
  async verifyWebhookToken(mode: string, verifyToken: string): Promise<boolean> {
    if (mode !== "subscribe" || !verifyToken) return false;

    // Check environment variable fallback
    const envVerifyToken = process.env.WABA_WEBHOOK_VERIFY_TOKEN;
    if (envVerifyToken && envVerifyToken === verifyToken) {
      return true;
    }

    try {
      const rows = await this.db.sql`
        SELECT organization_id FROM public.waba_configurations
        WHERE webhook_verify_token = ${verifyToken}
        LIMIT 1
      `;
      return rows && rows.length > 0;
    } catch (err: any) {
      this.logger.warn(`Webhook verify token lookup note: ${err.message}`);
      return false;
    }
  }

  /**
   * Send standard text message via Meta Cloud API (24h customer care window)
   */
  async sendTextMessage(orgId: string, to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials not configured for this organization.");
    }

    const cleanPhone = to.replace(/\D/g, "");
    const endpoint = `${this.GRAPH_API_BASE}/${cfg.phoneNumberId}/messages`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || "Failed to send text message via Meta API";
        this.logger.warn(`Meta sendTextMessage failed for ${cleanPhone}: ${errMsg}`);
        return { success: false, error: errMsg };
      }

      const messageId = json.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Send template message via Meta Cloud API (Campaigns & Notifications)
   */
  async sendTemplateMessage(
    orgId: string,
    to: string,
    templateName: string,
    languageCode: string = "en_US",
    components: any[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials not configured for this organization.");
    }

    const cleanPhone = to.replace(/\D/g, "");
    const endpoint = `${this.GRAPH_API_BASE}/${cfg.phoneNumberId}/messages`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components && components.length > 0 ? components : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || "Failed to send template message via Meta API";
        this.logger.warn(`Meta sendTemplateMessage failed for ${cleanPhone} (${templateName}): ${errMsg}`);
        return { success: false, error: errMsg };
      }

      const messageId = json.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Send media message (Image, Video, Document, Audio) via Meta Cloud API
   */
  async sendMediaMessage(
    orgId: string,
    to: string,
    mediaType: "image" | "video" | "document" | "audio",
    mediaUrl: string,
    caption?: string,
    fileName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials not configured for this organization.");
    }

    const cleanPhone = to.replace(/\D/g, "");
    const endpoint = `${this.GRAPH_API_BASE}/${cfg.phoneNumberId}/messages`;

    const mediaPayload: any = { link: mediaUrl };
    if (caption && (mediaType === "image" || mediaType === "video" || mediaType === "document")) {
      mediaPayload.caption = caption;
    }
    if (fileName && mediaType === "document") {
      mediaPayload.filename = fileName;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: mediaType,
          [mediaType]: mediaPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || "Failed to send media message via Meta API";
        return { success: false, error: errMsg };
      }

      return { success: true, messageId: json.messages?.[0]?.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Process Meta Webhook event payload asynchronously
   */
  async processWebhookPayload(body: any): Promise<void> {
    if (!body || body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      const wabaId = entry.id;
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        const val = change.value;
        if (!val || val.messaging_product !== "whatsapp") continue;

        // 1. Process Message Status Updates (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const statusObj of val.statuses) {
            await this.handleStatusReceipt(statusObj);
          }
        }

        // 2. Process Inbound Messages from Customers (24h customer care session replies)
        if (Array.isArray(val.messages)) {
          const contacts = Array.isArray(val.contacts) ? val.contacts : [];
          for (const msg of val.messages) {
            const senderContact = contacts.find((c: any) => c.wa_id === msg.from);
            await this.handleInboundMessage(msg, senderContact, val.metadata);
          }
        }

        // 3. Process Template Status Changes (APPROVED, REJECTED, PAUSED)
        if (change.field === "message_template_status_update") {
          this.logger.log(`[Meta Template Webhook] Status update: ${JSON.stringify(val)}`);
          await this.handleTemplateStatusUpdate(val);
        }
      }
    }
  }

  /**
   * Handle official template status update from Meta webhook
   */
  private async handleTemplateStatusUpdate(val: any) {
    const templateName = val.message_template_name;
    const templateId = val.message_template_id ? String(val.message_template_id) : null;
    const event = (val.event || "").toUpperCase(); // APPROVED, REJECTED, PAUSED
    const reason = val.reason || val.disable_info || null;

    this.logger.log(`[Meta Template Webhook] Template "${templateName}" (${templateId}) -> ${event} (Reason: ${reason || "None"})`);

    try {
      if (templateName || templateId) {
        await this.db.sql`
          UPDATE public.broadcast_templates
          SET 
            meta_status = ${event},
            meta_rejection_reason = ${reason},
            meta_template_id = COALESCE(${templateId}, meta_template_id),
            updated_at = NOW()
          WHERE (meta_template_name = ${templateName} OR meta_template_id = ${templateId})
        `;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to update template status from webhook: ${err.message}`);
    }
  }

  /**
   * Create message template on Meta Cloud API
   */
  async createMetaTemplate(orgId: string, payload: any): Promise<{ success: boolean; id?: string; status?: string; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.wabaId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials (WABA ID & Access Token) not configured.");
    }

    const endpoint = `${this.GRAPH_API_BASE}/${cfg.wabaId}/message_templates`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || `Meta API Error (${res.status})`;
        const userMsg = json.error?.error_user_msg || errMsg;
        this.logger.warn(`Meta createMetaTemplate failed: ${errMsg} - ${userMsg}`);
        return { success: false, error: userMsg || errMsg };
      }

      return {
        success: true,
        id: json.id,
        status: json.status || "PENDING",
      };
    } catch (err: any) {
      this.logger.error(`Error calling Meta createMetaTemplate: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get all templates from Meta Cloud API
   */
  async getMetaTemplates(orgId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.wabaId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials (WABA ID & Access Token) not configured.");
    }

    const endpoint = `${this.GRAPH_API_BASE}/${cfg.wabaId}/message_templates?limit=100`;

    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || `Meta API Error (${res.status})`;
        return { success: false, error: errMsg };
      }

      return {
        success: true,
        data: Array.isArray(json.data) ? json.data : [],
      };
    } catch (err: any) {
      this.logger.error(`Error fetching Meta templates: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete template from Meta Cloud API
   */
  async deleteMetaTemplate(orgId: string, templateName: string): Promise<{ success: boolean; error?: string }> {
    const cfg = await this.getConfig(orgId);
    if (!cfg || !cfg.wabaId || !cfg.accessToken) {
      throw new BadRequestException("WABA credentials (WABA ID & Access Token) not configured.");
    }

    const endpoint = `${this.GRAPH_API_BASE}/${cfg.wabaId}/message_templates?name=${encodeURIComponent(templateName)}`;

    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const errMsg = json.error?.message || `Meta API Error (${res.status})`;
        return { success: false, error: errMsg };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle official delivery receipt from Meta
   */
  private async handleStatusReceipt(statusObj: any) {
    const wamid = statusObj.id;
    const metaStatus = (statusObj.status || "").toLowerCase();
    const recipientPhone = (statusObj.recipient_id || "").replace(/\D/g, "");
    const cleanPhone10 = recipientPhone.slice(-10);
    const timestampSec = Number(statusObj.timestamp) || Math.floor(Date.now() / 1000);
    const eventTime = new Date(timestampSec * 1000);

    let errorReason: string | null = null;
    if (metaStatus === "failed" && Array.isArray(statusObj.errors) && statusObj.errors.length > 0) {
      const err = statusObj.errors[0];
      errorReason = err.title ? `${err.code || ""}: ${err.title} - ${err.message || ""}` : (err.message || "Meta delivery failed");
    }

    this.logger.log(`[Meta Webhook Status] Msg ${wamid} -> ${metaStatus.toUpperCase()} (Phone: ${recipientPhone})`);

    try {
      if (metaStatus === "delivered") {
        await this.db.sql`
          UPDATE public.campaign_recipients
          SET 
            status = 'DELIVERED',
            delivered_at = COALESCE(delivered_at, ${eventTime.toISOString()}::timestamptz)
          WHERE (message_id = ${wamid} OR (RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10} AND status = 'SENT'))
        `;
        await this.db.sql`
          UPDATE public.campaigns c
          SET 
            delivered_count = (SELECT COUNT(*)::int FROM public.campaign_recipients WHERE campaign_id = c.id AND status IN ('DELIVERED', 'READ')),
            updated_at = NOW()
          FROM public.campaign_recipients r
          WHERE (r.message_id = ${wamid} OR RIGHT(REGEXP_REPLACE(r.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}) AND c.id = r.campaign_id
        `.catch(() => {});
      } else if (metaStatus === "read") {
        await this.db.sql`
          UPDATE public.campaign_recipients
          SET 
            status = 'READ',
            read_at = COALESCE(read_at, ${eventTime.toISOString()}::timestamptz),
            delivered_at = COALESCE(delivered_at, ${eventTime.toISOString()}::timestamptz)
          WHERE (message_id = ${wamid} OR (RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10} AND status IN ('SENT', 'DELIVERED')))
        `;
        await this.db.sql`
          UPDATE public.campaigns c
          SET 
            read_count = (SELECT COUNT(*)::int FROM public.campaign_recipients WHERE campaign_id = c.id AND status = 'READ'),
            delivered_count = (SELECT COUNT(*)::int FROM public.campaign_recipients WHERE campaign_id = c.id AND status IN ('DELIVERED', 'READ')),
            updated_at = NOW()
          FROM public.campaign_recipients r
          WHERE (r.message_id = ${wamid} OR RIGHT(REGEXP_REPLACE(r.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}) AND c.id = r.campaign_id
        `.catch(() => {});
      } else if (metaStatus === "failed") {
        await this.db.sql`
          UPDATE public.campaign_recipients
          SET 
            status = 'FAILED',
            error_message = ${errorReason || 'Undeliverable by WhatsApp'}
          WHERE (message_id = ${wamid} OR (RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10} AND status IN ('PENDING', 'SENDING', 'SENT')))
        `;
        await this.db.sql`
          UPDATE public.campaigns c
          SET 
            failed_count = (SELECT COUNT(*)::int FROM public.campaign_recipients WHERE campaign_id = c.id AND status = 'FAILED'),
            updated_at = NOW()
          FROM public.campaign_recipients r
          WHERE (r.message_id = ${wamid} OR RIGHT(REGEXP_REPLACE(r.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}) AND c.id = r.campaign_id
        `.catch(() => {});
      } else if (metaStatus === "sent") {
        await this.db.sql`
          UPDATE public.campaign_recipients
          SET 
            status = 'SENT',
            sent_at = COALESCE(sent_at, ${eventTime.toISOString()}::timestamptz)
          WHERE message_id = ${wamid}
        `;
      }
    } catch (err: any) {
      this.logger.debug(`Database update note for status receipt ${wamid}: ${err.message}`);
    }
  }

  /**
   * Handle incoming customer message from Meta webhook
   */
  private async handleInboundMessage(msg: any, contact: any, metadata: any) {
    const rawFrom = (msg.from || "").replace(/\D/g, "");
    const cleanPhone10 = rawFrom.slice(-10);
    const senderName = contact?.profile?.name || "Customer";
    const timestampSec = Number(msg.timestamp) || Math.floor(Date.now() / 1000);
    const eventTime = new Date(timestampSec * 1000);

    let content = "";
    const msgType = msg.type || "text";

    if (msgType === "text") {
      content = msg.text?.body || "";
    } else if (msgType === "button") {
      content = `🔘 ${msg.button?.text || msg.button?.payload || ""}`;
    } else if (msgType === "interactive") {
      const interactive = msg.interactive;
      if (interactive.type === "button_reply") {
        content = `🔘 ${interactive.button_reply?.title || interactive.button_reply?.id || ""}`;
      } else if (interactive.type === "list_reply") {
        content = `📋 ${interactive.list_reply?.title || interactive.list_reply?.description || ""}`;
      }
    } else if (msgType === "image") {
      content = msg.image?.caption ? `[Image] ${msg.image.caption}` : "[Image]";
    } else if (msgType === "document") {
      content = msg.document?.filename ? `[Document: ${msg.document.filename}]` : "[Document]";
    } else {
      content = `[${msgType.toUpperCase()}]`;
    }

    this.logger.log(`[Meta Inbound Message] From ${senderName} (${rawFrom}): "${content}"`);

    try {
      // 1. Save to chat_messages table
      const msgId = `waba_msg_${msg.id || Date.now()}`;
      await this.db.sql`
        INSERT INTO public.chat_messages (
          id, phone, sender_name, content, message_type, direction, created_at
        ) VALUES (
          ${msgId}, ${rawFrom}, ${senderName}, ${content}, ${msgType.toUpperCase()}, 'INCOMING', ${eventTime.toISOString()}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // 2. Mark corresponding campaign recipient as READ and record reply
      await this.db.sql`
        UPDATE public.campaign_recipients
        SET 
          status = 'READ',
          read_at = COALESCE(read_at, ${eventTime.toISOString()}::timestamptz),
          reply_text = ${content},
          replied_at = ${eventTime.toISOString()}::timestamptz
        WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
          AND (replied_at IS NULL OR replied_at < ${eventTime.toISOString()}::timestamptz)
      `;
    } catch (err: any) {
      this.logger.debug(`Inbound message persistence note for ${rawFrom}: ${err.message}`);
    }
  }

  private mapRow(r: any): WabaConfigRecord {
    return {
      organizationId: r.organization_id,
      phoneNumberId: r.phone_number_id || undefined,
      wabaId: r.waba_id || undefined,
      accessToken: r.access_token || undefined,
      webhookVerifyToken: r.webhook_verify_token || undefined,
      appId: r.app_id || undefined,
      displayPhoneNumber: r.display_phone_number || undefined,
      verifiedName: r.verified_name || undefined,
      qualityRating: r.quality_rating || "UNKNOWN",
      messagingTier: r.messaging_tier || "UNKNOWN",
      codeVerificationStatus: r.code_verification_status || "NOT_VERIFIED",
      status: r.status || "DISCONNECTED",
      lastTestedAt: r.last_tested_at ? new Date(r.last_tested_at) : undefined,
      createdAt: new Date(r.created_at || Date.now()),
      updatedAt: new Date(r.updated_at || Date.now()),
    };
  }
}
