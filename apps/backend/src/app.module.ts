import { UnsubscribersModule } from "./modules/unsubscribers/unsubscribers.module";
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
import { DatabaseModule } from "./database/database.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { AudiencesModule } from "./modules/audiences/audiences.module";
import { AutoReplyModule } from "./modules/auto-reply/auto-reply.module";
import { WelcomeMessageModule } from "./modules/welcome-message/welcome-message.module";
import { ChatModule } from "./modules/chat/chat.module";
import { HealthModule } from "./modules/health/health.module";
import { SettingsModule } from "./modules/settings/settings.module";

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthModule,
    WhatsAppSessionModule,
    ChatModule,
    SettingsModule,
    UnsubscribersModule,
    TemplatesModule,
    MediaModule,
    CrmIntegrationModule,
    HumanEngineModule,
    QueueModule,
    CampaignsModule,
    AnalyticsModule,
    ContactsModule,
    AudiencesModule,
    AutoReplyModule,
    WelcomeMessageModule,
  ],
})
export class AppModule {}

