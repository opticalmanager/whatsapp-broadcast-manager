import { Controller, Get, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from "@nestjs/common";
import { CrmIntegrationService } from "./crm-integration.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
import { IsOptional, IsString } from "class-validator";

export class FetchRecipientsFilterDto {
  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  shopId?: string;
}

@UseGuards(TenantAuthGuard)
@Controller("audience")
export class AudienceController {
  private readonly logger = new Logger(AudienceController.name);

  constructor(
    private readonly crmService: CrmIntegrationService
  ) {}

  @Get("shops")
  async getShops(@CurrentOrg() orgId: string) {
    this.logger.log(`GET /shops — orgId="${orgId}"`);
    const shops = await this.crmService.getShops(orgId);
    this.logger.log(`GET /shops — returned ${shops.length} shops`);
    return {
      success: true,
      data: shops,
    };
  }

  @Get("crm-tags")
  async getCrmTags(@CurrentOrg() orgId: string) {
    const tags = await this.crmService.getCrmTags(orgId);
    return {
      success: true,
      data: tags,
    };
  }

  @Post("fetch-crm-recipients")
  @HttpCode(HttpStatus.OK)
  async fetchRecipients(
    @CurrentOrg() orgId: string,
    @Body() dto: FetchRecipientsFilterDto
  ) {
    this.logger.log(`POST /fetch-crm-recipients — orgId="${orgId}", filter=${JSON.stringify(dto)}`);
    const recipients = await this.crmService.fetchCrmRecipients(orgId, dto);
    this.logger.log(`POST /fetch-crm-recipients — returned ${recipients.length} recipients`);
    return {
      success: true,
      totalCount: recipients.length,
      data: recipients,
    };
  }
}

