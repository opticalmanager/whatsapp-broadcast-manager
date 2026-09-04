import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from "@nestjs/common";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { WhatsAppSessionManagerService } from "./whatsapp-session.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

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

@UseGuards(TenantAuthGuard)
@Controller("whatsapp-numbers")
export class WhatsAppNumbersController {
  private readonly logger = new Logger(WhatsAppNumbersController.name);

  constructor(
    private readonly sessionManager: WhatsAppSessionManagerService
  ) {}

  @Get()
  async listNumbers(@CurrentOrg() orgId: string) {
    const liveStatus = this.sessionManager.getSessionStatus(orgId);

    return {
      success: true,
      data: {
        numberId: liveStatus.numberId,
        organizationId: orgId,
        shopId: "shop-main",
        phoneNumber: liveStatus.phoneNumber,
        displayName: liveStatus.displayName || "Optical Store WhatsApp Outlet",
        status: liveStatus.status,
        connectedAt: liveStatus.connectedAt,
      },
    };
  }

  @Get("instances")
  async listInstances(@CurrentOrg() orgId: string) {
    const instances = await this.sessionManager.getInstances(orgId);

    return {
      success: true,
      data: instances,
    };
  }

  @Post("instances")
  @HttpCode(HttpStatus.CREATED)
  async createInstance(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateInstanceDto
  ) {
    const instance = await this.sessionManager.createInstance(
      orgId,
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
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string,
    @Body() dto: UpdateInstanceDto
  ) {
    const updated = await this.sessionManager.updateInstance(instanceId, orgId, dto);

    return {
      success: updated,
      message: updated ? "Instance updated successfully" : "Instance not found",
    };
  }

  @Patch("instances/:id/delay-settings")
  @Put("instances/:id/delay-settings")
  async updateDelaySettings(
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string,
    @Body() body: { minDelaySeconds: number; maxDelaySeconds: number }
  ) {
    const result = await this.sessionManager.updateDelaySettings(
      instanceId,
      orgId,
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
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string
  ) {
    const deleted = await this.sessionManager.deleteInstance(instanceId, orgId);

    return {
      success: deleted,
      message: "Instance deleted and credentials purged.",
    };
  }

  @Post("instances/:id/logout")
  @HttpCode(HttpStatus.OK)
  async logoutInstance(
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string
  ) {
    await this.sessionManager.logoutSession(instanceId, orgId, "shop-main");

    return {
      success: true,
      message: `Instance ${instanceId} logged out successfully.`,
    };
  }

  @Get("instances/:id/qr")
  async getInstanceQr(
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string
  ) {
    const instances = await this.sessionManager.getInstances(orgId);
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
    @CurrentOrg() orgId: string,
    @Param("id") instanceId: string
  ) {
    const instances = await this.sessionManager.getInstances(orgId);
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) {
      throw new UnauthorizedException(`Instance ${instanceId} does not belong to your organization.`);
    }

    this.sessionManager.initSession(instanceId, orgId, "shop-main", true).catch(() => {});

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
    @CurrentOrg() orgId: string,
    @Body() dto: SendTestMessageDto
  ) {
    const result = await this.sessionManager.sendTextMessage(
      dto.instanceId,
      dto.recipientPhoneNumber,
      dto.messageText,
      undefined,
      orgId
    );

    return {
      success: true,
      message: "Live test WhatsApp message dispatched successfully!",
      data: result,
    };
  }
}
