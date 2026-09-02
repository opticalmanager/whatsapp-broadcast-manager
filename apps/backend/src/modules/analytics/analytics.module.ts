import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { AuthModule } from "../auth/auth.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";

@Module({
  imports: [AuthModule, CampaignsModule, WhatsAppSessionModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
