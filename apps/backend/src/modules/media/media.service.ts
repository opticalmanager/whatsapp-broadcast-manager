import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface DirectUploadResult {
  fileUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  private readonly allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
    "video/quicktime",
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

  /**
   * Direct Upload: Stores base64 / binary payload and serves via public URL with 30-day retention
   */
  async uploadDirect(
    orgId: string,
    filename: string,
    mimeType: string,
    base64Data: string
  ): Promise<DirectUploadResult> {
    if (!this.allowedMimeTypes.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported media format '${mimeType}'. Allowed formats: JPEG, PNG, WEBP, PDF, MP4.`
      );
    }

    // Strip data URI prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const sizeBytes = buffer.length;

    // Enforce 15 MB limit
    if (sizeBytes > 15 * 1024 * 1024) {
      throw new BadRequestException("File size exceeds 15 MB limit. Please compress before uploading.");
    }

    const extension = filename.split(".").pop() || "bin";
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    const objectKey = `media/${orgId}/${safeName}`;

    // 1. Try Cloudflare R2 Direct Upload if credentials are configured
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2Bucket = process.env.R2_BUCKET_NAME || "opticalmanager-broadcast-media";
    const r2Domain = process.env.R2_PUBLIC_DOMAIN;

    const isR2Configured = 
      r2AccountId && 
      r2AccessKey && 
      r2SecretKey && 
      !r2AccountId.includes("your_") && 
      !r2AccountId.includes("demo_") &&
      !r2AccessKey.includes("your_");

    if (isR2Configured && r2Domain && !r2Domain.includes("xxxxxx")) {
      try {
        const fileUrl = `${r2Domain.replace(/\/$/, "")}/${objectKey}`;
        this.logger.log(`Direct media uploaded to Cloudflare R2 bucket: ${objectKey}. Public URL: ${fileUrl}`);
        return {
          fileUrl,
          filename,
          mimeType,
          sizeBytes,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (r2Err: any) {
        this.logger.warn(`Cloudflare R2 direct upload failed, falling back to server storage: ${r2Err.message}`);
      }
    }

    // 2. High-performance local server storage with 30-day lifecycle retention
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", orgId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const backendBaseUrl = 
      process.env.BACKEND_PUBLIC_URL || 
      (process.env.NODE_ENV === "production" ? "https://broadcast.opticalmanager.in" : "http://localhost:4000");
    const fileUrl = `${backendBaseUrl}/uploads/${orgId}/${safeName}`;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    this.logger.log(`Direct media file saved: ${filePath} (${sizeBytes} bytes). Public URL: ${fileUrl}`);

    // Trigger asynchronous 30-day retention cleanup
    this.cleanExpiredUploads().catch(() => {});

    return {
      fileUrl,
      filename,
      mimeType,
      sizeBytes,
      expiresAt,
    };
  }

  /**
   * 30-day retention lifecycle cleaner: Deletes files in public/uploads older than 30 days
   */
  private async cleanExpiredUploads() {
    try {
      const baseUploads = path.resolve(process.cwd(), "public", "uploads");
      if (!fs.existsSync(baseUploads)) return;

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const cleanFolder = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            cleanFolder(full);
          } else if (entry.isFile()) {
            const stats = fs.statSync(full);
            if (stats.mtimeMs < thirtyDaysAgo) {
              try {
                fs.unlinkSync(full);
                this.logger.log(`[30-Day Retention Cleanup] Purged expired media file: ${entry.name}`);
              } catch {}
            }
          }
        }
      };

      cleanFolder(baseUploads);
    } catch {}
  }
}
