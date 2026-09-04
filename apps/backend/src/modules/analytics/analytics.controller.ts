import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService
  ) {}

  @Get("dashboard")
  async getDashboardMetrics(@CurrentOrg() orgId: string) {
    const metrics = await this.analyticsService.getDashboardMetrics(orgId);
    return {
      success: true,
      data: metrics,
    };
  }

  @Get("campaigns/:id/recipients")
  getCampaignRecipients(
    @CurrentOrg() orgId: string,
    @Param("id") campaignId: string
  ) {
    const recipients = this.analyticsService.getCampaignRecipients(orgId, campaignId);
    return {
      success: true,
      totalRecords: recipients.length,
      data: recipients,
    };
  }
}

