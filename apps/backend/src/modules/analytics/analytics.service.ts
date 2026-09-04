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

export interface DailyActivityPoint {
  date: string;
  label: string;
  sent: number;
  delivered: number;
  read: number;
  replies: number;
}

export interface RecentCampaignSummary {
  id: string;
  name: string;
  status: string;
  targetAudienceType: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  scheduledAt: string;
  createdAt: string;
}

export interface DashboardMetrics {
  // Account & Devices
  devicesCount: number;
  totalInstances: number;
  connectedInstancesCount: number;
  devicesStatus: "CONNECTED" | "DISCONNECTED";
  activeInstanceName: string;
  activePhoneNumber: string | null;
  instancesList: Array<{
    id: string;
    instanceName: string;
    phoneNumber: string | null;
    status: string;
    connectedAt: string | null;
  }>;

  // Contacts & Audience
  totalContacts: number;
  activeSubscribers: number;
  unsubscribedCount: number;
  totalSubscribers: number; // legacy compatibility

  // Broadcast KPIs
  totalCampaigns: number;
  totalMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
  pendingMessages: number;
  pausedMessages: number;
  deliveryRate: number; // percentage
  readRate: number; // percentage

  // Conversations & Automation
  incomingReplies: number;
  autoReplyMessages: number;
  autoReplyCount: number;
  welcomeMessageCount: number;
  welcomeMessages: number;
  templatesCount: number;

  // Diagnostics Breakdown
  errorWhileSending: number;
  invalidNumber: number;
  cancelledMessages: number;
  instanceNotConnected: number;
  instanceNotFound: number;
  notAWhatsAppNumber: number;

  // Visual Trends & Recents
  dailyTrends: DailyActivityPoint[];
  recentCampaigns: RecentCampaignSummary[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly baileysService: WhatsAppSessionManagerService,
    private readonly db: DatabaseService
  ) {}

  getCampaignRecipients(orgId: string, campaignId: string): RecipientAuditItem[] {
    const realRecipients = this.campaignsService.getRecipients(orgId, campaignId);
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
    const sessionStatus = this.baileysService.getSessionStatus(orgId);
    const instances = await this.baileysService.getInstances(orgId);

    let totalMessages = 0;
    let pendingMessages = 0;
    let sentMessages = 0;
    let deliveredMessages = 0;
    let readMessages = 0;
    let failedMessages = 0;
    let pausedMessages = 0;
    let cancelledMessages = 0;

    let errorWhileSending = 0;
    let invalidNumber = 0;
    let instanceNotConnected = 0;
    let instanceNotFound = 0;
    let notAWhatsAppNumber = 0;

    // Build 7-day trend map
    const dayMap = new Map<string, { sent: number; delivered: number; read: number; replies: number }>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoKey = d.toISOString().slice(0, 10);
      dayMap.set(isoKey, { sent: 0, delivered: 0, read: 0, replies: 0 });
    }

    campaigns.forEach((cmp) => {
      const recCount = cmp.totalRecipients || 0;
      totalMessages += recCount;
      const cSent = cmp.sentCount || 0;
      const cDelivered = cmp.deliveredCount || 0;
      const cRead = cmp.readCount || 0;
      const cFailed = cmp.failedCount || 0;

      sentMessages += (cSent + cDelivered + cRead);
      deliveredMessages += (cDelivered + cRead);
      readMessages += cRead;
      failedMessages += cFailed;

      if (cmp.status === "PAUSED") {
        pausedMessages += Math.max(0, recCount - (cSent + cDelivered + cRead));
      } else if (cmp.status === "SCHEDULED" || cmp.status === "DRAFT") {
        pendingMessages += recCount;
      } else if (cmp.status === "CANCELLED") {
        cancelledMessages += Math.max(0, recCount - (cSent + cDelivered + cRead));
      }

      // Populate daily activity from recipients
      (cmp.recipients || []).forEach((r) => {
        if (r.sentAt) {
          const sKey = new Date(r.sentAt).toISOString().slice(0, 10);
          if (dayMap.has(sKey)) {
            const entry = dayMap.get(sKey)!;
            entry.sent++;
            if (r.status === "DELIVERED" || r.status === "READ") entry.delivered++;
            if (r.status === "READ") entry.read++;
          }
        }

        if (r.status === "FAILED") {
          const err = (r.errorMessage || "").toLowerCase();
          if (err.includes("not registered") || err.includes("non-whatsapp")) {
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

    // Database counts
    let totalContacts = 0;
    let unsubscribedCount = 0;
    let templatesCount = 0;
    let autoReplyCount = 0;
    let welcomeMessageCount = 0;
    let incomingReplies = 0;

    try {
      const [cRes, uRes, tRes, aRes, wRes, msgRes] = await Promise.all([
        this.db.sql`SELECT COUNT(*)::int as count FROM contacts WHERE organization_id = ${orgId}`,
        this.db.sql`SELECT COUNT(*)::int as count FROM unsubscribers WHERE organization_id = ${orgId}`,
        this.db.sql`SELECT COUNT(*)::int as count FROM broadcast_templates WHERE organization_id = ${orgId} OR organization_id = 'system'`,
        this.db.sql`SELECT COUNT(*)::int as count FROM auto_reply_rules WHERE organization_id = ${orgId} AND enabled = true`,
        this.db.sql`SELECT COUNT(*)::int as count FROM welcome_message_logs WHERE organization_id = ${orgId}`,
        this.db.sql`SELECT COUNT(*)::int as count FROM chat_messages WHERE organization_id = ${orgId} AND direction = 'INCOMING'`,
      ]);

      totalContacts = cRes[0]?.count || 0;
      unsubscribedCount = uRes[0]?.count || 0;
      templatesCount = tRes[0]?.count || 0;
      autoReplyCount = aRes[0]?.count || 0;
      welcomeMessageCount = wRes[0]?.count || 0;
      incomingReplies = msgRes[0]?.count || 0;
    } catch (dbErr: any) {
      this.logger.warn(`Error querying database counts in analytics: ${dbErr.message}`);
    }

    // Daily replies from chat messages
    try {
      const replyRows = await this.db.sql`
        SELECT DATE(created_at)::text as day, COUNT(*)::int as count
        FROM chat_messages
        WHERE organization_id = ${orgId}
          AND direction = 'INCOMING'
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      `;
      (replyRows || []).forEach((row: any) => {
        if (row.day && dayMap.has(row.day)) {
          dayMap.get(row.day)!.replies += (row.count || 0);
        }
      });
    } catch {}

    const dailyTrends: DailyActivityPoint[] = Array.from(dayMap.entries()).map(([dateStr, metrics]) => {
      const d = new Date(dateStr + "T00:00:00Z");
      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
      return {
        date: dateStr,
        label,
        sent: metrics.sent,
        delivered: metrics.delivered,
        read: metrics.read,
        replies: metrics.replies,
      };
    });

    const recentCampaigns: RecentCampaignSummary[] = campaigns.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      targetAudienceType: c.targetAudienceType || "ALL",
      totalRecipients: c.totalRecipients || 0,
      sentCount: c.sentCount || 0,
      deliveredCount: c.deliveredCount || 0,
      readCount: c.readCount || 0,
      failedCount: c.failedCount || 0,
      scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : new Date().toISOString(),
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    }));

    const totalInstances = instances.length;
    const connectedCount = instances.filter((i) => i.status === "CONNECTED").length;
    const activeInst = instances.find((i) => i.status === "CONNECTED");
    const isConnected = connectedCount > 0;

    const deliveryRate = sentMessages > 0 ? Math.round((deliveredMessages / sentMessages) * 100) : 0;
    const readRate = deliveredMessages > 0 ? Math.round((readMessages / deliveredMessages) * 100) : 0;
    const activeSubscribers = Math.max(0, totalContacts - unsubscribedCount);

    return {
      devicesCount: totalInstances,
      totalInstances,
      connectedInstancesCount: connectedCount,
      devicesStatus: isConnected ? "CONNECTED" : "DISCONNECTED",
      activeInstanceName: activeInst?.instanceName || (instances[0]?.instanceName || "WhatsApp Instance"),
      activePhoneNumber: activeInst?.phoneNumber || null,
      instancesList: instances.map((i) => ({
        id: i.id,
        instanceName: i.instanceName || "Outlet",
        phoneNumber: i.phoneNumber,
        status: i.status,
        connectedAt: i.connectedAt ? new Date(i.connectedAt).toISOString() : null,
      })),

      totalContacts,
      activeSubscribers,
      unsubscribedCount,
      totalSubscribers: totalContacts,

      totalCampaigns: campaigns.length,
      totalMessages,
      sentMessages,
      deliveredMessages,
      readMessages,
      failedMessages,
      pendingMessages,
      pausedMessages,
      deliveryRate,
      readRate,

      incomingReplies,
      autoReplyMessages: incomingReplies > 0 ? incomingReplies : 0,
      autoReplyCount,
      welcomeMessageCount,
      welcomeMessages: welcomeMessageCount,
      templatesCount,

      errorWhileSending,
      invalidNumber,
      cancelledMessages,
      instanceNotConnected,
      instanceNotFound,
      notAWhatsAppNumber,

      dailyTrends,
      recentCampaigns,
    };
  }
}
