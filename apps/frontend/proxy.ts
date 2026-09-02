import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected app routes that strictly require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/app",
  "/devices",
  "/numbers",
  "/send-message",
  "/campaigns",
  "/welcome-message",
  "/auto-reply",
  "/auto-replies",
  "/templates",
  "/contacts",
  "/unsubscribers",
  "/number-filter",
  "/group-grabber",
  "/report",
  "/analytics",
  "/received-messages",
  "/settings",
  "/audiences",
  "/media",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Alias: /app -> /dashboard
  if (pathname === "/app") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. Check if route is protected
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtected) {
    const ssoCookie = request.cookies.get("broadcasting_session")?.value;
    const authCookie = request.cookies.get("broadcast_auth_token")?.value;

    let hasValidSso = false;
    if (ssoCookie && ssoCookie.trim().length > 2) {
      try {
        const parsed = JSON.parse(decodeURIComponent(ssoCookie));
        if (parsed && parsed.organizationId && (parsed.userId || parsed.sub || parsed.email)) {
          hasValidSso = true;
        }
      } catch {
        hasValidSso = false;
      }
    }

    const hasValidAuthToken = Boolean(authCookie && authCookie.trim().length > 10);

    // If neither valid SSO session nor valid standalone JWT token exists, redirect strictly to /login
    if (!hasValidSso && !hasValidAuthToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);

      if (ssoCookie && !hasValidSso) {
        response.cookies.delete("broadcasting_session");
      }
      if (authCookie && !hasValidAuthToken) {
        response.cookies.delete("broadcast_auth_token");
      }

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
