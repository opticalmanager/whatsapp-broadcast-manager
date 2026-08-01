import { Module } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { AuthModule } from "../auth/auth.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
