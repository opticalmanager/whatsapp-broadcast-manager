import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

export interface CampaignDispatchPayload {
  campaignId: string;
  organizationId: string;
  shopId: string;
  whatsappNumberId: string;
  recipients: Array<{
    id: string;
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }>;
  messageText: string;
  mediaUrl?: string;
}

@Processor("campaign-dispatch")
export class CampaignDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignDispatchProcessor.name);

  async process(job: Job<CampaignDispatchPayload>): Promise<any> {
    const { campaignId, recipients } = job.data;
    this.logger.log(`Dispatching campaign ${campaignId} with ${recipients.length} recipients...`);

    // In full implementation, iterates recipients and enqueues to message-sending queue
    return {
      status: "DISPATCHED",
      totalRecipients: recipients.length,
    };
  }
}
