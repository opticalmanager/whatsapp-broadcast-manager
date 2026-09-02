import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import { ContactsService } from "./contacts.service";
import { AuthService } from "../auth/auth.service";
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

@Controller("contacts")
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly authService: AuthService
  ) {}

  private getOrgId(authHeader?: string): { orgId: string; shopId: string } {
    if (!authHeader) return { orgId: "org-demo", shopId: "main-outlet" };
    try {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = this.authService.validateSsoToken(token);
      return { orgId: session.organizationId, shopId: session.shopId || "main-outlet" };
    } catch {
      return { orgId: "org-demo", shopId: "main-outlet" };
    }
  }

  @Post("upload-csv")
  uploadCsv(@Body() dto: UploadCsvDto, @Headers("authorization") authHeader?: string) {
    const { orgId, shopId } = this.getOrgId(authHeader);
    return this.contactsService.uploadCsv(orgId, shopId, dto.csvData, dto.defaultTag);
  }

  @Get()
  findAll(
    @Query("search") search?: string,
    @Query("tag") tag?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Headers("authorization") authHeader?: string
  ) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.findAll(orgId, {
      search,
      tag,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get("tags")
  getTags(@Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.getTags(orgId);
  }

  @Post()
  create(@Body() dto: CreateContactDto, @Headers("authorization") authHeader?: string) {
    const { orgId, shopId } = this.getOrgId(authHeader);
    return this.contactsService.create(orgId, shopId, dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContactDto, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.update(orgId, id, dto);
  }

  @Patch(":id/tag")
  updateTag(@Param("id") id: string, @Body() dto: MoveTagDto, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.updateContactTag(orgId, id, dto.newTag, dto.oldTag);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.delete(orgId, id);
  }

  @Post("bulk-tag")
  bulkTag(@Body() dto: BulkTagDto, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.bulkTag(orgId, dto.contactIds, dto.tag);
  }

  @Post("bulk-remove-tag")
  bulkRemoveTag(@Body() dto: BulkTagDto, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.bulkRemoveTag(orgId, dto.contactIds, dto.tag);
  }

  @Post("bulk-delete")
  bulkDelete(@Body() dto: BulkDeleteDto, @Headers("authorization") authHeader?: string) {
    const { orgId } = this.getOrgId(authHeader);
    return this.contactsService.bulkDelete(orgId, dto.contactIds);
  }

  @Post("bulk-upsert")
  bulkUpsert(@Body() dto: BulkUpsertContactsDto, @Headers("authorization") authHeader?: string) {
    const { orgId, shopId } = this.getOrgId(authHeader);
    return this.contactsService.bulkUpsertContacts(orgId, shopId, dto.contacts, dto.createAudienceName);
  }
}
