import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";
import { BroadcastGateway } from "../whatsapp-session/whatsapp.gateway";
import { WabaService } from "../waba/waba.service";

export interface ChatConversation {
  id: string;
  organizationId: string;
  instanceId?: string;
  phone: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt: Date;
  lastMessageType: string;
  lastMessageDirection: "INCOMING" | "OUTGOING";
  unreadCount: number;
  status: "AWAITING_REPLY" | "REPLIED" | "ARCHIVED" | "OPEN";
  tags: string[];
  isGroup: boolean;
  isBusiness: boolean;
  createdAt: Date;
  updatedAt: Date;
  campaignName?: string;
  customerWindowExpiresAt?: Date;
  isWindowActive?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  instanceId?: string;
  phone: string;
  messageId?: string;
  direction: "INCOMING" | "OUTGOING";
  senderName?: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  interactiveData?: any;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  campaignName?: string;
  isCampaignBroadcast?: boolean;
  quotedMessageId?: string;
  quotedContent?: string;
  quotedSender?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly sessionManager: WhatsAppSessionManagerService,
    private readonly gateway: BroadcastGateway,
    private readonly wabaService: WabaService
  ) {}

  async getConversations(
    orgId: string,
    filter: string = "all",
    search?: string,
    instanceId?: string,
    campaignId?: string
  ): Promise<ChatConversation[]> {
    const effectiveOrg = orgId || "org-demo";
    try {
      let rows: any[] = [];
      const cleanSearch = (search || "").trim();

      // If campaignId is provided, ONLY return recipients who ACTUALLY REPLIED / ENGAGED with this campaign!
      if (campaignId) {
        const campaignRows = await this.db.sql`
          SELECT id, name, created_at, scheduled_at FROM campaigns WHERE id = ${campaignId} LIMIT 1
        `;
        if (!campaignRows || campaignRows.length === 0) {
          return [];
        }
        const camp = campaignRows[0];

        const campaignRecipients = await this.db.sql`
          SELECT cr.id, cr.phone, cr.name, cr.button_clicked, cr.poll_vote, cr.reply_text, cr.created_at, cr.sent_at, c.name as campaign_name
          FROM campaign_recipients cr
          LEFT JOIN campaigns c ON c.id = cr.campaign_id
          WHERE cr.campaign_id = ${campaignId}
          ORDER BY cr.created_at DESC NULLS LAST
          LIMIT 500
        `;

        if (!campaignRecipients || campaignRecipients.length === 0) {
          return [];
        }

        const phoneList: string[] = campaignRecipients.map((r: any) => (r.phone || "").replace(/\D/g, ""));
        const phoneListClean10: string[] = Array.from(new Set(phoneList.map((p: string) => p.slice(-10)).filter(Boolean)));

        if (phoneListClean10.length === 0) {
          return [];
        }

        // Query incoming messages received from these recipients
        let incomingMsgs: any[] = [];
        try {
          incomingMsgs = await this.db.sql`
            SELECT cm.id, cm.phone, cm.content, cm.created_at, cm.message_type
            FROM chat_messages cm
            WHERE cm.direction = 'INCOMING'
              AND RIGHT(REGEXP_REPLACE(cm.phone, '\\D', '', 'g'), 10) IN ${this.db.sql(phoneListClean10)}
            ORDER BY cm.created_at DESC
          `;
        } catch (err: any) {
          this.logger.debug(`Could not query incoming chat messages: ${err.message}`);
        }

        // ONLY include recipients who have actually sent a reply, clicked a button, or voted on a poll!
        const respondersList: any[] = [];
        const seenPhones = new Set<string>();

        for (const rec of campaignRecipients) {
          const rec10 = (rec.phone || "").replace(/\D/g, "").slice(-10);
          if (seenPhones.has(rec10)) continue;

          const recSentTime = rec.sent_at ? new Date(rec.sent_at).getTime() : new Date(camp.created_at || 0).getTime();

          // Rule: An incoming message counts as a campaign reply if sent on or after the campaign was sent!
          const matchMsg = incomingMsgs.find((m: any) => {
            const m10 = (m.phone || "").replace(/\D/g, "").slice(-10);
            const mTime = new Date(m.created_at).getTime();
            return m10 === rec10 && mTime >= (recSentTime - 60 * 1000);
          });

          const hasReply = Boolean(rec.reply_text || rec.button_clicked || rec.poll_vote || matchMsg);

          // DO NOT show numbers that did NOT send any reply!
          if (hasReply) {
            seenPhones.add(rec10);
            const lastContent =
              matchMsg?.content ||
              rec.reply_text ||
              (rec.button_clicked ? `Button: ${rec.button_clicked}` : rec.poll_vote ? `Voted: ${rec.poll_vote}` : "Customer Reply");
            const lastTime = matchMsg?.created_at
              ? new Date(matchMsg.created_at)
              : rec.replied_at
              ? new Date(rec.replied_at)
              : rec.sent_at
              ? new Date(rec.sent_at)
              : new Date();

            respondersList.push({
              id: `conv_${effectiveOrg}_${rec10}`,
              organization_id: effectiveOrg,
              instance_id: null,
              phone: rec.phone,
              contact_name: rec.name && !rec.name.startsWith("Recipient") ? rec.name : `+${rec.phone}`,
              last_message: lastContent,
              last_message_at: lastTime,
              last_message_type: matchMsg?.message_type || (rec.button_clicked ? "BUTTON" : rec.poll_vote ? "POLL" : "TEXT"),
              last_message_direction: "INCOMING",
              unread_count: 1,
              status: "AWAITING_REPLY",
              tags: [],
              is_group: false,
              is_business: false,
              campaign_name: rec.campaign_name || camp.name,
              created_at: lastTime,
              updated_at: lastTime,
            });
          }
        }

        respondersList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        return respondersList.map((r) => this.mapConversation(r));
      } else {
        // Standard full conversations query
        rows = await this.db.sql`
          SELECT 
            cc.*,
            (
              SELECT c.name 
              FROM campaign_recipients cr2
              JOIN campaigns c ON c.id = cr2.campaign_id
              WHERE cr2.organization_id = ${effectiveOrg}
                AND c.organization_id = ${effectiveOrg}
                AND RIGHT(REGEXP_REPLACE(cr2.phone, '\\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(cc.phone, '\\D', '', 'g'), 10)
              ORDER BY cr2.created_at DESC NULLS LAST LIMIT 1
            ) as campaign_name
          FROM chat_conversations cc
          WHERE cc.organization_id = ${effectiveOrg}
          ${instanceId && instanceId !== "ALL" ? this.db.sql`AND cc.instance_id = ${instanceId}` : this.db.sql``}
          ${filter === "unread" ? this.db.sql`AND cc.unread_count > 0` : this.db.sql``}
          ${filter === "awaiting_reply" ? this.db.sql`AND (cc.status = 'AWAITING_REPLY' OR cc.last_message_direction = 'INCOMING')` : this.db.sql``}
          ${filter === "groups" ? this.db.sql`AND cc.is_group = TRUE` : this.db.sql``}
          ${filter === "business" ? this.db.sql`AND cc.is_business = TRUE` : this.db.sql``}
          ${filter === "archived" ? this.db.sql`AND cc.status = 'ARCHIVED'` : this.db.sql`AND cc.status != 'ARCHIVED'`}
          ${filter === "tags" ? this.db.sql`AND cardinality(cc.tags) > 0` : this.db.sql``}
          ${cleanSearch ? this.db.sql`AND (cc.phone ILIKE ${'%' + cleanSearch + '%'} OR cc.contact_name ILIKE ${'%' + cleanSearch + '%'} OR cc.last_message ILIKE ${'%' + cleanSearch + '%'})` : this.db.sql``}
          ORDER BY cc.last_message_at DESC NULLS LAST
          LIMIT 100
        `;
      }

      // Deduplicate rows by 10-digit phone suffix so one customer never has multiple cards
      const uniqueByPhone = new Map<string, any>();
      for (const r of rows) {
        const p10 = (r.phone || "").replace(/\D/g, "").slice(-10);
        if (!uniqueByPhone.has(p10)) {
          uniqueByPhone.set(p10, r);
        }
      }

      return Array.from(uniqueByPhone.values()).map((r) => this.mapConversation(r));
    } catch (err: any) {
      this.logger.warn(`Error fetching conversations: ${err.message}`);
      return [];
    }
  }

  async getMessages(
    conversationId: string,
    orgId: string,
    limit = 30,
    before?: string,
    campaignId?: string
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    try {
      const cleanPhone10 = (conversationId || "").replace(/\D/g, "").slice(-10);
      const queryLimit = Math.min(Math.max(limit, 10), 100);
      const effectiveOrg = orgId || "org-demo";

      // 1. Fetch direct chat messages for this contact (reverse order for pagination)
      const chatRows = await this.db.sql`
        SELECT 
          cm.*,
          (
            SELECT c.name 
            FROM campaign_recipients cr
            JOIN campaigns c ON c.id = cr.campaign_id
            WHERE cr.message_id = cm.message_id
              AND cr.organization_id = ${effectiveOrg}
              AND c.organization_id = ${effectiveOrg}
            ORDER BY cr.created_at DESC NULLS LAST LIMIT 1
          ) as campaign_name
        FROM chat_messages cm
        WHERE cm.organization_id = ${effectiveOrg}
          AND (cm.conversation_id = ${conversationId}
           OR RIGHT(REGEXP_REPLACE(cm.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
           OR cm.conversation_id = ${'conv_' + effectiveOrg + '_' + cleanPhone10})
        ${before ? this.db.sql`AND cm.created_at < ${before}::timestamptz` : this.db.sql``}
        ORDER BY cm.created_at DESC
        LIMIT ${queryLimit + 1}
      `;

      const hasMore = chatRows.length > queryLimit;
      const slicedChatRows = hasMore ? chatRows.slice(0, queryLimit) : chatRows;

      const existingMsgIds = new Set(slicedChatRows.map((m: any) => m.message_id).filter(Boolean));
      const merged: any[] = [...slicedChatRows];

      // 2. Fetch campaign broadcasts sent to this contact across all campaigns
      const campaignBroadcasts = await this.db.sql`
        SELECT 
          cr.id as recipient_id,
          cr.campaign_id,
          cr.message_id,
          cr.phone,
          cr.name as recipient_name,
          cr.status as recipient_status,
          cr.sent_at,
          cr.created_at,
          cr.error_message,
          c.name as campaign_name,
          c.message_text,
          c.media_url,
          c.header_media_url,
          c.meta_template_name,
          c.content_type,
          c.poll_question,
          c.action_buttons
        FROM campaign_recipients cr
        JOIN campaigns c ON c.id = cr.campaign_id
        WHERE cr.organization_id = ${effectiveOrg}
          AND c.organization_id = ${effectiveOrg}
          AND RIGHT(REGEXP_REPLACE(cr.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
          ${campaignId ? this.db.sql`AND cr.campaign_id = ${campaignId}` : this.db.sql``}
          ${before ? this.db.sql`AND COALESCE(cr.sent_at, cr.created_at) < ${before}::timestamptz` : this.db.sql``}
        ORDER BY COALESCE(cr.sent_at, cr.created_at) DESC
        LIMIT ${queryLimit}
      `.catch(() => []);

      for (const cb of campaignBroadcasts || []) {
        if (!cb.message_id || !existingMsgIds.has(cb.message_id)) {
          const mediaLink = cb.header_media_url || cb.media_url;
          merged.push({
            id: `cmp_msg_${cb.recipient_id || cb.campaign_id}_${cleanPhone10}`,
            conversation_id: conversationId,
            organization_id: orgId || "org-demo",
            phone: cb.phone,
            message_id: cb.message_id,
            direction: "OUTGOING",
            senderName: cb.campaign_name || "Campaign Broadcast",
            messageType: mediaLink ? "MEDIA" : (cb.content_type || "TEXT"),
            content: cb.message_text || cb.poll_question || `Broadcast: ${cb.campaign_name}`,
            mediaUrl: mediaLink || undefined,
            status: cb.recipient_status || "DELIVERED",
            campaignName: cb.campaign_name,
            isCampaignBroadcast: true,
            createdAt: cb.sent_at || cb.created_at || new Date(),
          });
          if (cb.message_id) existingMsgIds.add(cb.message_id);
        }
      }

      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Deduplicate messages by message_id or identical (direction, content, 3-second window)
      const deduplicatedMessages: any[] = [];
      const seenIds = new Set<string>();
      const seenFingerprints = new Set<string>();

      for (const m of merged) {
        if (m.message_id && seenIds.has(m.message_id)) {
          continue;
        }
        if (m.message_id) {
          seenIds.add(m.message_id);
        }

        const timeBucket = Math.floor(new Date(m.created_at).getTime() / 3000);
        const fingerprint = `${m.direction}_${(m.phone || "").slice(-10)}_${(m.content || "").trim()}_${timeBucket}`;
        if (seenFingerprints.has(fingerprint)) {
          continue;
        }
        seenFingerprints.add(fingerprint);

        deduplicatedMessages.push(m);
      }

      return {
        messages: deduplicatedMessages.map((r) => this.mapMessage(r)),
        hasMore,
      };
    } catch (err: any) {
      this.logger.warn(`Error fetching messages for ${conversationId}: ${err.message}`);
      return { messages: [], hasMore: false };
    }
  }

  async sendMessage(
    orgId: string,
    payload: {
      conversationId?: string;
      phone: string;
      instanceId?: string;
      text?: string;
      mediaUrl?: string;
      messageType?: string;
      quotedMessageId?: string;
      quotedContent?: string;
      quotedSender?: string;
      contactName?: string;
    }
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhone = (payload.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException("Invalid recipient phone number format.");
    }

    const textToSend = payload.text?.trim() || "";
    if (!textToSend && !payload.mediaUrl) {
      throw new BadRequestException("Message text or media is required.");
    }

    // Check if Meta WhatsApp Cloud API (WABA) is configured for this organization
    const wabaConfig = await this.wabaService.getConfig(effectiveOrg);
    const isWaba = Boolean(
      wabaConfig &&
      wabaConfig.status === "CONNECTED" &&
      wabaConfig.phoneNumberId &&
      wabaConfig.accessToken
    );

    let dispatchedMessageId: string | undefined;
    let activeInstanceId = payload.instanceId || "waba-cloud";

    if (isWaba) {
      activeInstanceId = wabaConfig!.phoneNumberId || "waba-cloud";
      if (payload.mediaUrl) {
        const rawType = (payload.messageType || "").toUpperCase();
        const mediaType = rawType === "DOCUMENT" || rawType.includes("PDF") || rawType.includes("DOC")
          ? "DOCUMENT"
          : rawType === "VIDEO"
          ? "VIDEO"
          : "IMAGE";

        const wabaRes = await this.wabaService.sendMediaMessage(
          effectiveOrg,
          cleanPhone,
          mediaType as any,
          payload.mediaUrl,
          textToSend || undefined,
          undefined,
          payload.quotedMessageId
        );

        if (!wabaRes.success) {
          const err = wabaRes.error || "Failed to send media via Meta Cloud API";
          if (err.includes("131047") || err.toLowerCase().includes("re-engagement") || err.toLowerCase().includes("24 hours")) {
            throw new BadRequestException("Meta 24-Hour Window: Freeform customer replies can only be sent within 24 hours of the customer's last incoming message. Outside the 24h window, Meta requires initiating contact using an approved template campaign.");
          }
          throw new BadRequestException(`Meta Cloud API Error: ${err}`);
        }
        dispatchedMessageId = wabaRes.messageId;
      } else {
        const wabaRes = await this.wabaService.sendTextMessage(
          effectiveOrg,
          cleanPhone,
          textToSend,
          payload.quotedMessageId
        );
        if (!wabaRes.success) {
          const err = wabaRes.error || "Failed to send text via Meta Cloud API";
          if (err.includes("131047") || err.toLowerCase().includes("re-engagement") || err.toLowerCase().includes("24 hours")) {
            throw new BadRequestException("Meta 24-Hour Window: Freeform customer replies can only be sent within 24 hours of the customer's last incoming message. Outside the 24h window, Meta requires initiating contact using an approved template campaign.");
          }
          throw new BadRequestException(`Meta Cloud API Error: ${err}`);
        }
        dispatchedMessageId = wabaRes.messageId;
      }
    } else {
      // Fallback to legacy Baileys socket only if WABA is not configured
      const activeNumberId = payload.instanceId || this.sessionManager.getActiveSessionNumberId(effectiveOrg);
      if (!activeNumberId) {
        throw new BadRequestException("No WhatsApp outlet connected. Please configure your Official Meta Cloud API (WABA) in Settings.");
      }
      activeInstanceId = activeNumberId;

      const sendRes = await this.sessionManager.sendBroadcastMessage({
        numberId: activeNumberId,
        orgId: effectiveOrg,
        recipientPhoneNumber: cleanPhone,
        text: textToSend,
        mediaUrl: payload.mediaUrl,
        messageType: payload.messageType || (payload.mediaUrl ? "media" : "text"),
      });
      dispatchedMessageId = sendRes.messageId;
    }

    const conversationId = `conv_${effectiveOrg}_${cleanPhone.slice(-10)}`;
    const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Resolve contact name for new or existing conversations
    let resolvedName = payload.contactName?.trim();
    if (!resolvedName) {
      const contactRows = await this.db.sql`
        SELECT name FROM public.contacts 
        WHERE organization_id = ${effectiveOrg}
          AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone.slice(-10)}
        LIMIT 1
      `.catch(() => []);
      if (contactRows && contactRows.length > 0 && contactRows[0].name) {
        resolvedName = contactRows[0].name;
      }
    }
    resolvedName = resolvedName || `+${cleanPhone}`;

    // 2. Persist Message into Supabase
    const msgRecord: ChatMessage = {
      id: messageId,
      conversationId,
      organizationId: effectiveOrg,
      instanceId: activeInstanceId,
      phone: cleanPhone,
      messageId: dispatchedMessageId,
      direction: "OUTGOING",
      senderName: "Agent",
      messageType: payload.messageType || (payload.mediaUrl ? "MEDIA" : "TEXT"),
      content: textToSend,
      mediaUrl: payload.mediaUrl,
      status: "SENT",
      quotedMessageId: payload.quotedMessageId,
      quotedContent: payload.quotedContent,
      quotedSender: payload.quotedSender,
      sentAt: new Date(),
      createdAt: new Date(),
    };

    try {
      await this.db.sql`
        INSERT INTO chat_messages (
          id, conversation_id, organization_id, instance_id, phone, message_id,
          direction, sender_name, message_type, content, media_url, status,
          quoted_message_id, quoted_content, quoted_sender,
          sent_at, delivered_at, created_at
        ) VALUES (
          ${msgRecord.id}, ${msgRecord.conversationId}, ${msgRecord.organizationId}, ${msgRecord.instanceId}, ${msgRecord.phone}, ${msgRecord.messageId},
          ${msgRecord.direction}, ${msgRecord.senderName}, ${msgRecord.messageType}, ${msgRecord.content}, ${msgRecord.mediaUrl || null}, ${msgRecord.status},
          ${msgRecord.quotedMessageId || null}, ${msgRecord.quotedContent || null}, ${msgRecord.quotedSender || null},
          NOW(), NOW(), NOW()
        )
      `;

      // 3. Upsert Conversation
      await this.db.sql`
        INSERT INTO chat_conversations (
          id, organization_id, instance_id, phone, contact_name,
          last_message, last_message_at, last_message_type, last_message_direction,
          unread_count, status, created_at, updated_at
        ) VALUES (
          ${conversationId}, ${effectiveOrg}, ${activeInstanceId}, ${cleanPhone}, ${resolvedName},
          ${textToSend || (payload.mediaUrl ? 'Photo/Media' : 'Message')}, NOW(), ${msgRecord.messageType}, 'OUTGOING',
          0, 'REPLIED', NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          last_message = EXCLUDED.last_message,
          last_message_at = NOW(),
          last_message_type = EXCLUDED.last_message_type,
          last_message_direction = 'OUTGOING',
          contact_name = COALESCE(EXCLUDED.contact_name, chat_conversations.contact_name),
          status = 'REPLIED',
          updated_at = NOW()
      `;

      // 4. Emit live WebSocket updates
      this.gateway.emitChatMessage(effectiveOrg, msgRecord);
      this.gateway.emitConversationUpdated(effectiveOrg, {
        conversationId,
        lastMessage: textToSend,
        lastMessageAt: new Date(),
        lastMessageDirection: "OUTGOING",
        status: "REPLIED",
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist chat message in DB: ${err.message}`);
    }

    return {
      success: true,
      message: msgRecord,
    };
  }

  /**
   * Send approved Meta template directly to any number (works outside 24h window)
   */
  async sendTemplateMessage(
    orgId: string,
    payload: {
      phone: string;
      templateName: string;
      languageCode?: string;
      components?: any[];
      contactName?: string;
      instanceId?: string;
    }
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhone = (payload.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException("Invalid recipient phone number format.");
    }
    if (!payload.templateName) {
      throw new BadRequestException("Template name is required.");
    }

    const wabaConfig = await this.wabaService.getConfig(effectiveOrg);
    if (!wabaConfig || wabaConfig.status !== "CONNECTED") {
      throw new BadRequestException("Official Meta WhatsApp Cloud API (WABA) is not connected.");
    }

    const lang = payload.languageCode || "en_US";
    const res = await this.wabaService.sendTemplateMessage(
      effectiveOrg,
      cleanPhone,
      payload.templateName,
      lang,
      payload.components || []
    );

    if (!res.success) {
      throw new BadRequestException(`Meta Cloud API Error: ${res.error || "Failed to send template"}`);
    }

    const conversationId = `conv_${effectiveOrg}_${cleanPhone.slice(-10)}`;
    const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Resolve contact name
    let resolvedName = payload.contactName?.trim();
    if (!resolvedName) {
      const contactRows = await this.db.sql`
        SELECT name FROM public.contacts 
        WHERE organization_id = ${effectiveOrg}
          AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone.slice(-10)}
        LIMIT 1
      `.catch(() => []);
      if (contactRows && contactRows.length > 0 && contactRows[0].name) {
        resolvedName = contactRows[0].name;
      }
    }
    resolvedName = resolvedName || `+${cleanPhone}`;

    const msgRecord: ChatMessage = {
      id: messageId,
      conversationId,
      organizationId: effectiveOrg,
      instanceId: wabaConfig.phoneNumberId || "waba-cloud",
      phone: cleanPhone,
      messageId: res.messageId,
      direction: "OUTGOING",
      senderName: "Business",
      messageType: "TEMPLATE",
      content: `Template: ${payload.templateName}`,
      status: "SENT",
      sentAt: new Date(),
      createdAt: new Date(),
    };

    try {
      await this.db.sql`
        INSERT INTO chat_messages (
          id, conversation_id, organization_id, instance_id, phone, message_id,
          direction, sender_name, message_type, content, status,
          sent_at, created_at
        ) VALUES (
          ${msgRecord.id}, ${msgRecord.conversationId}, ${msgRecord.organizationId}, ${msgRecord.instanceId}, ${msgRecord.phone}, ${msgRecord.messageId},
          'OUTGOING', 'Business', 'TEMPLATE', ${msgRecord.content}, 'SENT',
          NOW(), NOW()
        )
      `;

      await this.db.sql`
        INSERT INTO chat_conversations (
          id, organization_id, instance_id, phone, contact_name,
          last_message, last_message_at, last_message_type, last_message_direction,
          unread_count, status, created_at, updated_at
        ) VALUES (
          ${conversationId}, ${effectiveOrg}, ${msgRecord.instanceId}, ${cleanPhone}, ${resolvedName},
          ${msgRecord.content}, NOW(), 'TEMPLATE', 'OUTGOING',
          0, 'REPLIED', NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          last_message = EXCLUDED.last_message,
          last_message_at = NOW(),
          last_message_type = 'TEMPLATE',
          last_message_direction = 'OUTGOING',
          contact_name = COALESCE(EXCLUDED.contact_name, chat_conversations.contact_name),
          updated_at = NOW()
      `;

      this.gateway.emitChatMessage(effectiveOrg, msgRecord);
      this.gateway.emitConversationUpdated(effectiveOrg, {
        conversationId,
        lastMessage: msgRecord.content,
        lastMessageAt: new Date(),
        lastMessageDirection: "OUTGOING",
        status: "REPLIED",
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist template message in DB: ${err.message}`);
    }

    return { success: true, message: msgRecord };
  }

  /**
   * Initiate a conversation with a new phone number so it appears in the inbox immediately
   */
  async initiateConversation(
    orgId: string,
    phone: string,
    contactName?: string
  ): Promise<ChatConversation> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhone = (phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException("Please enter a valid phone number (at least 10 digits).");
    }

    const cleanPhone10 = cleanPhone.slice(-10);
    const conversationId = `conv_${effectiveOrg}_${cleanPhone10}`;

    // Check if conversation already exists
    const existing = await this.db.sql`
      SELECT * FROM chat_conversations 
      WHERE organization_id = ${effectiveOrg}
        AND (id = ${conversationId} OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10})
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      return this.mapConversation(existing[0]);
    }

    // Resolve name from contacts if not provided
    let resolvedName = contactName?.trim();
    if (!resolvedName) {
      const contactRows = await this.db.sql`
        SELECT name FROM public.contacts 
        WHERE organization_id = ${effectiveOrg}
          AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
        LIMIT 1
      `.catch(() => []);
      if (contactRows && contactRows.length > 0 && contactRows[0].name) {
        resolvedName = contactRows[0].name;
      }
    }
    resolvedName = resolvedName || `+${cleanPhone}`;

    // Insert new conversation record
    const newConv = await this.db.sql`
      INSERT INTO chat_conversations (
        id, organization_id, instance_id, phone, contact_name,
        last_message, last_message_at, last_message_type, last_message_direction,
        unread_count, status, created_at, updated_at
      ) VALUES (
        ${conversationId}, ${effectiveOrg}, 'waba-cloud', ${cleanPhone}, ${resolvedName},
        'Conversation started', NOW(), 'TEXT', 'OUTGOING',
        0, 'OPEN', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        contact_name = COALESCE(EXCLUDED.contact_name, chat_conversations.contact_name),
        updated_at = NOW()
      RETURNING *
    `;

    const mapped = this.mapConversation(newConv[0]);
    this.gateway.emitConversationUpdated(effectiveOrg, mapped);
    return mapped;
  }

  async markConversationRead(conversationId: string, orgId: string): Promise<boolean> {
    const effectiveOrg = orgId || "org-demo";
    try {
      await this.db.sql`
        UPDATE chat_conversations
        SET unread_count = 0, updated_at = NOW()
        WHERE (id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)})
          AND organization_id = ${effectiveOrg}
      `;
      this.gateway.emitConversationUpdated(effectiveOrg, {
        conversationId,
        unreadCount: 0,
      });
      return true;
    } catch {
      return false;
    }
  }

  async clearConversation(conversationId: string, orgId: string): Promise<boolean> {
    const effectiveOrg = orgId || "org-demo";
    try {
      await this.db.sql`
        DELETE FROM chat_messages 
        WHERE (conversation_id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)})
          AND organization_id = ${effectiveOrg}
      `;
      await this.db.sql`
        UPDATE chat_conversations
        SET last_message = '', unread_count = 0, updated_at = NOW()
        WHERE (id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)})
          AND organization_id = ${effectiveOrg}
      `;
      return true;
    } catch {
      return false;
    }
  }

  async clearAll(orgId: string, instanceId?: string): Promise<boolean> {
    const effectiveOrg = orgId || "org-demo";
    try {
      if (instanceId && instanceId !== "ALL") {
        await this.db.sql`
          DELETE FROM chat_messages WHERE instance_id = ${instanceId} AND organization_id = ${effectiveOrg}
        `;
        await this.db.sql`
          DELETE FROM chat_conversations WHERE instance_id = ${instanceId} AND organization_id = ${effectiveOrg}
        `;
      } else {
        await this.db.sql`DELETE FROM chat_messages WHERE organization_id = ${effectiveOrg}`;
        await this.db.sql`DELETE FROM chat_conversations WHERE organization_id = ${effectiveOrg}`;
      }
      return true;
    } catch {
      return false;
    }
  }

  private mapConversation(r: any): ChatConversation {
    const lastAt = r.last_message_at ? new Date(r.last_message_at) : new Date();
    const isIncoming = (r.last_message_direction || "INCOMING") === "INCOMING";
    const windowMs = 24 * 60 * 60 * 1000;
    const customerWindowExpiresAt = isIncoming ? new Date(lastAt.getTime() + windowMs) : undefined;
    const isWindowActive = Boolean(customerWindowExpiresAt && customerWindowExpiresAt.getTime() > Date.now());

    return {
      id: r.id,
      organizationId: r.organization_id,
      instanceId: r.instance_id,
      phone: r.phone,
      contactName: r.contact_name || (r.phone ? `+${r.phone.replace(/\D/g, '')}` : "Customer"),
      lastMessage: r.last_message || "",
      lastMessageAt: lastAt,
      lastMessageType: r.last_message_type || "TEXT",
      lastMessageDirection: r.last_message_direction || "INCOMING",
      unreadCount: Number(r.unread_count) || 0,
      status: r.status || "AWAITING_REPLY",
      tags: Array.isArray(r.tags) ? r.tags : [],
      isGroup: Boolean(r.is_group),
      isBusiness: Boolean(r.is_business),
      campaignName: r.campaign_name || undefined,
      customerWindowExpiresAt,
      isWindowActive,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
    };
  }

  private mapMessage(r: any): ChatMessage {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      organizationId: r.organization_id,
      instanceId: r.instance_id,
      phone: r.phone,
      messageId: r.message_id,
      direction: r.direction || "INCOMING",
      senderName: r.sender_name || (r.direction === "OUTGOING" ? "Agent" : "Customer"),
      messageType: r.message_type || "TEXT",
      content: r.content || "",
      mediaUrl: r.media_url || undefined,
      mediaMimeType: r.media_mime_type || undefined,
      mediaFilename: r.media_filename || undefined,
      interactiveData: r.interactive_data || undefined,
      status: r.status || "DELIVERED",
      campaignName: r.campaign_name || undefined,
      isCampaignBroadcast: Boolean(r.is_campaign_broadcast),
      quotedMessageId: r.quoted_message_id || undefined,
      quotedContent: r.quoted_content || undefined,
      quotedSender: r.quoted_sender || undefined,
      sentAt: r.sent_at ? new Date(r.sent_at) : undefined,
      deliveredAt: r.delivered_at ? new Date(r.delivered_at) : undefined,
      readAt: r.read_at ? new Date(r.read_at) : undefined,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    };
  }
}
