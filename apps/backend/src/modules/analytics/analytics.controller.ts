import { Controller, Get, Param, Headers } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AuthService } from "../auth/auth.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { organizationId: "org-demo", role: "OWNER" };
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get("campaigns/:id/recipients")
  getCampaignRecipients(
    @Headers("authorization") authHeader: string,
    @Param("id") campaignId: string
  ) {
    this.extractSession(authHeader);
    const recipients = this.analyticsService.getCampaignRecipients(campaignId);
    return {
      success: true,
      totalRecords: recipients.length,
      data: recipients,
    };
  }
}
