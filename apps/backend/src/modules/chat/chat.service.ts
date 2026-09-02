import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";
import { BroadcastGateway } from "../whatsapp-session/whatsapp.gateway";

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
  status: "AWAITING_REPLY" | "REPLIED" | "ARCHIVED";
  tags: string[];
  isGroup: boolean;
  isBusiness: boolean;
  createdAt: Date;
  updatedAt: Date;
  campaignName?: string;
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
    private readonly gateway: BroadcastGateway
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
              WHERE RIGHT(REGEXP_REPLACE(cr2.phone, '\\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(cc.phone, '\\D', '', 'g'), 10)
              ORDER BY cr2.created_at DESC NULLS LAST LIMIT 1
            ) as campaign_name
          FROM chat_conversations cc
          WHERE (cc.organization_id = ${effectiveOrg} OR cc.organization_id = 'org-demo' OR cc.organization_id IS NOT NULL)
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

      // 1. Fetch direct chat messages for this contact (reverse order for pagination)
      const chatRows = await this.db.sql`
        SELECT 
          cm.*,
          (
            SELECT c.name 
            FROM campaign_recipients cr
            JOIN campaigns c ON c.id = cr.campaign_id
            WHERE cr.message_id = cm.message_id
            ORDER BY cr.created_at DESC NULLS LAST LIMIT 1
          ) as campaign_name
        FROM chat_messages cm
        WHERE (cm.conversation_id = ${conversationId}
           OR RIGHT(REGEXP_REPLACE(cm.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
           OR cm.conversation_id LIKE ${'%' + cleanPhone10})
        ${before ? this.db.sql`AND cm.created_at < ${before}::timestamptz` : this.db.sql``}
        ORDER BY cm.created_at DESC
        LIMIT ${queryLimit + 1}
      `;

      const hasMore = chatRows.length > queryLimit;
      const slicedChatRows = hasMore ? chatRows.slice(0, queryLimit) : chatRows;

      const existingMsgIds = new Set(slicedChatRows.map((m: any) => m.message_id).filter(Boolean));
      const merged: any[] = [...slicedChatRows];

      // 2. ONLY fetch campaign broadcast if a specific campaignId is requested (e.g. Campaign Reply Wizard)
      if (campaignId) {
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
            c.name as campaign_name,
            c.message_text,
            c.media_url,
            c.content_type,
            c.poll_question,
            c.action_buttons
          FROM campaign_recipients cr
          JOIN campaigns c ON c.id = cr.campaign_id
          WHERE cr.campaign_id = ${campaignId}
            AND RIGHT(REGEXP_REPLACE(cr.phone, '\\D', '', 'g'), 10) = ${cleanPhone10}
            AND cr.sent_at IS NOT NULL
          ORDER BY COALESCE(cr.sent_at, cr.created_at) DESC
          LIMIT 1
        `;

        for (const cb of campaignBroadcasts || []) {
          if (!cb.message_id || !existingMsgIds.has(cb.message_id)) {
            merged.push({
              id: `cmp_msg_${cb.campaign_id}_${cleanPhone10}`,
              conversation_id: conversationId,
              organization_id: orgId || "org-demo",
              phone: cb.phone,
              message_id: cb.message_id,
              direction: "OUTGOING",
              sender_name: "Broadcast",
              message_type: cb.content_type || (cb.media_url ? "MEDIA" : "TEXT"),
              content: cb.message_text || cb.poll_question || "Campaign Broadcast",
              media_url: cb.media_url,
              status: cb.recipient_status || "DELIVERED",
              campaign_name: cb.campaign_name,
              is_campaign_broadcast: true,
              created_at: cb.sent_at || cb.created_at || new Date(),
            });
            if (cb.message_id) existingMsgIds.add(cb.message_id);
          }
        }
      }

      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return {
        messages: merged.map((r) => this.mapMessage(r)),
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
    }
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhone = (payload.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException("Invalid recipient phone number format.");
    }

    const activeNumberId = payload.instanceId || this.sessionManager.getActiveSessionNumberId();
    if (!activeNumberId) {
      throw new BadRequestException("No active WhatsApp outlet connected. Please pair a device first.");
    }

    const textToSend = payload.text?.trim() || "";
    if (!textToSend && !payload.mediaUrl) {
      throw new BadRequestException("Message text or media is required.");
    }

    // 1. Dispatch through Baileys socket
    const sendRes = await this.sessionManager.sendBroadcastMessage({
      numberId: activeNumberId,
      recipientPhoneNumber: cleanPhone,
      text: textToSend,
      mediaUrl: payload.mediaUrl,
      messageType: payload.messageType || (payload.mediaUrl ? "media" : "text"),
    });

    const conversationId = `conv_${effectiveOrg}_${cleanPhone.slice(-10)}`;
    const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // 2. Persist Message into Supabase
    const msgRecord: ChatMessage = {
      id: messageId,
      conversationId,
      organizationId: effectiveOrg,
      instanceId: activeNumberId,
      phone: cleanPhone,
      messageId: sendRes.messageId,
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
          ${conversationId}, ${effectiveOrg}, ${activeNumberId}, ${cleanPhone}, ${'Customer'},
          ${textToSend || (payload.mediaUrl ? 'Photo/Media' : 'Message')}, NOW(), ${msgRecord.messageType}, 'OUTGOING',
          0, 'REPLIED', NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          last_message = EXCLUDED.last_message,
          last_message_at = NOW(),
          last_message_type = EXCLUDED.last_message_type,
          last_message_direction = 'OUTGOING',
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

  async markConversationRead(conversationId: string, orgId: string): Promise<boolean> {
    const effectiveOrg = orgId || "org-demo";
    try {
      await this.db.sql`
        UPDATE chat_conversations
        SET unread_count = 0, updated_at = NOW()
        WHERE (id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)})
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
        WHERE conversation_id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)}
      `;
      await this.db.sql`
        UPDATE chat_conversations
        SET last_message = '', unread_count = 0, updated_at = NOW()
        WHERE id = ${conversationId} OR RIGHT(phone, 10) = ${conversationId.slice(-10)}
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
          DELETE FROM chat_messages WHERE instance_id = ${instanceId}
        `;
        await this.db.sql`
          DELETE FROM chat_conversations WHERE instance_id = ${instanceId}
        `;
      } else {
        await this.db.sql`DELETE FROM chat_messages`;
        await this.db.sql`DELETE FROM chat_conversations`;
      }
      return true;
    } catch {
      return false;
    }
  }

  private mapConversation(r: any): ChatConversation {
    return {
      id: r.id,
      organizationId: r.organization_id,
      instanceId: r.instance_id,
      phone: r.phone,
      contactName: r.contact_name || (r.phone ? `+${r.phone.replace(/\D/g, '')}` : "Customer"),
      lastMessage: r.last_message || "",
      lastMessageAt: r.last_message_at ? new Date(r.last_message_at) : new Date(),
      lastMessageType: r.last_message_type || "TEXT",
      lastMessageDirection: r.last_message_direction || "INCOMING",
      unreadCount: Number(r.unread_count) || 0,
      status: r.status || "AWAITING_REPLY",
      tags: Array.isArray(r.tags) ? r.tags : [],
      isGroup: Boolean(r.is_group),
      isBusiness: Boolean(r.is_business),
      campaignName: r.campaign_name || undefined,
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
