import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from "@nestjs/common";
import { MediaService } from "./media.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

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

@Controller("media")
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { organizationId: "org-demo", role: "OWNER" };
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Post("upload-url")
  @HttpCode(HttpStatus.OK)
  getUploadUrl(
    @Headers("authorization") authHeader: string,
    @Body() dto: UploadUrlDto
  ) {
    const session = this.extractSession(authHeader);
    const result = this.mediaService.generatePresignedUploadUrl(
      session.organizationId,
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
    @Headers("authorization") authHeader: string,
    @Body() dto: DirectUploadDto
  ) {
    const session = this.extractSession(authHeader);
    const result = await this.mediaService.uploadDirect(
      session.organizationId,
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
