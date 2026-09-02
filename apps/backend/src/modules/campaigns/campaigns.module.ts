import { Module } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { AuthModule } from "../auth/auth.module";
import { QueueModule } from "../queue/queue.module";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [AuthModule, QueueModule, WhatsAppSessionModule, SettingsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
