import { Controller, Get, Post, Body, Param, Headers, HttpCode, HttpStatus } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsArray, IsOptional } from "class-validator";

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  shopId: string;

  @IsString()
  @IsNotEmpty()
  whatsappNumberId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  targetAudienceType: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsArray()
  recipients: Array<{ id: string; phone: string; name?: string; variables?: Record<string, string> }>;

  @IsString()
  @IsNotEmpty()
  messageText: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;
}

@Controller("campaigns")
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { organizationId: "org-demo", role: "OWNER" };
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get()
  findAll(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    return {
      success: true,
      data: this.campaignsService.findAll(session.organizationId),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers("authorization") authHeader: string,
    @Body() dto: CreateCampaignDto
  ) {
    const session = this.extractSession(authHeader);
    const campaign = await this.campaignsService.createAndLaunch(session.organizationId, dto);
    return {
      success: true,
      message: "Campaign launched successfully and enqueued to BullMQ.",
      data: campaign,
    };
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  async pause(@Param("id") id: string) {
    const campaign = await this.campaignsService.pauseCampaign(id);
    return {
      success: true,
      message: `Campaign ${id} paused.`,
      data: campaign,
    };
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  async resume(@Param("id") id: string) {
    const campaign = await this.campaignsService.resumeCampaign(id);
    return {
      success: true,
      message: `Campaign ${id} resumed.`,
      data: campaign,
    };
  }
}
