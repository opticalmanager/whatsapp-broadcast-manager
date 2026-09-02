import { Controller, Get, Post, Body, Headers, HttpCode, HttpStatus, Logger } from "@nestjs/common";
import { CrmIntegrationService } from "./crm-integration.service";
import { AuthService } from "../auth/auth.service";
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

@Controller("audience")
export class AudienceController {
  private readonly logger = new Logger(AudienceController.name);

  constructor(
    private readonly crmService: CrmIntegrationService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string): { organizationId: string; role: string } {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      this.logger.warn("No Authorization header provided. Querying without org filter.");
      return { organizationId: "", role: "OWNER" };
    }
    const token = authHeader.replace("Bearer ", "");
    try {
      const session = this.authService.validateSsoToken(token);
      this.logger.log(`Session resolved: orgId=${session.organizationId}, email=${session.email}`);
      return session;
    } catch (err: any) {
      this.logger.warn(`Session validation failed: ${err.message}. Querying without org filter.`);
      return { organizationId: "", role: "OWNER" };
    }
  }

  @Get("shops")
  async getShops(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    this.logger.log(`GET /shops — orgId="${session.organizationId}"`);
    const shops = await this.crmService.getShops(session.organizationId);
    this.logger.log(`GET /shops — returned ${shops.length} shops`);
    return {
      success: true,
      data: shops,
    };
  }

  @Get("crm-tags")
  async getCrmTags(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    const tags = await this.crmService.getCrmTags(session.organizationId);
    return {
      success: true,
      data: tags,
    };
  }

  @Post("fetch-crm-recipients")
  @HttpCode(HttpStatus.OK)
  async fetchRecipients(
    @Headers("authorization") authHeader: string,
    @Body() dto: FetchRecipientsFilterDto
  ) {
    const session = this.extractSession(authHeader);
    this.logger.log(`POST /fetch-crm-recipients — orgId="${session.organizationId}", filter=${JSON.stringify(dto)}`);
    const recipients = await this.crmService.fetchCrmRecipients(session.organizationId, dto);
    this.logger.log(`POST /fetch-crm-recipients — returned ${recipients.length} recipients`);
    return {
      success: true,
      totalCount: recipients.length,
      data: recipients,
    };
  }
}
