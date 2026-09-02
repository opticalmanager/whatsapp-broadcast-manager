import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { WhatsAppSessionManagerService } from "./whatsapp-session.service";
import { AuthService } from "../auth/auth.service";

export class CreateInstanceDto {
  @IsString()
  @IsOptional()
  instanceName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  accountMaturityType?: "FRESH" | "MATURED";
}

export class UpdateInstanceDto {
  @IsString()
  @IsOptional()
  instanceName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  accountMaturityType?: "FRESH" | "MATURED";
}

export class SendTestMessageDto {
  @IsString()
  @IsNotEmpty()
  recipientPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  messageText: string;

  @IsString()
  @IsOptional()
  instanceId?: string;
}

@Controller("whatsapp-numbers")
export class WhatsAppNumbersController {
  private readonly logger = new Logger(WhatsAppNumbersController.name);

  constructor(
    private readonly sessionManager: WhatsAppSessionManagerService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing authentication token.");
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get()
  async listNumbers(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    const liveStatus = this.sessionManager.getSessionStatus();

    return {
      success: true,
      data: {
        numberId: liveStatus.numberId,
        organizationId: session.organizationId,
        shopId: "shop-main",
        phoneNumber: liveStatus.phoneNumber,
        displayName: liveStatus.displayName || "Optical Store WhatsApp Outlet",
        status: liveStatus.status,
        connectedAt: liveStatus.connectedAt,
      },
    };
  }

  @Get("instances")
  async listInstances(@Headers("authorization") authHeader?: string) {
    const session = this.extractSession(authHeader);
    const instances = await this.sessionManager.getInstances(session.organizationId);

    return {
      success: true,
      data: instances,
    };
  }

  @Post("instances")
  @HttpCode(HttpStatus.CREATED)
  async createInstance(
    @Headers("authorization") authHeader: string,
    @Body() dto: CreateInstanceDto
  ) {
    const session = this.extractSession(authHeader);
    const instance = await this.sessionManager.createInstance(
      session.organizationId,
      dto.instanceName,
      dto.notes,
      dto.accountMaturityType || "MATURED"
    );

    return {
      success: true,
      message: "New WhatsApp instance created! Pairing socket started.",
      data: instance,
    };
  }

  @Put("instances/:id")
  async updateInstance(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string,
    @Body() dto: UpdateInstanceDto
  ) {
    const session = this.extractSession(authHeader);
    const updated = await this.sessionManager.updateInstance(instanceId, session.organizationId, dto);

    return {
      success: updated,
      message: updated ? "Instance updated successfully" : "Instance not found",
    };
  }

  @Patch("instances/:id/delay-settings")
  @Put("instances/:id/delay-settings")
  async updateDelaySettings(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string,
    @Body() body: { minDelaySeconds: number; maxDelaySeconds: number }
  ) {
    const session = this.extractSession(authHeader);
    const result = await this.sessionManager.updateDelaySettings(
      instanceId,
      session.organizationId,
      body.minDelaySeconds,
      body.maxDelaySeconds
    );

    return {
      success: true,
      message: "Anti-ban delay settings updated successfully.",
      data: result,
    };
  }

  @Delete("instances/:id")
  async deleteInstance(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string
  ) {
    const session = this.extractSession(authHeader);
    const deleted = await this.sessionManager.deleteInstance(instanceId, session.organizationId);

    return {
      success: deleted,
      message: "Instance deleted and credentials purged.",
    };
  }

  @Post("instances/:id/logout")
  @HttpCode(HttpStatus.OK)
  async logoutInstance(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string
  ) {
    const session = this.extractSession(authHeader);
    await this.sessionManager.logoutSession(instanceId, session.organizationId, "shop-main");

    return {
      success: true,
      message: `Instance ${instanceId} logged out successfully.`,
    };
  }

  @Get("instances/:id/qr")
  async getInstanceQr(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string
  ) {
    const session = this.extractSession(authHeader);
    const instances = await this.sessionManager.getInstances(session.organizationId);
    const inst = instances.find((i) => i.id === instanceId);
    return {
      success: true,
      data: {
        instanceId,
        status: inst?.status || "DISCONNECTED",
        qrBase64: inst?.qrBase64 || null,
        phoneNumber: inst?.phoneNumber || null,
      },
    };
  }

  @Post("instances/:id/reconnect")
  @HttpCode(HttpStatus.OK)
  async reconnectInstance(
    @Headers("authorization") authHeader: string,
    @Param("id") instanceId: string
  ) {
    const session = this.extractSession(authHeader);
    this.sessionManager.initSession(instanceId, session.organizationId, "shop-main", true).catch(() => {});

    // Wait up to 6 seconds for QR code to be ready and return it directly
    const qrBase64 = await this.sessionManager.waitForQrCode(instanceId, 6000);

    return {
      success: true,
      message: `Instance ${instanceId} re-initialization active.`,
      data: {
        instanceId,
        status: qrBase64 ? "GENERATING_QR" : "INITIALIZING",
        qrBase64: qrBase64 || null,
      },
    };
  }

  @Post("send-test")
  @HttpCode(HttpStatus.OK)
  async sendTestMessage(
    @Headers("authorization") authHeader: string,
    @Body() dto: SendTestMessageDto
  ) {
    const session = this.extractSession(authHeader);
    const result = await this.sessionManager.sendTextMessage(
      dto.instanceId,
      dto.recipientPhoneNumber,
      dto.messageText,
      undefined,
      session.organizationId
    );

    return {
      success: true,
      message: "Live test WhatsApp message dispatched successfully!",
      data: result,
    };
  }
}
