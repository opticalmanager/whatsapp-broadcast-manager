import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { SettingsService, BroadcastSettingsDto } from "./settings.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService
  ) {}

  @Get()
  async getSettings(@CurrentOrg() orgId: string) {
    const data = await this.settingsService.getSettings(orgId);
    return {
      success: true,
      data,
    };
  }

  @Post()
  async saveSettings(@CurrentOrg() orgId: string, @Body() body: Partial<BroadcastSettingsDto>) {
    const data = await this.settingsService.saveSettings(orgId, body);
    return {
      success: true,
      message: "Broadcast settings saved successfully.",
      data,
    };
  }
}

