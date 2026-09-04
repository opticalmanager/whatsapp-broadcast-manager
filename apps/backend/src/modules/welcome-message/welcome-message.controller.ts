import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { WelcomeMessageService, WelcomeMessageSettings } from "./welcome-message.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("welcome-message")
export class WelcomeMessageController {
  constructor(
    private readonly welcomeService: WelcomeMessageService
  ) {}

  @Get("settings")
  getSettings(@CurrentOrg() orgId: string, @Query("instanceId") instanceId?: string) {
    return { success: true, data: this.welcomeService.getSettings(orgId, instanceId) };
  }

  @Post("settings")
  updateSettings(@CurrentOrg() orgId: string, @Body() body: Partial<WelcomeMessageSettings>) {
    const instanceId = body.instanceId || "ALL";
    const data = this.welcomeService.updateSettings(orgId, instanceId, body);
    return { success: true, data };
  }

  @Get("logs")
  async getLogs(@CurrentOrg() orgId: string, @Query("instanceId") instanceId?: string) {
    const data = await this.welcomeService.getLogs(orgId, instanceId);
    return { success: true, data };
  }

  @Post("reset-history")
  async resetHistory(@CurrentOrg() orgId: string) {
    const success = await this.welcomeService.resetHistory(orgId);
    return { success, message: "Welcome history reset for your organization." };
  }
}