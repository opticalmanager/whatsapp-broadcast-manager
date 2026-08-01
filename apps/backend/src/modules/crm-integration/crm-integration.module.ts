import { Module } from "@nestjs/common";
import { CrmIntegrationService } from "./crm-integration.service";
import { AudienceController } from "./audience.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AudienceController],
  providers: [CrmIntegrationService],
  exports: [CrmIntegrationService],
})
export class CrmIntegrationModule {}
