import { Controller, Get, Post, Body, Headers } from "@nestjs/common";
import { SettingsService, BroadcastSettingsDto } from "./settings.service";
import { AuthService } from "../auth/auth.service";

@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService
  ) {}

  private extractOrgId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return "org-demo";
    }
    try {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = this.authService.validateSsoToken(token);
      return session.organizationId;
    } catch {
      return "org-demo";
    }
  }

  @Get()
  async getSettings(@Headers("authorization") authHeader?: string) {
    const orgId = this.extractOrgId(authHeader);
    const data = await this.settingsService.getSettings(orgId);
    return {
      success: true,
      data,
    };
  }

  @Post()
  async saveSettings(@Headers("authorization") authHeader: string | undefined, @Body() body: Partial<BroadcastSettingsDto>) {
    const orgId = this.extractOrgId(authHeader);
    const data = await this.settingsService.saveSettings(orgId, body);
    return {
      success: true,
      message: "Broadcast settings saved successfully.",
      data,
    };
  }
}
