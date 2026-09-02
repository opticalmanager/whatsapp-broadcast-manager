import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

export interface UnsubscriberSettingsDto {
  enabled: boolean;
  optoutText: string;
  triggerKeywords: string;
  autoReplyConfirmation: boolean;
  confirmationMessage: string;
}

export interface UnsubscriberRecord {
  id: string;
  organizationId: string;
  phone: string;
  name: string | null;
  reason: string | null;
  triggerKeyword: string;
  instanceId: string | null;
  source: string;
  unsubscribedAt: Date;
  createdAt: Date;
}

@Injectable()
export class UnsubscribersService {
  private readonly logger = new Logger(UnsubscribersService.name);

  constructor(private readonly db: DatabaseService) {}

  private readonly DEFAULT_SETTINGS: UnsubscriberSettingsDto = {
    enabled: true,
    optoutText: "_Reply STOP to unsubscribe from promotional messages._",
    triggerKeywords: "STOP,UNSUBSCRIBE,OPTOUT",
    autoReplyConfirmation: true,
    confirmationMessage: "You have been successfully unsubscribed. You will no longer receive promotional broadcasts from us.",
  };

  async getSettings(orgId?: string): Promise<UnsubscriberSettingsDto> {
    const effectiveOrg = orgId || "org-demo";
    try {
      const rows = await this.db.sql`
        SELECT enabled, optout_text, trigger_keywords, auto_reply_confirmation, confirmation_message
        FROM public.unsubscriber_settings
        WHERE organization_id = ${effectiveOrg} OR organization_id = 'org-demo'
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          enabled: r.enabled !== false,
          optoutText: r.optout_text || this.DEFAULT_SETTINGS.optoutText,
          triggerKeywords: r.trigger_keywords || this.DEFAULT_SETTINGS.triggerKeywords,
          autoReplyConfirmation: r.auto_reply_confirmation !== false,
          confirmationMessage: r.confirmation_message || this.DEFAULT_SETTINGS.confirmationMessage,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Error loading unsubscriber settings: ${err.message}`);
    }

    return { ...this.DEFAULT_SETTINGS };
  }

  async saveSettings(orgId: string, dto: Partial<UnsubscriberSettingsDto>): Promise<UnsubscriberSettingsDto> {
    const effectiveOrg = orgId || "org-demo";
    const current = await this.getSettings(effectiveOrg);

    const merged: UnsubscriberSettingsDto = {
      enabled: dto.enabled !== undefined ? Boolean(dto.enabled) : current.enabled,
      optoutText: dto.optoutText !== undefined ? dto.optoutText.trim() : current.optoutText,
      triggerKeywords: dto.triggerKeywords !== undefined ? dto.triggerKeywords.trim() : current.triggerKeywords,
      autoReplyConfirmation: dto.autoReplyConfirmation !== undefined ? Boolean(dto.autoReplyConfirmation) : current.autoReplyConfirmation,
      confirmationMessage: dto.confirmationMessage !== undefined ? dto.confirmationMessage.trim() : current.confirmationMessage,
    };

    const id = `unsub_set_${effectiveOrg}`;

    await this.db.sql`
      INSERT INTO public.unsubscriber_settings (
        id, organization_id, enabled, optout_text, trigger_keywords, auto_reply_confirmation, confirmation_message, created_at, updated_at
      ) VALUES (
        ${id}, ${effectiveOrg}, ${merged.enabled}, ${merged.optoutText}, ${merged.triggerKeywords}, ${merged.autoReplyConfirmation}, ${merged.confirmationMessage}, NOW(), NOW()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        optout_text = EXCLUDED.optout_text,
        trigger_keywords = EXCLUDED.trigger_keywords,
        auto_reply_confirmation = EXCLUDED.auto_reply_confirmation,
        confirmation_message = EXCLUDED.confirmation_message,
        updated_at = NOW()
    `;

    this.logger.log(`Saved unsubscriber settings for org ${effectiveOrg} (Enabled: ${merged.enabled})`);
    return merged;
  }

  async getUnsubscribers(orgId?: string, search?: string): Promise<{ data: UnsubscriberRecord[]; total: number }> {
    const effectiveOrg = orgId || "org-demo";
    try {
      let rows;
      if (search && search.trim()) {
        const pattern = `%${search.trim()}%`;
        rows = await this.db.sql`
          SELECT * FROM public.unsubscribers
          WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id = 'org_default' OR organization_id IS NOT NULL)
            AND (phone ILIKE ${pattern} OR name ILIKE ${pattern} OR trigger_keyword ILIKE ${pattern})
          ORDER BY unsubscribed_at DESC
          LIMIT 300
        `;
      } else {
        rows = await this.db.sql`
          SELECT * FROM public.unsubscribers
          WHERE organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id = 'org_default' OR organization_id IS NOT NULL
          ORDER BY unsubscribed_at DESC
          LIMIT 300
        `;
      }

      const list: UnsubscriberRecord[] = (rows || []).map((r) => ({
        id: r.id,
        organizationId: r.organization_id,
        phone: r.phone,
        name: r.name,
        reason: r.reason,
        triggerKeyword: r.trigger_keyword || "STOP",
        instanceId: r.instance_id,
        source: r.source || "AUTO_KEYWORD",
        unsubscribedAt: new Date(r.unsubscribed_at || r.created_at || Date.now()),
        createdAt: new Date(r.created_at || Date.now()),
      }));

      return { data: list, total: list.length };
    } catch (err: any) {
      this.logger.error(`Failed to fetch unsubscribers: ${err.message}`);
      return { data: [], total: 0 };
    }
  }

  async addUnsubscriber(
    orgId: string,
    phone: string,
    name?: string,
    triggerKeyword: string = "STOP",
    instanceId?: string,
    source: string = "AUTO_KEYWORD"
  ): Promise<UnsubscriberRecord> {
    const effectiveOrg = orgId || "org-demo";
    const cleanPhone = phone.replace(/\D/g, "");
    const id = `unsub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      await this.db.sql`
        INSERT INTO public.unsubscribers (
          id, organization_id, phone, name, trigger_keyword, instance_id, source, unsubscribed_at, created_at, updated_at
        ) VALUES (
          ${id}, ${effectiveOrg}, ${cleanPhone}, ${name || null}, ${triggerKeyword}, ${instanceId || null}, ${source}, NOW(), NOW(), NOW()
        )
        ON CONFLICT (organization_id, phone) DO UPDATE SET
          trigger_keyword = EXCLUDED.trigger_keyword,
          instance_id = COALESCE(EXCLUDED.instance_id, unsubscribers.instance_id),
          unsubscribed_at = NOW(),
          updated_at = NOW()
      `;

      // Also tag in contacts table
      try {
        await this.db.sql`
          UPDATE public.contacts
          SET tags = CASE 
            WHEN tags IS NULL OR tags = '[]'::jsonb THEN '["UNSUBSCRIBED"]'::jsonb
            WHEN NOT tags ? 'UNSUBSCRIBED' THEN tags || '["UNSUBSCRIBED"]'::jsonb
            ELSE tags
          END
          WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo')
            AND (phone = ${cleanPhone} OR phone = ${cleanPhone.slice(-10)})
        `;
      } catch {}

      this.logger.log(`Successfully marked ${cleanPhone} as UNSUBSCRIBED in org ${effectiveOrg}`);
    } catch (err: any) {
      this.logger.warn(`Error adding unsubscriber ${cleanPhone}: ${err.message}`);
    }

    return {
      id,
      organizationId: effectiveOrg,
      phone: cleanPhone,
      name: name || null,
      reason: null,
      triggerKeyword,
      instanceId: instanceId || null,
      source,
      unsubscribedAt: new Date(),
      createdAt: new Date(),
    };
  }

  async removeUnsubscriber(orgId: string, id: string): Promise<boolean> {
    const effectiveOrg = orgId || "org-demo";
    try {
      // Find phone before deletion to remove tag from contacts
      const rows = await this.db.sql`
        SELECT phone FROM public.unsubscribers WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo') LIMIT 1
      `;

      await this.db.sql`
        DELETE FROM public.unsubscribers
        WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo')
      `;

      if (rows && rows.length > 0 && rows[0].phone) {
        const phone = rows[0].phone;
        await this.db.sql`
          UPDATE public.contacts
          SET tags = tags - 'UNSUBSCRIBED'
          WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo')
            AND (phone = ${phone} OR phone = ${phone.slice(-10)})
        `.catch(() => {});
      }

      this.logger.log(`Removed unsubscriber ${id} (Re-subscribed)`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to delete unsubscriber ${id}: ${err.message}`);
      return false;
    }
  }

  async getUnsubscribedPhonesSet(orgId?: string): Promise<Set<string>> {
    const effectiveOrg = orgId || "org-demo";
    const set = new Set<string>();
    try {
      const rows = await this.db.sql`
        SELECT phone FROM public.unsubscribers
        WHERE organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id = 'org_default' OR organization_id IS NOT NULL
      `;
      (rows || []).forEach((r) => {
        if (r.phone) {
          const clean = r.phone.replace(/\D/g, "");
          set.add(clean);
          if (clean.length > 10) set.add(clean.slice(-10));
        }
      });
    } catch (err: any) {
      this.logger.warn(`Error reading unsubscribed phones set: ${err.message}`);
    }
    return set;
  }
}
