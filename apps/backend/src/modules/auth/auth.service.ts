import { Injectable, UnauthorizedException, ForbiddenException, Logger } from "@nestjs/common";
import * as crypto from "crypto";

export interface BroadcastSessionPayload {
  sub: string;
  email: string;
  fullName: string;
  organizationId: string;
  shopId: string | null;
  role: "OWNER";
  iat: number;
  exp: number;
  nonce: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private getSsoSecret(): string {
    return (
      process.env.BROADCAST_SSO_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "optical-manager-broadcast-sso-secret-key-2026"
    );
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return Buffer.from(base64, "base64").toString("utf8");
  }

  validateSsoToken(token: string): BroadcastSessionPayload {
    if (!token) {
      throw new UnauthorizedException("Missing SSO token.");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid SSO token format.");
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const secret = this.getSsoSecret();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signatureInput)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) {
      this.logger.warn("Invalid SSO token signature detected.");
      throw new UnauthorizedException("SSO token signature verification failed.");
    }

    const payload: BroadcastSessionPayload = JSON.parse(this.base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      this.logger.warn(`Expired SSO token for user ${payload.email}`);
      throw new UnauthorizedException("SSO token expired. Please re-launch from OpticalManager CRM.");
    }

    if (payload.role !== "OWNER") {
      this.logger.warn(`Non-OWNER access attempt blocked for user ${payload.email} (Role: ${payload.role})`);
      throw new ForbiddenException("Access Denied: Broadcast features are exclusively available to Store Owners.");
    }

    this.logger.log(`SSO session verified for Store Owner ${payload.email} (Org: ${payload.organizationId})`);
    return payload;
  }
}
