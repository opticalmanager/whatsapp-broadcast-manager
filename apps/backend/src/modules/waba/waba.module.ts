import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AuthModule } from "../auth/auth.module";
import { WabaService } from "./waba.service";
import { WabaController } from "./waba.controller";
import { WabaWebhookController } from "./waba-webhook.controller";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WabaWebhookController, WabaController],
  providers: [WabaService],
  exports: [WabaService],
})
export class WabaModule {}
