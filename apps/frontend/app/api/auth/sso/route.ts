import { NextRequest, NextResponse } from "next/server";
import { verifySsoToken } from "@/lib/sso-verification";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/sso?error=Missing+SSO+token", request.url));
  }

  const result = verifySsoToken(token);

  if (!result.success) {
    return NextResponse.redirect(new URL(`/sso?error=${encodeURIComponent(result.error)}`, request.url));
  }

  // Create redirect response to Broadcast Owner Dashboard
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  // Set httpOnly session cookie on NextResponse (Allowed in Route Handlers)
  response.cookies.set("broadcasting_session", JSON.stringify(result.session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
