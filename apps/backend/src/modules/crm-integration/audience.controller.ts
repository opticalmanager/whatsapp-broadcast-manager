import { Controller, Get, Post, Body, Headers, HttpCode, HttpStatus } from "@nestjs/common";
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
  constructor(
    private readonly crmService: CrmIntegrationService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { organizationId: "org-demo", role: "OWNER" };
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
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
    const recipients = await this.crmService.fetchCrmRecipients(session.organizationId, dto);
    return {
      success: true,
      totalCount: recipients.length,
      data: recipients,
    };
  }
}
