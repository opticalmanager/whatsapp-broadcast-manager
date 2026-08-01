import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { WhatsAppSessionManagerService } from "./whatsapp-session.service";
import { AuthService } from "../auth/auth.service";
import { IsNotEmpty, IsString, IsOptional, IsUUID } from "class-validator";

export class InitNumberDto {
  @IsUUID()
  @IsNotEmpty()
  shopId: string;

  @IsString()
  @IsOptional()
  displayName?: string;
}

@Controller("whatsapp-numbers")
export class WhatsAppNumbersController {
  constructor(
    private readonly sessionManager: WhatsAppSessionManagerService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header.");
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get()
  async listNumbers(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);

    // Mock active store numbers list response
    return {
      success: true,
      data: [
        {
          id: "wa-num-001",
          organizationId: session.organizationId,
          shopId: session.shopId || "shop-main",
          phoneNumber: "+91 98765 43210",
          displayName: "Main Store Outlet",
          status: "CONNECTED",
          batteryLevel: 92,
          warmupTier: 2,
        },
      ],
    };
  }

  @Post("init")
  @HttpCode(HttpStatus.OK)
  async initSession(
    @Headers("authorization") authHeader: string,
    @Body() dto: InitNumberDto
  ) {
    const session = this.extractSession(authHeader);
    const numberId = `num-${dto.shopId.slice(0, 8)}`;

    // Trigger Baileys session launch and QR code generation
    await this.sessionManager.initSession(numberId, session.organizationId, dto.shopId);

    return {
      success: true,
      message: "WhatsApp multi-device session initialized. Streaming QR code over WebSockets...",
      numberId,
      status: "GENERATING_QR",
    };
  }

  @Post(":id/disconnect")
  @HttpCode(HttpStatus.OK)
  async disconnectSession(
    @Headers("authorization") authHeader: string,
    @Param("id") numberId: string
  ) {
    const session = this.extractSession(authHeader);
    await this.sessionManager.purgeSession(numberId);

    return {
      success: true,
      message: `Session ${numberId} disconnected and purged successfully.`,
    };
  }
}
