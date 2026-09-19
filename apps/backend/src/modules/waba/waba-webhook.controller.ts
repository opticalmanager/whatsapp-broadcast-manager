import { Controller, Get, Post, Query, Body, Res, HttpStatus, Logger, HttpCode } from "@nestjs/common";
import { Response } from "express";
import { WabaService } from "./waba.service";

@Controller("waba")
export class WabaWebhookController {
  private readonly logger = new Logger(WabaWebhookController.name);

  constructor(private readonly wabaService: WabaService) {}

  /**
   * Meta Webhook Verification Handshake
   * Meta sends GET request with hub.mode, hub.verify_token, and hub.challenge
   * MUST return raw hub.challenge as plain text (Content-Type: text/plain) with HTTP 200
   */
  @Get("webhook")
  async verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") verifyToken: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response
  ) {
    this.logger.log(`[WABA Webhook Verification] Received handshake: mode=${mode}, token=${verifyToken ? '***' : 'missing'}`);

    const isVerified = await this.wabaService.verifyWebhookToken(mode, verifyToken);

    if (isVerified && challenge) {
      this.logger.log("[WABA Webhook Verification] Handshake SUCCESS. Returning challenge to Meta.");
      return res.status(HttpStatus.OK).type("text/plain").send(challenge);
    }

    this.logger.warn(`[WABA Webhook Verification] Handshake REJECTED. Mode or verify token invalid.`);
    return res.status(HttpStatus.FORBIDDEN).type("text/plain").send("Forbidden");
  }

  /**
   * Meta Inbound Webhook Event Receiver
   * Delivers live message delivery receipts (sent, delivered, read, failed) and customer replies
   * MUST return HTTP 200 OK immediately (<3s) to prevent Meta from retrying and disabling webhook
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  handleWebhookEvent(@Body() body: any, @Res() res: Response) {
    // 1. Immediately acknowledge event to Meta
    res.status(HttpStatus.OK).send("EVENT_RECEIVED");

    // 2. Asynchronously process payload in background
    if (body?.object === "whatsapp_business_account") {
      this.wabaService.processWebhookPayload(body).catch((err: any) => {
        this.logger.error(`Error processing WABA webhook payload: ${err.message}`, err.stack);
      });
    }
  }
}
