import { Controller, Get, Post, Query, Body, Res, Req, HttpStatus, Logger, HttpCode } from "@nestjs/common";
import { Request, Response } from "express";
import { WabaService } from "./waba.service";

@Controller(["waba", ""])
export class WabaWebhookController {
  private readonly logger = new Logger(WabaWebhookController.name);

  constructor(private readonly wabaService: WabaService) {}

  /**
   * Meta Webhook Verification Handshake
   * Meta sends GET request with hub.mode, hub.verify_token, and hub.challenge
   * Supports both /api/v1/waba/webhook and /api/v1/webhook
   * MUST return raw hub.challenge as plain text (Content-Type: text/plain) with HTTP 200
   */
  @Get(["webhook", "waba/webhook"])
  async verifyWebhook(
    @Req() req: Request,
    @Query("hub.mode") queryMode: string,
    @Query("hub.verify_token") queryVerifyToken: string,
    @Query("hub.challenge") queryChallenge: string,
    @Res() res: Response
  ) {
    const rawQuery = (req.query as any) || {};
    const mode = queryMode || rawQuery["hub.mode"] || rawQuery.hub?.mode || rawQuery.mode || "";
    const verifyToken = queryVerifyToken || rawQuery["hub.verify_token"] || rawQuery.hub?.verify_token || rawQuery.verify_token || "";
    const challenge = queryChallenge || rawQuery["hub.challenge"] || rawQuery.hub?.challenge || rawQuery.challenge || "";

    this.logger.log(
      `[WABA Webhook Verification] Received handshake: url=${req.originalUrl}, mode=${mode}, token=${verifyToken ? '***' : 'missing'}, challenge=${challenge}`
    );

    const isVerified = await this.wabaService.verifyWebhookToken(String(mode || ""), String(verifyToken || ""));

    if (isVerified && challenge !== undefined && challenge !== null && challenge !== "") {
      this.logger.log(`[WABA Webhook Verification] Handshake SUCCESS. Returning challenge to Meta.`);
      return res
        .status(HttpStatus.OK)
        .setHeader("Content-Type", "text/plain; charset=utf-8")
        .send(String(challenge));
    }

    this.logger.warn(
      `[WABA Webhook Verification] Handshake REJECTED. Mode='${mode}', VerifyToken='${verifyToken}'. Token did not match database or environment.`
    );
    return res
      .status(HttpStatus.FORBIDDEN)
      .setHeader("Content-Type", "text/plain; charset=utf-8")
      .send("Forbidden");
  }

  /**
   * Meta Inbound Webhook Event Receiver
   * Delivers live message delivery receipts (sent, delivered, read, failed) and customer replies
   * MUST return HTTP 200 OK immediately (<3s) to prevent Meta from retrying and disabling webhook
   */
  @Post(["webhook", "waba/webhook"])
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
