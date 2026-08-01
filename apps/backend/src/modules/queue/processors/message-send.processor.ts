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

@Processor("message-sending")
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
    const socket = this.baileysService.getSessionSocket(whatsappNumberId);
    if (!socket) {
      this.logger.warn(`Baileys session ${whatsappNumberId} not active. Re-initializing...`);
      await this.baileysService.initSession(whatsappNumberId, orgId, shopId);
    }

    const activeSocket = this.baileysService.getSessionSocket(whatsappNumberId);
    const jid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;

    // 3. Simulate Typing Indicator (Human Simulation)
    if (activeSocket) {
      await activeSocket.sendPresenceUpdate("composing", jid).catch(() => {});
      await this.sleep(3000); // 3-second typing presence

      // 4. Send Message via Baileys
      let result;
      if (mediaUrl) {
        result = await activeSocket.sendMessage(jid, { image: { url: mediaUrl }, caption: messageText });
      } else {
        result = await activeSocket.sendMessage(jid, { text: messageText });
      }

      this.logger.log(`Message sent to ${phone} (Msg ID: ${result.key.id})`);
    } else {
      this.logger.warn(`Simulating dispatch to ${phone} (Demo Mode)`);
      await this.sleep(2000);
    }

    // 5. Inject Inter-Message Delay
    const delayMs = this.humanEngineService.getRandomDelayMs(8, 20);
    await this.sleep(delayMs);

    return { status: "SENT", phone };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
