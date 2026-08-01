import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

export interface CampaignItem {
  id: string;
  organizationId: string;
  shopId: string;
  whatsappNumberId: string;
  templateId?: string;
  name: string;
  targetAudienceType: string;
  scheduledAt: Date;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: Date;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private campaignsStore: Map<string, CampaignItem> = new Map();

  constructor(
    @InjectQueue("campaign-dispatch") private dispatchQueue: Queue,
    @InjectQueue("message-sending") private messageQueue: Queue
  ) {
    // Seed initial campaign telemetry
    const demoCampaign: CampaignItem = {
      id: "cmp-001",
      organizationId: "org-demo",
      shopId: "shop-main",
      whatsappNumberId: "num-01",
      name: "August Vision Retest Recall Campaign",
      targetAudienceType: "CRM_TAG:DUE_FOR_RETEST",
      scheduledAt: new Date(),
      status: "PROCESSING",
      totalRecipients: 64,
      sentCount: 42,
      deliveredCount: 38,
      readCount: 29,
      failedCount: 1,
      createdAt: new Date(),
    };
    this.campaignsStore.set(demoCampaign.id, demoCampaign);
  }

  findAll(orgId: string): CampaignItem[] {
    return Array.from(this.campaignsStore.values()).filter(
      (c) => c.organizationId === orgId || c.organizationId === "org-demo"
    );
  }

  findOne(id: string): CampaignItem {
    const cmp = this.campaignsStore.get(id);
    if (!cmp) {
      throw new NotFoundException(`Campaign with ID ${id} not found.`);
    }
    return cmp;
  }

  async createAndLaunch(orgId: string, payload: {
    shopId: string;
    whatsappNumberId: string;
    name: string;
    targetAudienceType: string;
    templateId?: string;
    recipients: Array<{ id: string; phone: string; name?: string; variables?: Record<string, string> }>;
    messageText: string;
    mediaUrl?: string;
  }): Promise<CampaignItem> {
    const newCampaign: CampaignItem = {
      id: `cmp-${Date.now()}`,
      organizationId: orgId,
      shopId: payload.shopId,
      whatsappNumberId: payload.whatsappNumberId,
      templateId: payload.templateId,
      name: payload.name,
      targetAudienceType: payload.targetAudienceType,
      scheduledAt: new Date(),
      status: "PROCESSING",
      totalRecipients: payload.recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      createdAt: new Date(),
    };

    this.campaignsStore.set(newCampaign.id, newCampaign);

    // Enqueue dispatches to BullMQ Queue
    await this.dispatchQueue.add("launch-campaign", {
      campaignId: newCampaign.id,
      organizationId: orgId,
      shopId: payload.shopId,
      whatsappNumberId: payload.whatsappNumberId,
      recipients: payload.recipients,
      messageText: payload.messageText,
      mediaUrl: payload.mediaUrl,
    });

    this.logger.log(`Enqueued campaign ${newCampaign.id} (${newCampaign.name}) for ${payload.recipients.length} recipients.`);
    return newCampaign;
  }

  async pauseCampaign(id: string): Promise<CampaignItem> {
    const cmp = this.findOne(id);
    cmp.status = "PAUSED";
    this.logger.log(`Paused campaign ${id}`);
    return cmp;
  }

  async resumeCampaign(id: string): Promise<CampaignItem> {
    const cmp = this.findOne(id);
    cmp.status = "PROCESSING";
    this.logger.log(`Resumed campaign ${id}`);
    return cmp;
  }
}
