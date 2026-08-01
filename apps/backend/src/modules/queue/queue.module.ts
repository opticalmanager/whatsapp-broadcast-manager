import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CampaignDispatchProcessor } from "./processors/campaign-dispatch.processor";
import { MessageSendProcessor } from "./processors/message-send.processor";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";
import { HumanEngineModule } from "../human-engine/human-engine.module";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "campaign-dispatch" },
      { name: "message-sending" }
    ),
    WhatsAppSessionModule,
    HumanEngineModule,
  ],
  providers: [CampaignDispatchProcessor, MessageSendProcessor],
  exports: [BullModule],
})
export class QueueModule {}
