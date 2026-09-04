/**
 * Universal Public Media URL Normalization & Detection Utilities
 * Handles Google Drive, Dropbox, OneDrive, and direct media CDNs.
 */

/**
 * Extracts the file ID from a variety of Google Drive URL formats.
 * e.g., https://drive.google.com/file/d/1NMllbfvzJbrCYa9jRHLZBi1-7QzY0TP5/view?usp=sharing
 *       https://drive.google.com/open?id=1NMllbfvzJbrCYa9jRHLZBi1-7QzY0TP5
 *       https://drive.google.com/uc?id=1NMllbfvzJbrCYa9jRHLZBi1-7QzY0TP5
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
 * e.g., dl=0 -> raw=1
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
 * Converts any arbitrary public media URL (Google Drive, Dropbox, OneDrive, etc.)
 * into a direct streaming URL that browsers can preview and backend can download.
 *
 * For Google Drive:
 * - By default (or for images): Converts to `https://lh3.googleusercontent.com/d/${fileId}`
 *   which streams high-speed directly from Google's image CDN with CORS enabled.
 * - For documents/videos: Converts to `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
 */
export function normalizePublicMediaUrl(
  url?: string | null,
  preferredType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUTO" | string = "AUTO"
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Data URIs and Blob URLs are already direct client buffers
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // 1. Google Drive
  const gDriveId = extractGoogleDriveFileId(trimmed);
  if (gDriveId) {
    if (preferredType === "DOCUMENT" || preferredType === "VIDEO") {
      return `https://drive.google.com/uc?export=download&id=${gDriveId}&confirm=t`;
    }
    // High-speed Google Usercontent Image CDN (CORS open, renders in <img> tags cleanly)
    return `https://lh3.googleusercontent.com/d/${gDriveId}`;
  }

  // 2. Dropbox
  if (trimmed.includes("dropbox.com")) {
    return normalizeDropboxUrl(trimmed);
  }

  // 3. OneDrive
  if (trimmed.includes("1drv.ms") || trimmed.includes("onedrive.live.com")) {
    return normalizeOneDriveUrl(trimmed);
  }

  return trimmed;
}

/**
 * Determines whether a URL or data source represents an image flyer / picture.
 */
export function isLikelyImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith("data:image/") || clean.startsWith("blob:")) return true;
  if (/\.(jpe?g|png|webp|gif|svg|avif|bmp|ico)(\?.*)?$/i.test(clean)) return true;
  if (clean.includes("lh3.googleusercontent.com/d/")) return true;
  if (clean.includes("drive.google.com/file/d/")) return true;
  if (clean.includes("unsplash.com")) return true;
  if (clean.includes("r2.dev") && !clean.endsWith(".pdf") && !clean.endsWith(".mp4")) return true;
  if (clean.includes("/uploads/") && !clean.endsWith(".pdf") && !clean.endsWith(".mp4")) return true;
  if (clean.includes("images.pexels.com") || clean.includes("imgur.com") || clean.includes("cloudinary.com")) return true;
  return false;
}

/**
 * Determines whether a URL represents a video clip.
 */
export function isLikelyVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith("data:video/")) return true;
  if (/\.(mp4|mov|webm|mkv|3gp|avi)(\?.*)?$/i.test(clean)) return true;
  return false;
}

/**
 * Determines whether a URL represents a document (PDF, Excel, etc.).
 */
export function isLikelyDocumentUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith("data:application/pdf")) return true;
  if (/\.(pdf|docx?|xlsx?|csv|pptx?)(\?.*)?$/i.test(clean)) return true;
  return false;
}

/**
 * Automatically infers the media type enum for the app ('IMAGE' | 'DOCUMENT' | 'VIDEO' | 'NONE').
 */
export function detectMediaTypeFromUrl(url?: string | null): "IMAGE" | "DOCUMENT" | "VIDEO" | "NONE" {
  if (!url || typeof url !== "string" || !url.trim()) return "NONE";
  if (isLikelyVideoUrl(url)) return "VIDEO";
  if (isLikelyDocumentUrl(url)) return "DOCUMENT";
  if (isLikelyImageUrl(url)) return "IMAGE";
  return "IMAGE";
}
