import { Module, Global } from "@nestjs/common";
import { UnsubscribersService } from "./unsubscribers.service";
import { UnsubscribersController } from "./unsubscribers.controller";
import { DatabaseModule } from "../../database/database.module";

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [UnsubscribersController],
  providers: [UnsubscribersService],
  exports: [UnsubscribersService],
})
export class UnsubscribersModule {}
