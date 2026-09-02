import { Module } from "@nestjs/common";
import { AutoReplyService } from "./auto-reply.service";
import { AutoReplyController } from "./auto-reply.controller";
import { DatabaseModule } from "../../database/database.module";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [DatabaseModule, WhatsAppSessionModule, AuthModule],
  controllers: [AutoReplyController],
  providers: [AutoReplyService],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}