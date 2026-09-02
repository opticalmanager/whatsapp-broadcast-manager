import { Module } from "@nestjs/common";
import { AudiencesController } from "./audiences.controller";
import { AudiencesService } from "./audiences.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AudiencesController],
  providers: [AudiencesService],
  exports: [AudiencesService],
})
export class AudiencesModule {}
