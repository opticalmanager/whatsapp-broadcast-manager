import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
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
@UseGuards(TenantAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@CurrentOrg() orgId: string) {
    return {
      success: true,
      data: this.campaignsService.findAll(orgId),
    };
  }

  @Get(":id/report")
  async getReport(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const report = await this.campaignsService.getCampaignReport(orgId, id);
    return {
      success: true,
      data: report,
    };
  }

  @Post(":id/add-to-sender-list")
  async addToSenderList(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: { filterType?: "ALL" | "FAILED" | "NON_WHATSAPP" | "DELIVERED"; audienceName?: string }
  ) {
    const filter = body.filterType || "ALL";
    const result = await this.campaignsService.addRecipientsToSenderList(orgId, id, filter, body.audienceName);
    return result;
  }

  @Post(":id/retry-recipient/:recipientId")
  @HttpCode(HttpStatus.OK)
  async retryRecipient(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Param("recipientId") recipientId: string
  ) {
    const result = await this.campaignsService.retryRecipient(orgId, id, recipientId);
    return result;
  }

  @Post(":id/retry-failed")
  @HttpCode(HttpStatus.OK)
  async retryFailed(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const result = await this.campaignsService.retryFailedRecipients(orgId, id);
    return result;
  }

  @Get(":id")
  findOne(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const campaign = this.campaignsService.findOne(orgId, id);
    return {
      success: true,
      data: campaign,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateCampaignDto
  ) {
    const campaign = await this.campaignsService.createAndLaunch(orgId, dto);
    return {
      success: true,
      message: "Campaign launched successfully.",
      data: campaign,
    };
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async syncCampaigns(
    @CurrentOrg() orgId: string,
    @Body() body: { items: any[] }
  ) {
    const updatedList = this.campaignsService.syncFromFrontend(orgId, body.items || []);
    return {
      success: true,
      message: "Campaigns synced and pending broadcasts resumed.",
      data: updatedList,
    };
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  async pause(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const campaign = await this.campaignsService.pauseCampaign(orgId, id);
    return {
      success: true,
      message: `Campaign ${id} paused.`,
      data: campaign,
    };
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  async resume(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() fallbackData?: any
  ) {
    const campaign = await this.campaignsService.resumeCampaign(orgId, id, fallbackData);
    return {
      success: true,
      message: `Campaign ${id} resumed.`,
      data: campaign,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const deleted = await this.campaignsService.deleteCampaign(orgId, id);
    return {
      success: true,
      deleted,
      message: `Campaign ${id} deleted.`,
    };
  }
}
