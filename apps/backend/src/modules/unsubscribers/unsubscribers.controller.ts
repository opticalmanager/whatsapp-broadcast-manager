import { Controller, Get, Post, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import { UnsubscribersService, UnsubscriberSettingsDto } from "./unsubscribers.service";
import { AuthService } from "../auth/auth.service";

@Controller("unsubscribers")
export class UnsubscribersController {
  constructor(
    private readonly service: UnsubscribersService,
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

  @Get("settings")
  async getSettings(@Headers("authorization") authHeader?: string) {
    const orgId = this.extractOrgId(authHeader);
    const data = await this.service.getSettings(orgId);
    return { success: true, data };
  }

  @Post("settings")
  async saveSettings(@Headers("authorization") authHeader: string | undefined, @Body() body: Partial<UnsubscriberSettingsDto>) {
    const orgId = this.extractOrgId(authHeader);
    const data = await this.service.saveSettings(orgId, body);
    return { success: true, data };
  }

  @Get()
  async getUnsubscribers(@Headers("authorization") authHeader: string | undefined, @Query("search") search?: string) {
    const orgId = this.extractOrgId(authHeader);
    const { data, total } = await this.service.getUnsubscribers(orgId, search);
    return { success: true, data, total };
  }

  @Post()
  async addUnsubscriber(@Headers("authorization") authHeader: string | undefined, @Body() body: { phone: string; name?: string; triggerKeyword?: string }) {
    const orgId = this.extractOrgId(authHeader);
    const record = await this.service.addUnsubscriber(orgId, body.phone, body.name, body.triggerKeyword || "MANUAL", undefined, "MANUAL_DASHBOARD");
    return { success: true, data: record };
  }

  @Delete(":id")
  async removeUnsubscriber(@Headers("authorization") authHeader: string | undefined, @Param("id") id: string) {
    const orgId = this.extractOrgId(authHeader);
    const ok = await this.service.removeUnsubscriber(orgId, id);
    return { success: ok };
  }
}
