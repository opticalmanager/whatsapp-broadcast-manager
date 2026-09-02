import { Controller, Get, Post, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import { UnsubscribersService, UnsubscriberSettingsDto } from "./unsubscribers.service";

@Controller("unsubscribers")
export class UnsubscribersController {
  constructor(private readonly service: UnsubscribersService) {}

  private extractOrgId(headers: any): string {
    return headers["x-organization-id"] || "org-demo";
  }

  @Get("settings")
  async getSettings(@Headers() headers: any) {
    const orgId = this.extractOrgId(headers);
    const data = await this.service.getSettings(orgId);
    return { success: true, data };
  }

  @Post("settings")
  async saveSettings(@Headers() headers: any, @Body() body: Partial<UnsubscriberSettingsDto>) {
    const orgId = this.extractOrgId(headers);
    const data = await this.service.saveSettings(orgId, body);
    return { success: true, data };
  }

  @Get()
  async getUnsubscribers(@Headers() headers: any, @Query("search") search?: string) {
    const orgId = this.extractOrgId(headers);
    const { data, total } = await this.service.getUnsubscribers(orgId, search);
    return { success: true, data, total };
  }

  @Post()
  async addUnsubscriber(@Headers() headers: any, @Body() body: { phone: string; name?: string; triggerKeyword?: string }) {
    const orgId = this.extractOrgId(headers);
    const record = await this.service.addUnsubscriber(orgId, body.phone, body.name, body.triggerKeyword || "MANUAL", undefined, "MANUAL_DASHBOARD");
    return { success: true, data: record };
  }

  @Delete(":id")
  async removeUnsubscriber(@Headers() headers: any, @Param("id") id: string) {
    const orgId = this.extractOrgId(headers);
    const ok = await this.service.removeUnsubscriber(orgId, id);
    return { success: ok };
  }
}
