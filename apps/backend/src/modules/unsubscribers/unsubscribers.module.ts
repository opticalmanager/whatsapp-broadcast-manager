import { Module, Global } from "@nestjs/common";
import { UnsubscribersService } from "./unsubscribers.service";
import { UnsubscribersController } from "./unsubscribers.controller";
import { DatabaseModule } from "../../database/database.module";
import { AuthModule } from "../auth/auth.module";

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UnsubscribersController],
  providers: [UnsubscribersService],
  exports: [UnsubscribersService],
})
export class UnsubscribersModule {}
