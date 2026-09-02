import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";
import { cookies } from "next/headers";

/**
 * Returns the current broadcasting session.
 * Supports two authentication methods:
 * 1. Standalone JWT cookie (broadcast_auth_token) — from direct login/signup
 * 2. SSO cookie (broadcasting_session) — from OpticalManager CRM
 */
export async function GET() {
  const cookieStore = await cookies();

  // Priority 1: Standalone auth token cookie (set by login/signup pages)
  const authTokenCookie = cookieStore.get("broadcast_auth_token")?.value;
  if (authTokenCookie) {
    try {
      const backendUrl = getBackendUrl();
      const decodedToken = decodeURIComponent(authTokenCookie);

      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${decodedToken}` },
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.session) {
          return NextResponse.json({
            authenticated: true,
            session: json.session,
            authMethod: "standalone",
            token: decodedToken,
          });
        }
      }
    } catch {
      // Token validation failed — fall through
    }
  }

  // Priority 2: CRM SSO session cookie
  const sessionCookie = cookieStore.get("broadcasting_session")?.value;
  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      if (session && session.organizationId) {
        return NextResponse.json({
          authenticated: true,
          session,
          authMethod: "sso",
        });
      }
    } catch {
      // Invalid JSON — fall through to 401
    }
  }

  return NextResponse.json(
    {
      authenticated: false,
      error: "No active session. Please log in or launch from OpticalManager CRM.",
    },
    { status: 401 }
  );
}
