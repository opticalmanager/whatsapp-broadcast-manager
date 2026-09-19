import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  bodyText: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  buttonText?: string;

  @IsString()
  @IsOptional()
  buttonUrl?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsOptional()
  variables?: Array<{ key: string; description: string; fallback?: string }>;

  // WABA Meta Fields
  @IsString()
  @IsOptional()
  metaTemplateName?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  headerType?: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";

  @IsString()
  @IsOptional()
  headerContent?: string;

  @IsString()
  @IsOptional()
  footerText?: string;

  @IsOptional()
  buttons?: any[];

  @IsOptional()
  sampleValues?: Record<string, string>;
}

@UseGuards(TenantAuthGuard)
@Controller("templates")
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService
  ) {}

  @Get()
  async findAll(
    @CurrentOrg() orgId: string,
    @Query("category") category?: string,
    @Query("search") search?: string,
    @Query("metaStatus") metaStatus?: string
  ) {
    const data = await this.templatesService.findAll(orgId, category, search, metaStatus);
    return {
      success: true,
      data,
    };
  }

  @Post("sync-from-meta")
  async syncFromMeta(@CurrentOrg() orgId: string) {
    const res = await this.templatesService.syncFromMeta(orgId);
    return {
      success: true,
      message: res.message,
      count: res.count,
    };
  }

  @Get(":id")
  async findOne(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const data = await this.templatesService.findOne(orgId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateTemplateDto
  ) {
    const template = await this.templatesService.create(orgId, {
      title: dto.title,
      bodyText: dto.bodyText,
      category: dto.category || "MARKETING",
      mediaType: dto.mediaType || "NONE",
      mediaUrl: dto.mediaUrl,
      buttonText: dto.buttonText,
      buttonUrl: dto.buttonUrl,
      icon: dto.icon,
      variables: dto.variables,
      metaTemplateName: dto.metaTemplateName,
      language: dto.language,
      headerType: dto.headerType,
      headerContent: dto.headerContent,
      footerText: dto.footerText,
      buttons: dto.buttons,
      sampleValues: dto.sampleValues,
    });
    return {
      success: true,
      message: "Template created successfully.",
      data: template,
    };
  }

  @Put(":id")
  async update(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: Partial<CreateTemplateDto>
  ) {
    const template = await this.templatesService.update(orgId, id, dto);
    return {
      success: true,
      message: "Template updated successfully.",
      data: template,
    };
  }

  @Post(":id/submit-to-meta")
  async submitToMeta(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const template = await this.templatesService.submitToMeta(orgId, id);
    return {
      success: true,
      message: `Template submitted to Meta successfully! Current status: ${template.metaStatus}`,
      data: template,
    };
  }

  @Post(":id/duplicate")
  async duplicate(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    const template = await this.templatesService.duplicate(orgId, id);
    return {
      success: true,
      message: "Template duplicated successfully.",
      data: template,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    await this.templatesService.delete(orgId, id);
    return {
      success: true,
      message: `Template ${id} removed successfully.`,
    };
  }
}
