import { Injectable, Logger, BadRequestException } from "@nestjs/common";

export interface SendingRuleConfig {
  minDelaySeconds: number;
  maxDelaySeconds: number;
  simulateTyping: boolean;
  typingDurationSeconds: number;
  batchPauseAfterMessages: number;
  batchPauseDurationMinutes: number;
  dailyMaxMessages: number;
  businessHoursStart: string; // "09:00:00"
  businessHoursEnd: string;   // "20:00:00"
}

@Injectable()
export class HumanEngineService {
  private readonly logger = new Logger(HumanEngineService.name);

  private readonly defaultConfig: SendingRuleConfig = {
    minDelaySeconds: 8,
    maxDelaySeconds: 20,
    simulateTyping: true,
    typingDurationSeconds: 3,
    batchPauseAfterMessages: 40,
    batchPauseDurationMinutes: 15,
    dailyMaxMessages: 500,
    businessHoursStart: "09:00:00",
    businessHoursEnd: "20:00:00",
  };

  /**
   * Returns randomized inter-message delay in milliseconds.
   */
  getRandomDelayMs(minSec = 8, maxSec = 20): number {
    const min = Math.min(minSec, maxSec);
    const max = Math.max(minSec, maxSec);
    const delaySec = min + Math.random() * (max - min);
    return Math.floor(delaySec * 1000);
  }

  /**
   * Verifies if sending is permitted based on Business Hours.
   */
  isWithinBusinessHours(startStr = "09:00:00", endStr = "20:00:00"): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentVal = currentHour * 60 + currentMin;

    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);

    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;

    return currentVal >= startVal && currentVal <= endVal;
  }

  /**
   * Validates if a dispatch is allowed right now.
   */
  async verifySendingAllowed(numberId: string): Promise<void> {
    if (!this.isWithinBusinessHours()) {
      this.logger.warn(`Dispatch deferred for ${numberId}: Outside store business hours (09:00 AM - 08:00 PM).`);
      throw new BadRequestException("Sending deferred: Outside configured store business hours.");
    }
  }

  getDefaultConfig(): SendingRuleConfig {
    return this.defaultConfig;
  }
}
