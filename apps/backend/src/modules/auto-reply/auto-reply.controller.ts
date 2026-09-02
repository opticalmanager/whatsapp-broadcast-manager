import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import { AutoReplyService, AutoReplyRule, AutoReplySettings } from "./auto-reply.service";
import { AuthService } from "../auth/auth.service";

@Controller("auto-reply")
export class AutoReplyController {
  constructor(
    private readonly autoReplyService: AutoReplyService,
    private readonly authService: AuthService
  ) {}

  private getOrgId(authHeader?: string): string {
    if (!authHeader) return "org-demo";
    try {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = this.authService.validateSsoToken(token);
      return session.organizationId;
    } catch {
      return "org-demo";
    }
  }

  @Get("settings")
  getSettings(@Query("instanceId") instanceId?: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return {
      success: true,
      data: this.autoReplyService.getSettings(orgId, instanceId),
    };
  }

  @Post("settings")
  updateSettings(@Body() body: Partial<AutoReplySettings>, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const instanceId = body.instanceId || "ALL";
    const data = this.autoReplyService.updateSettings(orgId, instanceId, body);
    return { success: true, data };
  }

  @Get("rules")
  getRules(@Query("instanceId") instanceId?: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return { success: true, data: this.autoReplyService.getRules(orgId, instanceId) };
  }

  @Post("rules")
  createRule(@Body() body: Partial<AutoReplyRule>, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = this.autoReplyService.createRule(orgId, body);
    return { success: true, data };
  }

  @Put("rules/:id")
  updateRule(@Param("id") id: string, @Body() body: Partial<AutoReplyRule>, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = this.autoReplyService.updateRule(id, orgId, body);
    return { success: true, data };
  }

  @Delete("rules/:id")
  deleteRule(@Param("id") id: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const success = this.autoReplyService.deleteRule(id, orgId);
    return { success, message: success ? "Rule deleted." : "Rule not found." };
  }

  @Post("friendly-numbers")
  addFriendlyNumber(@Body() body: { phone: string; instanceId?: string }, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = this.autoReplyService.addFriendlyNumber(orgId, body.instanceId || "ALL", body.phone);
    return { success: true, data };
  }

  @Delete("friendly-numbers")
  removeFriendlyNumber(@Query("phone") phone: string, @Query("instanceId") instanceId?: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = this.autoReplyService.removeFriendlyNumber(orgId, instanceId || "ALL", phone);
    return { success: true, data };
  }
}