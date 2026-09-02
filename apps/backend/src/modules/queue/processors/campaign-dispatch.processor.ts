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

@Processor("campaign-dispatch", {
  stalledInterval: 600000, // Check stalled jobs once per 10 mins (conserves Upstash commands)
  drainDelay: 60, // Wait 60s when queue is empty before polling
  maxStalledCount: 1,
})
export class CampaignDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignDispatchProcessor.name);

  async process(job: Job<CampaignDispatchPayload>): Promise<any> {
    const { campaignId, recipients } = job.data;
    this.logger.log(`Dispatching campaign ${campaignId} with ${recipients.length} recipients...`);

    return {
      status: "DISPATCHED",
      totalRecipients: recipients.length,
    };
  }
}
