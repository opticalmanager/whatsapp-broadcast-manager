import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"] || request.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header. Access denied.");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new UnauthorizedException("Empty authentication token.");
    }

    const session = this.authService.validateSsoToken(token);
    if (!session || !session.organizationId) {
      throw new UnauthorizedException("Invalid session payload: missing organization.");
    }

    // Attach verified session to request for controllers and decorators
    request.user = session;
    request.organizationId = session.organizationId;
    return true;
  }
}
