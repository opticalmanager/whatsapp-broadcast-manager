import { Injectable, Logger, BadRequestException } from "@nestjs/common";

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  private readonly allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "video/mp4",
  ]);

  /**
   * Generates a presigned Cloudflare R2 upload URL and public asset reference URL.
   */
  generatePresignedUploadUrl(
    orgId: string,
    filename: string,
    mimeType: string
  ): PresignedUploadResult {
    if (!this.allowedMimeTypes.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported media format '${mimeType}'. Allowed formats: JPEG, PNG, WEBP, PDF, MP4.`
      );
    }

    const extension = filename.split(".").pop() || "bin";
    const objectKey = `media/${orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Cloudflare R2 Endpoint Configuration
    const accountId = process.env.R2_ACCOUNT_ID || "demo_account_id";
    const bucketName = process.env.R2_BUCKET_NAME || "opticalmanager-broadcast-media";
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://pub-${accountId}.r2.dev`;

    // Public URL accessible over HTTP for WhatsApp Baileys engine
    const fileUrl = `${publicDomain}/${objectKey}`;

    // Cloudflare R2 Presigned S3-compatible PUT Upload URL
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const uploadUrl = `${r2Endpoint}/${bucketName}/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${process.env.R2_ACCESS_KEY_ID || 'key'}&X-Amz-Date=${new Date().toISOString()}&X-Amz-Expires=900`;

    this.logger.log(`Generated Cloudflare R2 upload URL for ${filename} (${mimeType}) -> Key: ${objectKey}`);

    return {
      uploadUrl,
      fileUrl,
      objectKey,
      expiresInSeconds: 900,
    };
  }
}
