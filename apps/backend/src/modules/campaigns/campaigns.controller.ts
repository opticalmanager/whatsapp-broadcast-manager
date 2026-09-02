import { Controller, Get, Post, Delete, Body, Param, Headers, HttpCode, HttpStatus } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsArray, IsOptional, IsBoolean, IsNumber } from "class-validator";

export class CreateCampaignDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  whatsappNumberId?: string;

  @IsArray()
  @IsOptional()
  sendFromInstances?: string[];

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  targetAudienceType?: string;

  @IsArray()
  @IsOptional()
  audienceNames?: string[];

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsArray()
  @IsOptional()
  recipients?: Array<{ id: string; phone: string; name?: string; variables?: Record<string, string>; status?: string }>;

  @IsString()
  @IsNotEmpty()
  messageText: string;

  @IsString()
  @IsOptional()
  mediaType?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  textWithMediaMode?: "caption" | "separate";

  @IsBoolean()
  @IsOptional()
  warmupRamp?: boolean;

  @IsNumber()
  @IsOptional()
  batchSize?: number;

  @IsNumber()
  @IsOptional()
  batchPause?: number;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsString()
  @IsOptional()
  messageTypeOption?: string;

  @IsOptional()
  pollData?: {
    question?: string;
    options?: string[];
    multiple?: boolean;
  };

  @IsArray()
  @IsOptional()
  actionButtons?: Array<{
    id: string;
    type: "CALL" | "URL" | "QUICK_REPLY" | "COPY_CODE";
    displayText: string;
    value: string;
  }>;

  @IsArray()
  @IsOptional()
  buttons?: any[];

  @IsOptional()
  menuData?: {
    buttonText?: string;
    sectionTitle?: string;
    items?: Array<{ id: string; title: string; description?: string }>;
  };

  @IsString()
  @IsOptional()
  pollQuestion?: string;

  @IsArray()
  @IsOptional()
  pollOptions?: string[];

  @IsBoolean()
  @IsOptional()
  pollMultiple?: boolean;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsString()
  @IsOptional()
  locationAddress?: string;

  @IsNumber()
  @IsOptional()
  locationLat?: number;

  @IsNumber()
  @IsOptional()
  locationLng?: number;

  @IsString()
  @IsOptional()
  contactCardName?: string;

  @IsString()
  @IsOptional()
  contactCardPhone?: string;

  @IsString()
  @IsOptional()
  scheduledAt?: string;
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
    try {
      return this.authService.validateSsoToken(token);
    } catch {
      return { organizationId: "org-demo", role: "OWNER" };
    }
  }

  @Get()
  findAll(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    return {
      success: true,
      data: this.campaignsService.findAll(session.organizationId),
    };
  }

  @Get(":id/report")
  async getReport(@Param("id") id: string) {
    const report = await this.campaignsService.getCampaignReport(id);
    return {
      success: true,
      data: report,
    };
  }

  @Post(":id/add-to-sender-list")
  async addToSenderList(
    @Param("id") id: string,
    @Body() body: { filterType?: "ALL" | "FAILED" | "NON_WHATSAPP" | "DELIVERED"; audienceName?: string },
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const filter = body.filterType || "ALL";
    const result = await this.campaignsService.addRecipientsToSenderList(session.organizationId, id, filter, body.audienceName);
    return result;
  }

  @Post(":id/retry-recipient/:recipientId")
  @HttpCode(HttpStatus.OK)
  async retryRecipient(
    @Param("id") id: string,
    @Param("recipientId") recipientId: string
  ) {
    const result = await this.campaignsService.retryRecipient(id, recipientId);
    return result;
  }

  @Post(":id/retry-failed")
  @HttpCode(HttpStatus.OK)
  async retryFailed(@Param("id") id: string) {
    const result = await this.campaignsService.retryFailedRecipients(id);
    return result;
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    const campaign = this.campaignsService.findOne(id);
    return {
      success: true,
      data: campaign,
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
      message: "Campaign launched successfully.",
      data: campaign,
    };
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async syncCampaigns(
    @Headers("authorization") authHeader: string,
    @Body() body: { items: any[] }
  ) {
    const session = this.extractSession(authHeader);
    const updatedList = this.campaignsService.syncFromFrontend(session.organizationId, body.items || []);
    return {
      success: true,
      message: "Campaigns synced and pending broadcasts resumed.",
      data: updatedList,
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
  async resume(
    @Param("id") id: string,
    @Body() fallbackData?: any
  ) {
    const campaign = await this.campaignsService.resumeCampaign(id, fallbackData);
    return {
      success: true,
      message: `Campaign ${id} resumed.`,
      data: campaign,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(@Param("id") id: string) {
    const deleted = await this.campaignsService.deleteCampaign(id);
    return {
      success: true,
      deleted,
      message: `Campaign ${id} deleted.`,
    };
  }
}
