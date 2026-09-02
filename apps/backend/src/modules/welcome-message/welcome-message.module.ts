import { Module } from "@nestjs/common";
import { WelcomeMessageService } from "./welcome-message.service";
import { WelcomeMessageController } from "./welcome-message.controller";
import { DatabaseModule } from "../../database/database.module";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";
import { AutoReplyModule } from "../auto-reply/auto-reply.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [DatabaseModule, WhatsAppSessionModule, AutoReplyModule, AuthModule],
  controllers: [WelcomeMessageController],
  providers: [WelcomeMessageService],
  exports: [WelcomeMessageService],
})
export class WelcomeMessageModule {}