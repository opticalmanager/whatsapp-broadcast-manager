import { Injectable, Logger } from "@nestjs/common";
import { CampaignsService } from "../campaigns/campaigns.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";
import { DatabaseService } from "../../database/database.service";

export interface RecipientAuditItem {
  id: string;
  campaignId: string;
  recipientPhone: string;
  recipientName: string;
  status: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "INVALID_NUMBER" | "NON_WHATSAPP" | "PAUSED" | "CANCELLED" | string;
  messageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface DashboardMetrics {
  devicesCount: number;
  devicesStatus: "CONNECTED" | "DISCONNECTED";
  autoReplyCount: number;
  welcomeMessageCount: number;
  templatesCount: number;
  totalCampaigns: number;

  totalMessages: number;
  pendingMessages: number;
  autoReplyMessages: number;
  welcomeMessages: number;
  sentMessages: number;
  pausedMessages: number;

  errorWhileSending: number;
  invalidNumber: number;
  cancelledMessages: number;
  instanceNotConnected: number;
  instanceNotFound: number;
  notAWhatsAppNumber: number;

  totalSubscribers: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly baileysService: WhatsAppSessionManagerService,
    private readonly db: DatabaseService
  ) {}

  getCampaignRecipients(campaignId: string): RecipientAuditItem[] {
    const realRecipients = this.campaignsService.getRecipients(campaignId);
    if (realRecipients && realRecipients.length > 0) {
      return realRecipients.map((r) => ({
        id: r.id,
        campaignId,
        recipientPhone: r.phone,
        recipientName: r.name || "Customer",
        status: r.status || "PENDING",
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        errorMessage: r.errorMessage,
      }));
    }
    return [];
  }

  async getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
    const campaigns = this.campaignsService.findAll(orgId);
    const sessionStatus = this.baileysService.getSessionStatus();

    let totalMessages = 0;
    let pendingMessages = 0;
    let sentMessages = 0;
    let pausedMessages = 0;
    let errorWhileSending = 0;
    let invalidNumber = 0;
    let cancelledMessages = 0;
    let instanceNotConnected = 0;
    let instanceNotFound = 0;
    let notAWhatsAppNumber = 0;

    campaigns.forEach((cmp) => {
      totalMessages += cmp.totalRecipients || 0;
      sentMessages += (cmp.sentCount || 0) + (cmp.deliveredCount || 0) + (cmp.readCount || 0);
      
      if (cmp.status === "PAUSED") {
        pausedMessages += (cmp.totalRecipients || 0) - (cmp.sentCount || 0);
      } else if (cmp.status === "SCHEDULED" || cmp.status === "DRAFT") {
        pendingMessages += (cmp.totalRecipients || 0);
      } else if (cmp.status === "CANCELLED") {
        cancelledMessages += (cmp.totalRecipients || 0) - (cmp.sentCount || 0);
      }

      (cmp.recipients || []).forEach((r) => {
        if (r.status === "FAILED") {
          const err = (r.errorMessage || "").toLowerCase();
          if (err.includes("not registered on whatsapp")) {
            notAWhatsAppNumber++;
          } else if (err.includes("invalid") || err.includes("format")) {
            invalidNumber++;
          } else if (err.includes("disconnected") || err.includes("not connected")) {
            instanceNotConnected++;
          } else if (err.includes("not found")) {
            instanceNotFound++;
          } else {
            errorWhileSending++;
          }
        }
      });
    });

    let totalSubscribers = 0;
    try {
      const contactCount = await this.db.sql`
        SELECT COUNT(*)::int as count FROM contacts WHERE organization_id = ${orgId || 'org-demo'}
      `;
      totalSubscribers = contactCount[0]?.count || 0;
    } catch {}

    const isConnected = sessionStatus.status === "CONNECTED";

    return {
      devicesCount: isConnected ? 1 : 0,
      devicesStatus: isConnected ? "CONNECTED" : "DISCONNECTED",
      autoReplyCount: 2,
      welcomeMessageCount: 0,
      templatesCount: 1,
      totalCampaigns: campaigns.length,

      totalMessages,
      pendingMessages,
      autoReplyMessages: 3,
      welcomeMessages: 0,
      sentMessages,
      pausedMessages,

      errorWhileSending,
      invalidNumber,
      cancelledMessages,
      instanceNotConnected,
      instanceNotFound,
      notAWhatsAppNumber,

      totalSubscribers,
    };
  }
}
