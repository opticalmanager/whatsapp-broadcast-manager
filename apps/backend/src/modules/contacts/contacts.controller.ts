import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ContactsService } from "./contacts.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg, CurrentUser } from "../auth/decorators/tenant.decorator";
import { BroadcastSessionPayload } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsOptional, IsArray } from "class-validator";

export class BulkUpsertContactsDto {
  @IsArray()
  @IsNotEmpty()
  contacts: Array<{
    phone: string;
    name?: string;
    city?: string;
    dob?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }>;

  @IsString()
  @IsOptional()
  createAudienceName?: string;
}

export class UploadCsvDto {
  @IsString()
  @IsNotEmpty()
  csvData: string;

  @IsString()
  @IsOptional()
  defaultTag?: string;
}

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  dob?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  dob?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class BulkTagDto {
  @IsArray()
  @IsNotEmpty()
  contactIds: string[];

  @IsString()
  @IsNotEmpty()
  tag: string;
}

export class BulkDeleteDto {
  @IsArray()
  @IsNotEmpty()
  contactIds: string[];
}

export class MoveTagDto {
  @IsString()
  @IsOptional()
  newTag?: string;

  @IsString()
  @IsOptional()
  oldTag?: string;
}

@UseGuards(TenantAuthGuard)
@Controller("contacts")
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService
  ) {}

  @Post("upload-csv")
  uploadCsv(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: BroadcastSessionPayload,
    @Body() dto: UploadCsvDto
  ) {
    const shopId = user.shopId || "main-outlet";
    return this.contactsService.uploadCsv(orgId, shopId, dto.csvData, dto.defaultTag);
  }

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query("search") search?: string,
    @Query("tag") tag?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.contactsService.findAll(orgId, {
      search,
      tag,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get("tags")
  getTags(@CurrentOrg() orgId: string) {
    return this.contactsService.getTags(orgId);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: BroadcastSessionPayload,
    @Body() dto: CreateContactDto
  ) {
    const shopId = user.shopId || "main-outlet";
    return this.contactsService.create(orgId, shopId, dto);
  }

  @Put(":id")
  update(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateContactDto
  ) {
    return this.contactsService.update(orgId, id, dto);
  }

  @Patch(":id/tag")
  updateTag(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: MoveTagDto
  ) {
    return this.contactsService.updateContactTag(orgId, id, dto.newTag, dto.oldTag);
  }

  @Delete(":id")
  delete(
    @CurrentOrg() orgId: string,
    @Param("id") id: string
  ) {
    return this.contactsService.delete(orgId, id);
  }

  @Post("bulk-tag")
  bulkTag(
    @CurrentOrg() orgId: string,
    @Body() dto: BulkTagDto
  ) {
    return this.contactsService.bulkTag(orgId, dto.contactIds, dto.tag);
  }

  @Post("bulk-remove-tag")
  bulkRemoveTag(
    @CurrentOrg() orgId: string,
    @Body() dto: BulkTagDto
  ) {
    return this.contactsService.bulkRemoveTag(orgId, dto.contactIds, dto.tag);
  }

  @Post("bulk-delete")
  bulkDelete(
    @CurrentOrg() orgId: string,
    @Body() dto: BulkDeleteDto
  ) {
    return this.contactsService.bulkDelete(orgId, dto.contactIds);
  }

  @Post("bulk-upsert")
  bulkUpsert(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: BroadcastSessionPayload,
    @Body() dto: BulkUpsertContactsDto
  ) {
    const shopId = user.shopId || "main-outlet";
    return this.contactsService.bulkUpsertContacts(orgId, shopId, dto.contacts, dto.createAudienceName);
  }
}
