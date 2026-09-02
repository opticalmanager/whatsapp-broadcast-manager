import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

export interface BroadcastSettingsDto {
  switchAccountAfter: number;
  sendParallelInstances: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  sleepEnabled: boolean;
  sleepAfterMessages: number;
  sleepForSeconds: number;
  defaultCountryCode: string;
  defaultCountryName: string;
  defaultLanguage: string;
  warmupWeek1Limit: number;
  warmupWeek2Limit: number;
  warmupWeek3Limit: number;
  warmupWeek4Limit: number;
  deliveryWindowEnabled: boolean;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  private readonly DEFAULT_SETTINGS: BroadcastSettingsDto = {
    switchAccountAfter: 1,
    sendParallelInstances: true,
    minDelaySec: 50,
    maxDelaySec: 60,
    sleepEnabled: true,
    sleepAfterMessages: 10,
    sleepForSeconds: 60,
    defaultCountryCode: "91",
    defaultCountryName: "India",
    defaultLanguage: "English",
    warmupWeek1Limit: 50,
    warmupWeek2Limit: 150,
    warmupWeek3Limit: 300,
    warmupWeek4Limit: 500,
    deliveryWindowEnabled: true,
    deliveryWindowStart: "10:00",
    deliveryWindowEnd: "19:00",
  };

  async getSettings(orgId?: string): Promise<BroadcastSettingsDto> {
    const effectiveOrg = orgId || "org-demo";
    try {
      const rows = await this.db.sql`
        SELECT 
          switch_account_after,
          send_parallel_instances,
          min_delay_sec,
          max_delay_sec,
          sleep_enabled,
          sleep_after_messages,
          sleep_for_seconds,
          default_country_code,
          default_country_name,
          default_language,
          warmup_week1_limit,
          warmup_week2_limit,
          warmup_week3_limit,
          warmup_week4_limit,
          delivery_window_enabled,
          delivery_window_start,
          delivery_window_end
        FROM public.broadcast_settings
        WHERE organization_id = ${effectiveOrg}
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          switchAccountAfter: Number(r.switch_account_after) || 1,
          sendParallelInstances: r.send_parallel_instances !== false,
          minDelaySec: r.min_delay_sec != null ? Number(r.min_delay_sec) : 50,
          maxDelaySec: r.max_delay_sec != null ? Number(r.max_delay_sec) : 60,
          sleepEnabled: r.sleep_enabled !== false,
          sleepAfterMessages: r.sleep_after_messages != null ? Number(r.sleep_after_messages) : 10,
          sleepForSeconds: r.sleep_for_seconds != null ? Number(r.sleep_for_seconds) : 60,
          defaultCountryCode: r.default_country_code || "91",
          defaultCountryName: r.default_country_name || "India",
          defaultLanguage: r.default_language || "English",
          warmupWeek1Limit: Number(r.warmup_week1_limit) || 50,
          warmupWeek2Limit: Number(r.warmup_week2_limit) || 150,
          warmupWeek3Limit: Number(r.warmup_week3_limit) || 300,
          warmupWeek4Limit: Number(r.warmup_week4_limit) || 500,
          deliveryWindowEnabled: r.delivery_window_enabled !== false,
          deliveryWindowStart: r.delivery_window_start || "10:00",
          deliveryWindowEnd: r.delivery_window_end || "19:00",
        };
      }
    } catch (err: any) {
      this.logger.warn(`Error reading broadcast settings: ${err.message}`);
    }

    return { ...this.DEFAULT_SETTINGS };
  }

  async saveSettings(orgId: string, data: Partial<BroadcastSettingsDto>): Promise<BroadcastSettingsDto> {
    const effectiveOrg = orgId || "org-demo";
    const current = await this.getSettings(effectiveOrg);

    const merged: BroadcastSettingsDto = {
      switchAccountAfter: data.switchAccountAfter !== undefined ? Number(data.switchAccountAfter) : current.switchAccountAfter,
      sendParallelInstances: data.sendParallelInstances !== undefined ? Boolean(data.sendParallelInstances) : current.sendParallelInstances,
      minDelaySec: data.minDelaySec !== undefined ? Number(data.minDelaySec) : current.minDelaySec,
      maxDelaySec: data.maxDelaySec !== undefined ? Number(data.maxDelaySec) : current.maxDelaySec,
      sleepEnabled: data.sleepEnabled !== undefined ? Boolean(data.sleepEnabled) : current.sleepEnabled,
      sleepAfterMessages: data.sleepAfterMessages !== undefined ? Number(data.sleepAfterMessages) : current.sleepAfterMessages,
      sleepForSeconds: data.sleepForSeconds !== undefined ? Number(data.sleepForSeconds) : current.sleepForSeconds,
      defaultCountryCode: (data.defaultCountryCode || current.defaultCountryCode).replace(/\D/g, "") || "91",
      defaultCountryName: data.defaultCountryName || current.defaultCountryName,
      defaultLanguage: data.defaultLanguage || current.defaultLanguage,
      warmupWeek1Limit: data.warmupWeek1Limit !== undefined ? Number(data.warmupWeek1Limit) : current.warmupWeek1Limit,
      warmupWeek2Limit: data.warmupWeek2Limit !== undefined ? Number(data.warmupWeek2Limit) : current.warmupWeek2Limit,
      warmupWeek3Limit: data.warmupWeek3Limit !== undefined ? Number(data.warmupWeek3Limit) : current.warmupWeek3Limit,
      warmupWeek4Limit: data.warmupWeek4Limit !== undefined ? Number(data.warmupWeek4Limit) : current.warmupWeek4Limit,
      deliveryWindowEnabled: data.deliveryWindowEnabled !== undefined ? Boolean(data.deliveryWindowEnabled) : current.deliveryWindowEnabled,
      deliveryWindowStart: data.deliveryWindowStart || current.deliveryWindowStart || "10:00",
      deliveryWindowEnd: data.deliveryWindowEnd || current.deliveryWindowEnd || "19:00",
    };

    const id = `set_${effectiveOrg}`;

    await this.db.sql`
      INSERT INTO public.broadcast_settings (
        id,
        organization_id,
        switch_account_after,
        send_parallel_instances,
        min_delay_sec,
        max_delay_sec,
        sleep_enabled,
        sleep_after_messages,
        sleep_for_seconds,
        default_country_code,
        default_country_name,
        default_language,
        warmup_week1_limit,
        warmup_week2_limit,
        warmup_week3_limit,
        warmup_week4_limit,
        delivery_window_enabled,
        delivery_window_start,
        delivery_window_end,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${effectiveOrg},
        ${merged.switchAccountAfter},
        ${merged.sendParallelInstances},
        ${merged.minDelaySec},
        ${merged.maxDelaySec},
        ${merged.sleepEnabled},
        ${merged.sleepAfterMessages},
        ${merged.sleepForSeconds},
        ${merged.defaultCountryCode},
        ${merged.defaultCountryName},
        ${merged.defaultLanguage},
        ${merged.warmupWeek1Limit},
        ${merged.warmupWeek2Limit},
        ${merged.warmupWeek3Limit},
        ${merged.warmupWeek4Limit},
        ${merged.deliveryWindowEnabled},
        ${merged.deliveryWindowStart},
        ${merged.deliveryWindowEnd},
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        switch_account_after = EXCLUDED.switch_account_after,
        send_parallel_instances = EXCLUDED.send_parallel_instances,
        min_delay_sec = EXCLUDED.min_delay_sec,
        max_delay_sec = EXCLUDED.max_delay_sec,
        sleep_enabled = EXCLUDED.sleep_enabled,
        sleep_after_messages = EXCLUDED.sleep_after_messages,
        sleep_for_seconds = EXCLUDED.sleep_for_seconds,
        default_country_code = EXCLUDED.default_country_code,
        default_country_name = EXCLUDED.default_country_name,
        default_language = EXCLUDED.default_language,
        warmup_week1_limit = EXCLUDED.warmup_week1_limit,
        warmup_week2_limit = EXCLUDED.warmup_week2_limit,
        warmup_week3_limit = EXCLUDED.warmup_week3_limit,
        warmup_week4_limit = EXCLUDED.warmup_week4_limit,
        delivery_window_enabled = EXCLUDED.delivery_window_enabled,
        delivery_window_start = EXCLUDED.delivery_window_start,
        delivery_window_end = EXCLUDED.delivery_window_end,
        updated_at = NOW()
    `;

    this.logger.log(`Updated broadcast settings for org ${effectiveOrg}`);
    return merged;
  }
}
