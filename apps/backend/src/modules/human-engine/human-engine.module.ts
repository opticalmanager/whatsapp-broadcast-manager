import { Module } from "@nestjs/common";
import { HumanEngineService } from "./human-engine.service";

@Module({
  providers: [HumanEngineService],
  exports: [HumanEngineService],
})
export class HumanEngineModule {}
