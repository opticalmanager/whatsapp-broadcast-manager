import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, HttpCode, HttpStatus } from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsEnum, IsOptional } from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  bodyText: string;

  @IsString()
  @IsOptional()
  category?: "RECALL" | "PRODUCT" | "VIP" | "PROMO" | "FESTIVAL" | "TRANSACTIONAL" | "GENERAL";

  @IsEnum(["NONE", "IMAGE", "DOCUMENT", "VIDEO"])
  @IsOptional()
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";

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
}

@Controller("templates")
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
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
  async findAll(
    @Headers("authorization") authHeader?: string,
    @Query("category") category?: string,
    @Query("search") search?: string
  ) {
    const session = this.extractSession(authHeader);
    const data = await this.templatesService.findAll(session.organizationId, category, search);
    return {
      success: true,
      data,
    };
  }

  @Get(":id")
  async findOne(
    @Headers("authorization") authHeader: string,
    @Param("id") id: string
  ) {
    const session = this.extractSession(authHeader);
    const data = await this.templatesService.findOne(session.organizationId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers("authorization") authHeader: string,
    @Body() dto: CreateTemplateDto
  ) {
    const session = this.extractSession(authHeader);
    const template = await this.templatesService.create(session.organizationId, {
      title: dto.title,
      bodyText: dto.bodyText,
      category: dto.category || "GENERAL",
      mediaType: dto.mediaType || "NONE",
      mediaUrl: dto.mediaUrl,
      buttonText: dto.buttonText,
      buttonUrl: dto.buttonUrl,
      icon: dto.icon,
      variables: dto.variables,
    });
    return {
      success: true,
      message: "Template created successfully.",
      data: template,
    };
  }

  @Put(":id")
  async update(
    @Headers("authorization") authHeader: string,
    @Param("id") id: string,
    @Body() dto: Partial<CreateTemplateDto>
  ) {
    const session = this.extractSession(authHeader);
    const template = await this.templatesService.update(session.organizationId, id, dto);
    return {
      success: true,
      message: "Template updated successfully.",
      data: template,
    };
  }

  @Post(":id/duplicate")
  async duplicate(
    @Headers("authorization") authHeader: string,
    @Param("id") id: string
  ) {
    const session = this.extractSession(authHeader);
    const template = await this.templatesService.duplicate(session.organizationId, id);
    return {
      success: true,
      message: "Template duplicated successfully.",
      data: template,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @Headers("authorization") authHeader: string,
    @Param("id") id: string
  ) {
    const session = this.extractSession(authHeader);
    await this.templatesService.delete(session.organizationId, id);
    return {
      success: true,
      message: `Template ${id} removed successfully.`,
    };
  }
}
