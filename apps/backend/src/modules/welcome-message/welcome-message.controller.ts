import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException } from "@nestjs/common";
import { WelcomeMessageService, WelcomeMessageSettings } from "./welcome-message.service";
import { AuthService } from "../auth/auth.service";

@Controller("welcome-message")
export class WelcomeMessageController {
  constructor(
    private readonly welcomeService: WelcomeMessageService,
    private readonly authService: AuthService
  ) {}

  private getOrgId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing authentication token.");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    return this.authService.validateSsoToken(token).organizationId;
  }

  @Get("settings")
  getSettings(@Query("instanceId") instanceId?: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return { success: true, data: this.welcomeService.getSettings(orgId, instanceId) };
  }

  @Post("settings")
  updateSettings(@Body() body: Partial<WelcomeMessageSettings>, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const instanceId = body.instanceId || "ALL";
    const data = this.welcomeService.updateSettings(orgId, instanceId, body);
    return { success: true, data };
  }

  @Get("logs")
  async getLogs(@Query("instanceId") instanceId?: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = await this.welcomeService.getLogs(orgId, instanceId);
    return { success: true, data };
  }

  @Post("reset-history")
  resetHistory() {
    const success = this.welcomeService.resetHistory();
    return { success, message: "Welcome history reset." };
  }
}