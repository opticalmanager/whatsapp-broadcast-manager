import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { AutoReplyService, AutoReplyRule, AutoReplySettings } from "./auto-reply.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("auto-reply")
export class AutoReplyController {
  constructor(
    private readonly autoReplyService: AutoReplyService
  ) {}

  @Get("settings")
  getSettings(@CurrentOrg() orgId: string, @Query("instanceId") instanceId?: string) {
    return {
      success: true,
      data: this.autoReplyService.getSettings(orgId, instanceId),
    };
  }

  @Post("settings")
  updateSettings(@CurrentOrg() orgId: string, @Body() body: Partial<AutoReplySettings>) {
    const instanceId = body.instanceId || "ALL";
    const data = this.autoReplyService.updateSettings(orgId, instanceId, body);
    return { success: true, data };
  }

  @Get("rules")
  getRules(@CurrentOrg() orgId: string, @Query("instanceId") instanceId?: string) {
    return { success: true, data: this.autoReplyService.getRules(orgId, instanceId) };
  }

  @Post("rules")
  createRule(@CurrentOrg() orgId: string, @Body() body: Partial<AutoReplyRule>) {
    const data = this.autoReplyService.createRule(orgId, body);
    return { success: true, data };
  }

  @Put("rules/:id")
  updateRule(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() body: Partial<AutoReplyRule>) {
    const data = this.autoReplyService.updateRule(id, orgId, body);
    return { success: true, data };
  }

  @Delete("rules/:id")
  deleteRule(@CurrentOrg() orgId: string, @Param("id") id: string) {
    const success = this.autoReplyService.deleteRule(id, orgId);
    return { success, message: success ? "Rule deleted." : "Rule not found." };
  }

  @Post("friendly-numbers")
  addFriendlyNumber(@CurrentOrg() orgId: string, @Body() body: { phone: string; instanceId?: string }) {
    const data = this.autoReplyService.addFriendlyNumber(orgId, body.instanceId || "ALL", body.phone);
    return { success: true, data };
  }

  @Delete("friendly-numbers")
  removeFriendlyNumber(@CurrentOrg() orgId: string, @Query("phone") phone: string, @Query("instanceId") instanceId?: string) {
    const data = this.autoReplyService.removeFriendlyNumber(orgId, instanceId || "ALL", phone);
    return { success: true, data };
  }
}