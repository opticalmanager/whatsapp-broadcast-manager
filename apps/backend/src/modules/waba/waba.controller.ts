import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
import { WabaService } from "./waba.service";
import { SaveWabaConfigDto, TestWabaConnectionDto } from "./dto/waba-config.dto";

@Controller("waba")
@UseGuards(TenantAuthGuard)
export class WabaController {
  constructor(private readonly wabaService: WabaService) {}

  @Get("health")
  async getHealth(
    @CurrentOrg() orgId: string,
    @Query("sync") sync?: string
  ) {
    const forceSync = sync === "true" || sync === "1";
    const health = await this.wabaService.getAccountHealth(orgId, forceSync);
    return {
      success: true,
      data: health,
    };
  }

  @Get("config")
  async getConfig(@CurrentOrg() orgId: string) {
    const config = await this.wabaService.getConfig(orgId);
    return {
      success: true,
      data: config || {
        organizationId: orgId,
        status: "DISCONNECTED",
      },
    };
  }

  @Post("config")
  @HttpCode(HttpStatus.OK)
  async saveConfig(
    @CurrentOrg() orgId: string,
    @Body() dto: SaveWabaConfigDto
  ) {
    const result = await this.wabaService.saveConfig(orgId, dto);
    return result;
  }

  @Post("test-connection")
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @CurrentOrg() orgId: string,
    @Body() dto?: TestWabaConnectionDto
  ) {
    const result = await this.wabaService.testConnection(orgId, dto);
    return result;
  }

  @Post("webhook/register-token")
  @HttpCode(HttpStatus.OK)
  async registerWebhookToken(
    @CurrentOrg() orgId: string,
    @Body("token") token: string
  ) {
    return this.wabaService.registerWebhookToken(orgId, token);
  }
}
