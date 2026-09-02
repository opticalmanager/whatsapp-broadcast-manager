import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { SettingsService, BroadcastSettingsDto } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@Req() req: any) {
    const orgId = req.user?.organizationId || "org-demo";
    const data = await this.settingsService.getSettings(orgId);
    return {
      success: true,
      data,
    };
  }

  @Post()
  async saveSettings(@Req() req: any, @Body() body: Partial<BroadcastSettingsDto>) {
    const orgId = req.user?.organizationId || "org-demo";
    const data = await this.settingsService.saveSettings(orgId, body);
    return {
      success: true,
      message: "Broadcast settings saved successfully.",
      data,
    };
  }
}
