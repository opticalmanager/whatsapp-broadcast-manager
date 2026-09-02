import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { WhatsAppSessionManagerService } from "../../whatsapp-session/whatsapp-session.service";
import { HumanEngineService } from "../../human-engine/human-engine.service";
import { BroadcastGateway } from "../../whatsapp-session/whatsapp.gateway";

export interface MessageSendingPayload {
  campaignId: string;
  recipientId: string;
  whatsappNumberId: string;
  orgId: string;
  shopId: string;
  phone: string;
  messageText: string;
  mediaUrl?: string;
}

@Processor("message-sending", {
  stalledInterval: 600000, // Check stalled jobs once per 10 mins (conserves Upstash commands)
  drainDelay: 60, // Wait 60s when queue is empty before polling
  maxStalledCount: 1,
})
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly baileysService: WhatsAppSessionManagerService,
    private readonly humanEngineService: HumanEngineService,
    private readonly gateway: BroadcastGateway
  ) {
    super();
  }

  async process(job: Job<MessageSendingPayload>): Promise<any> {
    const { campaignId, whatsappNumberId, phone, messageText, mediaUrl, orgId, shopId } = job.data;

    // 1. Verify Business Hours
    await this.humanEngineService.verifySendingAllowed(whatsappNumberId);

    // 2. Fetch Baileys Socket
    const activeSocket = this.baileysService.getSessionSocket(whatsappNumberId);

    if (!activeSocket || !activeSocket.user?.id) {
      this.logger.warn(`WhatsApp outlet device for session '${whatsappNumberId}' is not connected. Dispatch failed for ${phone}.`);
      return {
        status: "FAILED",
        phone,
        errorMessage: "WhatsApp outlet device is disconnected. Pair device in Settings to send broadcasts.",
      };
    }

    let jid = "";
    try {
      jid = this.baileysService.normalizeWhatsAppJid(phone);
    } catch (e: any) {
      this.logger.warn(`Invalid phone number format: ${phone}`);
      return {
        status: "FAILED",
        phone,
        errorMessage: "Invalid phone number format. Must be a valid 10-digit mobile number.",
      };
    }

    try {
      // 3. Simulate Typing Indicator (Human Behaviour Engine)
      await activeSocket.sendPresenceUpdate("composing", jid).catch(() => {});
      await this.sleep(2000); // 2-second typing presence

      // 4. Send Message via Baileys Socket
      let result;
      if (mediaUrl) {
        result = await activeSocket.sendMessage(jid, { image: { url: mediaUrl }, caption: messageText });
      } else {
        result = await activeSocket.sendMessage(jid, { text: messageText });
      }

      this.logger.log(`Message successfully delivered to ${phone} (WhatsApp Msg ID: ${result?.key?.id || 'OK'})`);

      // 5. Anti-Ban Human Throttle Delay
      const delayMs = this.humanEngineService.getRandomDelayMs(6, 15);
      await this.sleep(delayMs);

      return {
        status: "DELIVERED",
        phone,
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        messageId: result?.key?.id,
      };
    } catch (err: any) {
      this.logger.error(`Baileys socket error sending to ${phone}: ${err.message}`);
      return {
        status: "FAILED",
        phone,
        errorMessage: err.message || "Failed to deliver message via WhatsApp socket.",
      };
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
