import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { MediaService } from "./media.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";
import { IsNotEmpty, IsString } from "class-validator";

export class UploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}

export class DirectUploadDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  base64Data: string;
}

@UseGuards(TenantAuthGuard)
@Controller("media")
export class MediaController {
  constructor(
    private readonly mediaService: MediaService
  ) {}

  @Post("upload-url")
  @HttpCode(HttpStatus.OK)
  getUploadUrl(
    @CurrentOrg() orgId: string,
    @Body() dto: UploadUrlDto
  ) {
    const result = this.mediaService.generatePresignedUploadUrl(
      orgId,
      dto.filename,
      dto.mimeType
    );
    return {
      success: true,
      message: "Presigned Cloudflare S3 upload URL generated.",
      data: result,
    };
  }

  @Post("upload-direct")
  @HttpCode(HttpStatus.OK)
  async uploadDirect(
    @CurrentOrg() orgId: string,
    @Body() dto: DirectUploadDto
  ) {
    const result = await this.mediaService.uploadDirect(
      orgId,
      dto.filename,
      dto.mimeType,
      dto.base64Data
    );
    return {
      success: true,
      message: "File uploaded successfully (30-day CDN retention).",
      data: result,
    };
  }
}

