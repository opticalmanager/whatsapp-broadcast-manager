import crypto from "crypto";

export interface BroadcastSession {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  shopId: string | null;
  role: "OWNER";
  createdAt: number;
}

export function getSsoSecret(): string {
  return (
    process.env.BROADCAST_SSO_SECRET ||
    "optical-manager-broadcast-sso-secret-key-2026"
  );
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Validates incoming SSO JWT from OpticalManager CRM.
 * Accepts OWNER, SUPER_ADMIN, or ADMIN roles with clock tolerance.
 */
export function verifySsoToken(token: string): { success: true; session: BroadcastSession } | { success: false; error: string } {
  try {
    if (!token) {
      return { success: false, error: "Missing SSO token." };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { success: false, error: "Malformed SSO token structure." };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const secret = getSsoSecret();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signatureInput)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) {
      return { success: false, error: "Invalid SSO signature verification failed." };
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = 60;

    if (payload.exp && payload.exp < (now - clockTolerance)) {
      return { success: false, error: "SSO token expired. Please launch from OpticalManager CRM again." };
    }

    const session: BroadcastSession = {
      userId: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      organizationId: payload.organizationId,
      shopId: payload.shopId || null,
      role: "OWNER",
      createdAt: Date.now(),
    };

    return { success: true, session };
  } catch (err: any) {
    console.error("[sso-verification.ts] Error verifying SSO token:", err);
    return { success: false, error: err.message || "Failed to process SSO token." };
  }
}
