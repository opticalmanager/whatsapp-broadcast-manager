/**
 * Automatically resolves the backend API URL dynamically based on environment:
 * 1. If NEXT_PUBLIC_BACKEND_URL is explicitly set (e.g. for decoupled Amplify/Vercel -> EC2), use it.
 * 2. If running on client browser on localhost / 127.0.0.1, use http://localhost:4000.
 * 3. If running on client browser in production (e.g. behind Nginx on EC2), use window.location.origin (e.g. https://broadcast.domain.com).
 * 4. In SSR / server-side Next.js route handlers, fallback to http://localhost:4000.
 */
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_BACKEND_URL) {
      return process.env.NEXT_PUBLIC_BACKEND_URL;
    }
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${window.location.protocol}//${hostname}:4000`;
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
}
