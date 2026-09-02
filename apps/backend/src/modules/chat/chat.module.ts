import { Module, forwardRef } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { DatabaseModule } from "../../database/database.module";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => WhatsAppSessionModule),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
