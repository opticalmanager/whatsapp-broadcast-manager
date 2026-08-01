import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { WhatsAppSessionModule } from "./modules/whatsapp-session/whatsapp-session.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { MediaModule } from "./modules/media/media.module";
import { CrmIntegrationModule } from "./modules/crm-integration/crm-integration.module";
import { HumanEngineModule } from "./modules/human-engine/human-engine.module";
import { QueueModule } from "./modules/queue/queue.module";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";

@Module({
  imports: [
    AuthModule,
    WhatsAppSessionModule,
    TemplatesModule,
    MediaModule,
    CrmIntegrationModule,
    HumanEngineModule,
    QueueModule,
    CampaignsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
