import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, UnauthorizedException } from "@nestjs/common";
import { AudiencesService, AudienceFilterCriteria } from "./audiences.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsOptional, IsArray, IsObject } from "class-validator";

export class CreateAudienceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: "DYNAMIC_FILTER" | "MANUAL_SELECT" | "PASTED_NUMBERS" | "CUSTOM";

  @IsObject()
  @IsOptional()
  filterCriteria?: AudienceFilterCriteria;

  @IsArray()
  @IsOptional()
  contactIds?: string[];

  @IsArray()
  @IsOptional()
  pastedContacts?: Array<{ phone: string; name?: string; city?: string; dob?: string }>;

  @IsString()
  @IsOptional()
  tag?: string;
}

export class PreviewFilterDto {
  @IsObject()
  @IsOptional()
  filterCriteria?: AudienceFilterCriteria;
}

export class UpdateAudienceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  filterCriteria?: AudienceFilterCriteria;
}

@Controller("audiences")
export class AudiencesController {
  constructor(
    private readonly audiencesService: AudiencesService,
    private readonly authService: AuthService
  ) {}

  private getOrgId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing authentication token.");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    return this.authService.validateSsoToken(token).organizationId;
  }

  @Post("preview")
  previewFilter(@Body() dto: PreviewFilterDto, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return this.audiencesService.previewFilter(orgId, dto.filterCriteria || {});
  }

  @Post()
  create(@Body() dto: CreateAudienceDto, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return this.audiencesService.create(orgId, dto);
  }

  @Get()
  async findAll(@Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = await this.audiencesService.findAll(orgId);
    return {
      success: true,
      data,
    };
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    const data = await this.audiencesService.findOne(orgId, id);
    return {
      success: true,
      data,
    };
  }

  @Get(":id/contacts")
  getAudienceContacts(
    @Param("id") id: string,
    @Query("search") search?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
    @Headers("authorization") authHeader?: string
  ) {
    const orgId = this.getOrgId(authHeader);
    return this.audiencesService.getAudienceContacts(orgId, id, { search, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined });
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAudienceDto,
    @Headers("authorization") authHeader?: string
  ) {
    const orgId = this.getOrgId(authHeader);
    return this.audiencesService.update(orgId, id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @Headers("authorization") authHeader?: string) {
    const orgId = this.getOrgId(authHeader);
    return this.audiencesService.delete(orgId, id);
  }
}
