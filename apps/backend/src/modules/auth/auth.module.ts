import { Module, Global } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TenantAuthGuard } from "./guards/tenant-auth.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, TenantAuthGuard],
  exports: [AuthService, TenantAuthGuard],
})
export class AuthModule {}
