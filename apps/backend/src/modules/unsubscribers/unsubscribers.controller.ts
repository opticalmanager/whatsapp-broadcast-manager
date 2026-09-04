import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { UnsubscribersService, UnsubscriberSettingsDto } from "./unsubscribers.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("unsubscribers")
export class UnsubscribersController {
  constructor(
    private readonly service: UnsubscribersService
  ) {}

  @Get("settings")
  async getSettings(@CurrentOrg() orgId: string) {
    const data = await this.service.getSettings(orgId);
    return { success: true, data };
  }

  @Post("settings")
  async saveSettings(@CurrentOrg() orgId: string, @Body() body: Partial<UnsubscriberSettingsDto>) {
    const data = await this.service.saveSettings(orgId, body);
    return { success: true, data };
  }

  @Get()
  async getUnsubscribers(@CurrentOrg() orgId: string, @Query("search") search?: string) {
    const { data, total } = await this.service.getUnsubscribers(orgId, search);
    return { success: true, data, total };
  }

  @Post()
  async addUnsubscriber(@CurrentOrg() orgId: string, @Body() body: { phone: string; name?: string; triggerKeyword?: string }) {
    const record = await this.service.addUnsubscriber(orgId, body.phone, body.name, body.triggerKeyword || "MANUAL", undefined, "MANUAL_DASHBOARD");
    return { success: true, data: record };
  }

  @Delete(":id")
  async removeUnsubscriber(@CurrentOrg() orgId: string, @Param("id") id: string) {
    const ok = await this.service.removeUnsubscriber(orgId, id);
    return { success: ok };
  }
}

