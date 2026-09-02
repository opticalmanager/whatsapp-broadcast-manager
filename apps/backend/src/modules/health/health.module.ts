import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { WhatsAppSessionModule } from "../whatsapp-session/whatsapp-session.module";

@Module({
  imports: [WhatsAppSessionModule],
  controllers: [HealthController],
})
export class HealthModule {}
