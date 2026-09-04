import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { AudiencesService, AudienceFilterCriteria } from "./audiences.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
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

@UseGuards(TenantAuthGuard)
@Controller("audiences")
export class AudiencesController {
  constructor(
    private readonly audiencesService: AudiencesService
  ) {}

  @Post("preview")
  previewFilter(@CurrentOrg() orgId: string, @Body() dto: PreviewFilterDto) {
    return this.audiencesService.previewFilter(orgId, dto.filterCriteria || {});
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreateAudienceDto) {
    return this.audiencesService.create(orgId, dto);
  }

  @Get()
  async findAll(@CurrentOrg() orgId: string) {
    const data = await this.audiencesService.findAll(orgId);
    return {
      success: true,
      data,
    };
  }

  @Get(":id")
  async findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    const data = await this.audiencesService.findOne(orgId, id);
    return {
      success: true,
      data,
    };
  }

  @Get(":id/contacts")
  getAudienceContacts(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Query("search") search?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number
  ) {
    return this.audiencesService.getAudienceContacts(orgId, id, { search, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined });
  }

  @Put(":id")
  update(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAudienceDto
  ) {
    return this.audiencesService.update(orgId, id, dto);
  }

  @Delete(":id")
  delete(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.audiencesService.delete(orgId, id);
  }
}
