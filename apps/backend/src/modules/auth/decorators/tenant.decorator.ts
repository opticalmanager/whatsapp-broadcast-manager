import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { BroadcastSessionPayload } from "../auth.service";

export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.organizationId || request.user?.organizationId;
    if (!orgId) {
      throw new UnauthorizedException("Tenant organization context missing.");
    }
    return orgId;
  }
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): BroadcastSessionPayload => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException("User context missing.");
    }
    return request.user;
  }
);
