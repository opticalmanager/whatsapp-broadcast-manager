import { Module } from "@nestjs/common";
import { WhatsAppSessionManagerService } from "./whatsapp-session.service";
import { BaileysAuthStoreService } from "./baileys-auth-store.service";
import { BroadcastGateway } from "./whatsapp.gateway";
import { WhatsAppNumbersController } from "./whatsapp-numbers.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppNumbersController],
  providers: [
    WhatsAppSessionManagerService,
    BaileysAuthStoreService,
    BroadcastGateway,
  ],
  exports: [WhatsAppSessionManagerService, BroadcastGateway],
})
export class WhatsAppSessionModule {}
