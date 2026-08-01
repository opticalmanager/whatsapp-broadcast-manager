import { Injectable, Logger } from "@nestjs/common";

export interface RecipientAuditItem {
  id: string;
  campaignId: string;
  recipientPhone: string;
  recipientName: string;
  status: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  messageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  getCampaignRecipients(campaignId: string): RecipientAuditItem[] {
    this.logger.log(`Fetching recipient audit logs for campaign ${campaignId}`);
    return [
      {
        id: "rec-001",
        campaignId,
        recipientPhone: "+91 98765 43210",
        recipientName: "Rahul Mehta",
        status: "READ",
        messageId: "WAMSG-99201",
        sentAt: new Date(Date.now() - 3600000),
        deliveredAt: new Date(Date.now() - 3550000),
        readAt: new Date(Date.now() - 1800000),
      },
      {
        id: "rec-002",
        campaignId,
        recipientPhone: "+91 91234 56789",
        recipientName: "Ananya Rao",
        status: "DELIVERED",
        messageId: "WAMSG-99202",
        sentAt: new Date(Date.now() - 3400000),
        deliveredAt: new Date(Date.now() - 3380000),
      },
      {
        id: "rec-003",
        campaignId,
        recipientPhone: "+91 99887 76655",
        recipientName: "Vikram Sharma",
        status: "FAILED",
        errorMessage: "Phone number not registered on WhatsApp.",
      },
    ];
  }
}
