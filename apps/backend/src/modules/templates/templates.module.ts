import { Module } from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { TemplatesController } from "./templates.controller";
import { AuthModule } from "../auth/auth.module";
import { WabaModule } from "../waba/waba.module";

@Module({
  imports: [AuthModule, WabaModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
