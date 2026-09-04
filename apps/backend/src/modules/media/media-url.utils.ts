import { Logger } from "@nestjs/common";
import * as path from "path";

const logger = new Logger("MediaUrlUtils");

/**
 * Extracts Google Drive file ID from URL.
 */
export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]+&)*id=)|docs\.google\.com\/(?:file\/d\/))([a-zA-Z0-9_-]{20,})/i
  );
  return match ? match[1] : null;
}

/**
 * Normalizes Dropbox sharing links to direct raw streaming URLs.
 */
export function normalizeDropboxUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.includes("dropbox.com")) {
    let normalized = url.replace(/[?&]dl=0\b/i, "");
    if (normalized.includes("?")) {
      if (!normalized.includes("raw=1")) normalized += "&raw=1";
    } else {
      normalized += "?raw=1";
    }
    return normalized;
  }
  return url;
}

/**
 * Normalizes OneDrive / SharePoint sharing links to direct download URLs.
 */
export function normalizeOneDriveUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.includes("1drv.ms") || url.includes("onedrive.live.com")) {
    return url
      .replace(/\/view\.aspx\?/i, "/download.aspx?")
      .replace(/([?&])download=0\b/i, "$1download=1");
  }
  return url;
}

/**
 * Converts public media URLs into direct streaming URLs.
 */
export function normalizePublicMediaUrl(
  url?: string | null,
  preferredType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUTO" | string = "AUTO"
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // Google Drive
  const gDriveId = extractGoogleDriveFileId(trimmed);
  if (gDriveId) {
    if (preferredType === "DOCUMENT" || preferredType === "VIDEO") {
      return `https://drive.google.com/uc?export=download&id=${gDriveId}&confirm=t`;
    }
    return `https://lh3.googleusercontent.com/d/${gDriveId}`;
  }

  // Dropbox
  if (trimmed.includes("dropbox.com")) {
    return normalizeDropboxUrl(trimmed);
  }

  // OneDrive
  if (trimmed.includes("1drv.ms") || trimmed.includes("onedrive.live.com")) {
    return normalizeOneDriveUrl(trimmed);
  }

  return trimmed;
}

export interface SniffedMime {
  mimeType: string;
  extension: string;
  category: "image" | "video" | "audio" | "document";
}

/**
 * Sniffs binary magic bytes of a buffer to accurately identify real media MIME type
 * and protect against HTML error pages, masqueraded formats, or missing CDN headers.
 */
export function detectBufferMimeType(buf: Buffer): SniffedMime | null {
  if (!buf || buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg", category: "image" };
  }

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mimeType: "image/png", extension: "png", category: "image" };
  }

  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mimeType: "image/gif", extension: "gif", category: "image" };
  }

  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp", category: "image" };
  }

  // PDF: %PDF
  if (buf.toString("ascii", 0, 4) === "%PDF") {
    return { mimeType: "application/pdf", extension: "pdf", category: "document" };
  }

  // MP4: ....ftyp (at offset 4)
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") {
    return { mimeType: "video/mp4", extension: "mp4", category: "video" };
  }

  // Ogg Audio: OggS
  if (buf.toString("ascii", 0, 4) === "OggS") {
    return { mimeType: "audio/ogg", extension: "ogg", category: "audio" };
  }

  // MP3 Audio: ID3
  if (buf.toString("ascii", 0, 3) === "ID3") {
    return { mimeType: "audio/mp3", extension: "mp3", category: "audio" };
  }

  return null;
}

export interface FetchedMediaResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isPdf: boolean;
}

/**
 * Downloads media from any public URL with intelligent Google Drive fallback,
 * browser User-Agent headers, redirects, magic-byte inspection, and HTML rejection.
 */
export async function fetchMediaWithFallback(
  rawUrl: string,
  preferredType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUTO" = "AUTO",
  timeoutMs: number = 25000
): Promise<FetchedMediaResult> {
  const gDriveId = extractGoogleDriveFileId(rawUrl);

  const candidateUrls: string[] = [];
  if (gDriveId) {
    if (preferredType === "DOCUMENT" || preferredType === "VIDEO") {
      candidateUrls.push(`https://drive.google.com/uc?export=download&id=${gDriveId}&confirm=t`);
      candidateUrls.push(`https://lh3.googleusercontent.com/d/${gDriveId}`);
    } else {
      candidateUrls.push(`https://lh3.googleusercontent.com/d/${gDriveId}`);
      candidateUrls.push(`https://drive.google.com/uc?export=download&id=${gDriveId}&confirm=t`);
    }
  } else {
    candidateUrls.push(normalizePublicMediaUrl(rawUrl, preferredType));
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "image/avif,image/webp,image/apng,image/svg+xml,image/*,application/pdf,video/*,*/*;q=0.8",
  };

  let lastError: any = null;

  for (const targetUrl of candidateUrls) {
    try {
      logger.log(`Fetching media buffer from: ${targetUrl}`);
      const res = await fetch(targetUrl, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const rawCt = (res.headers.get("content-type") || "").toLowerCase();
      const arrBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrBuf);

      if (!buffer || buffer.length === 0) {
        throw new Error("Empty media response buffer received");
      }

      // Check if response is an HTML webpage (e.g. Google Drive auth wall or preview page)
      const isHtml =
        rawCt.includes("text/html") ||
        buffer.toString("ascii", 0, 50).toLowerCase().includes("<!doctype html") ||
        buffer.toString("ascii", 0, 50).toLowerCase().includes("<html");

      if (isHtml) {
        logger.warn(`Response from ${targetUrl} was HTML, not raw binary media. Trying next candidate...`);
        continue;
      }

      // Sniff magic bytes
      const sniffed = detectBufferMimeType(buffer);
      let mimeType = sniffed?.mimeType || (rawCt.includes("/") ? rawCt.split(";")[0].trim() : "image/jpeg");

      let isImage = false;
      let isVideo = false;
      let isAudio = false;
      let isPdf = false;

      if (sniffed) {
        if (sniffed.category === "video") isVideo = true;
        else if (sniffed.category === "audio") isAudio = true;
        else if (sniffed.category === "document") isPdf = true;
        else isImage = true;
      } else {
        if (mimeType.startsWith("video/")) isVideo = true;
        else if (mimeType.startsWith("audio/")) isAudio = true;
        else if (mimeType.includes("pdf")) isPdf = true;
        else isImage = true;
      }

      // Extract filename
      let fileName = "attachment";
      try {
        const urlObj = new URL(targetUrl);
        const bName = path.basename(urlObj.pathname);
        if (bName && bName.includes(".")) {
          fileName = decodeURIComponent(bName);
        }
      } catch {}

      if (fileName === "attachment" && sniffed?.extension) {
        fileName = `attachment.${sniffed.extension}`;
      }

      logger.log(`Successfully loaded media buffer: ${buffer.length} bytes, MIME: ${mimeType}, Category: ${isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document"}`);

      return {
        buffer,
        mimeType,
        fileName,
        isImage,
        isVideo,
        isAudio,
        isPdf,
      };
    } catch (err: any) {
      lastError = err;
      logger.warn(`Attempt for ${targetUrl} failed: ${err.message}`);
    }
  }

  throw new Error(
    `Failed to download public media from URL: ${rawUrl}. ${lastError ? lastError.message : "Media not accessible"}`
  );
}
