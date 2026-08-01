import { Controller, Get, Post, Delete, Body, Param, Headers, HttpCode, HttpStatus } from "@nestjs/common";
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

  @IsEnum(["NONE", "IMAGE", "DOCUMENT", "VIDEO"])
  @IsOptional()
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";

  @IsString()
  @IsOptional()
  mediaUrl?: string;
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
  findAll(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    return {
      success: true,
      data: this.templatesService.findAll(session.organizationId),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers("authorization") authHeader: string,
    @Body() dto: CreateTemplateDto
  ) {
    const session = this.extractSession(authHeader);
    const template = this.templatesService.create(session.organizationId, dto);
    return {
      success: true,
      message: "WhatsApp template created successfully.",
      data: template,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  remove(@Param("id") id: string) {
    this.templatesService.remove(id);
    return {
      success: true,
      message: `Template ${id} removed successfully.`,
    };
  }
}
