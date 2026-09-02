import { Controller, Get, Param, Headers, UnauthorizedException } from "@nestjs/common";
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
      throw new UnauthorizedException("Missing authentication token.");
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get("dashboard")
  async getDashboardMetrics(@Headers("authorization") authHeader: string) {
    const session = this.extractSession(authHeader);
    const metrics = await this.analyticsService.getDashboardMetrics(session.organizationId);
    return {
      success: true,
      data: metrics,
    };
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
