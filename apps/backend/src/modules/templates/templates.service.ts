import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WabaService } from "../waba/waba.service";
import { normalizePublicMediaUrl } from "../media/media-url.utils";
import * as crypto from "crypto";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface BroadcastTemplateItem {
  id: string;
  organizationId: string;
  shopId?: string;
  title: string;
  bodyText: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "RECALL" | "PRODUCT" | "VIP" | "PROMO" | "FESTIVAL" | "TRANSACTIONAL" | "REMINDER" | "GREETING" | "GENERAL" | string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  icon?: string;
  variables: Array<{ key: string; description: string; fallback?: string }>;
  // WABA Meta Fields
  metaTemplateId?: string;
  metaTemplateName?: string;
  metaStatus: "LOCAL_DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  metaRejectionReason?: string;
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
  headerContent?: string;
  footerText?: string;
  buttons: TemplateButton[];
  sampleValues: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  title: string;
  bodyText: string;
  category?: string;
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  icon?: string;
  variables?: Array<{ key: string; description: string; fallback?: string }>;
  // WABA Meta Fields
  metaTemplateId?: string;
  metaTemplateName?: string;
  metaStatus?: "LOCAL_DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  metaRejectionReason?: string;
  language?: string;
  headerType?: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
  headerContent?: string;
  footerText?: string;
  buttons?: TemplateButton[];
  sampleValues?: Record<string, string>;
}

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wabaService: WabaService
  ) {}

  async onModuleInit() {
    await this.seedDefaultsIfEmpty();
  }

  private parseJson(v: any, fallback: any = []) {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  // --- SEED DEFAULT HIGH QUALITY TEMPLATES IF DATABASE HAS NO SYSTEM TEMPLATES ---
  public async seedDefaultsIfEmpty() {
    try {
      const countRes = await this.db.sql`SELECT COUNT(*)::int as count FROM broadcast_templates WHERE organization_id = 'system'`;
      const count = countRes[0]?.count || 0;

      if (count === 0) {
        const defaults: CreateTemplateInput[] = [
          {
            title: "Eye Checkup Renewal Recall",
            metaTemplateName: "eye_checkup_renewal_recall",
            category: "UTILITY",
            icon: "Eye",
            headerType: "NONE",
            mediaType: "NONE",
            bodyText: "Dear {{1}},\n\nIt's time for your annual eye prescription checkup at {{2}}. Regular checkups ensure crystal clear vision and eye health.\n\nReply with 1 to book your slot or visit us in {{3}}!",
            footerText: "Reply STOP to unsubscribe",
            sampleValues: { "1": "Rahul Sharma", "2": "OpticalManager", "3": "Delhi" },
            buttons: [{ type: "QUICK_REPLY", text: "Book Appointment" }],
            variables: [
              { key: "{{1}}", description: "Customer Full Name", fallback: "Valued Customer" },
              { key: "{{2}}", description: "Optical Store Name", fallback: "OpticalManager" },
              { key: "{{3}}", description: "Store City", fallback: "your city" },
            ],
          },
          {
            title: "VIP Exclusive Discount Voucher",
            metaTemplateName: "vip_exclusive_discount_voucher",
            category: "MARKETING",
            icon: "Crown",
            headerType: "IMAGE",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
            bodyText: "VIP Exclusive Alert for {{1}}!\n\nAs our valued customer, {{2}} is giving you an instant discount on premium lenses using code *{{3}}*.\n\nValid until {{4}}! Visit store or tap below to claim.",
            footerText: "Terms and conditions apply",
            sampleValues: { "1": "Rahul", "2": "Optical Store", "3": "VIP500", "4": "Sunday" },
            buttons: [
              { type: "URL", text: "Claim Voucher", url: "https://example.com/voucher" },
              { type: "QUICK_REPLY", text: "Contact Support" },
            ],
            variables: [
              { key: "{{1}}", description: "Customer Name", fallback: "Customer" },
              { key: "{{2}}", description: "Store Name", fallback: "Optical Store" },
              { key: "{{3}}", description: "Promo Code", fallback: "VIP500" },
              { key: "{{4}}", description: "Voucher Expiry", fallback: "this weekend" },
            ],
          },
          {
            title: "Summer Polarized Sunglasses Promo",
            metaTemplateName: "summer_polarized_sunglasses_promo",
            category: "MARKETING",
            icon: "Sun",
            headerType: "IMAGE",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80",
            bodyText: "Hey {{1}}! ☀️\n\nProtect your eyes with style! Get 30% OFF on polarized & UV400 sunglasses at {{2}}.\n\nVisit our {{3}} branch today - limited stock available!",
            footerText: "Valid while stocks last",
            sampleValues: { "1": "Rahul", "2": "OpticalManager", "3": "Downtown" },
            buttons: [{ type: "QUICK_REPLY", text: "View Catalog" }],
            variables: [
              { key: "{{1}}", description: "Customer Name", fallback: "Friend" },
              { key: "{{2}}", description: "Store Name", fallback: "OpticalManager" },
              { key: "{{3}}", description: "Store City", fallback: "our store" },
            ],
          },
          {
            title: "Specs Order Ready for Pickup Alert",
            metaTemplateName: "order_ready_pickup_alert",
            category: "UTILITY",
            icon: "CheckCircle2",
            headerType: "TEXT",
            headerContent: "Order Ready For Pickup",
            mediaType: "NONE",
            bodyText: "Dear {{1}},\n\nYour spectacles order #{{2}} is ready for pickup at {{3}}.\n\nPlease visit our store during operating hours to collect your glasses and get a complimentary fitting adjustment!",
            footerText: "Thank you for choosing us",
            sampleValues: { "1": "Rahul", "2": "OM-8920", "3": "Main Branch" },
            buttons: [{ type: "QUICK_REPLY", text: "Store Timings" }],
            variables: [
              { key: "{{1}}", description: "Customer Name", fallback: "Customer" },
              { key: "{{2}}", description: "Order Reference", fallback: "OM-8920" },
              { key: "{{3}}", description: "Store Branch", fallback: "our branch" },
            ],
          },
        ];

        for (const t of defaults) {
          const id = "tpl_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
          await this.db.sql`
            INSERT INTO broadcast_templates (
              id, organization_id, title, meta_template_name, meta_status, language,
              header_type, header_content, footer_text, buttons, sample_values,
              body_text, category, media_type, media_url, icon, variables, created_at, updated_at
            )
            VALUES (
              ${id},
              'system',
              ${t.title},
              ${t.metaTemplateName || null},
              'LOCAL_DRAFT',
              'en_US',
              ${t.headerType || 'NONE'},
              ${t.headerContent || null},
              ${t.footerText || null},
              ${JSON.stringify(t.buttons || [])}::jsonb,
              ${JSON.stringify(t.sampleValues || {})}::jsonb,
              ${t.bodyText},
              ${t.category || 'MARKETING'},
              ${t.mediaType || 'NONE'},
              ${t.mediaUrl || null},
              ${t.icon || 'MessageSquare'},
              ${JSON.stringify(t.variables || [])}::jsonb,
              NOW(),
              NOW()
            )
          `;
        }
        this.logger.log(`Seeded ${defaults.length} default broadcast templates.`);
      }
    } catch (err: any) {
      this.logger.warn(`Error seeding templates: ${err.message}`);
    }
  }

  // --- FIND ALL TEMPLATES ---
  async findAll(orgId: string, category?: string, search?: string, metaStatus?: string): Promise<BroadcastTemplateItem[]> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    await this.seedDefaultsIfEmpty();
    let rows: any[] = [];
    try {
      rows = await this.db.sql`
        SELECT 
          id, organization_id, shop_id, title, body_text, category, media_type, media_url, 
          button_text, button_url, icon, variables,
          meta_template_id, meta_template_name, meta_status, meta_rejection_reason, 
          language, header_type, header_content, footer_text, buttons, sample_values,
          created_at, updated_at
        FROM broadcast_templates
        WHERE organization_id = ${orgId} OR organization_id = 'system'
        ORDER BY updated_at DESC
      `;
    } catch (err: any) {
      this.logger.warn(`Error loading templates: ${err.message}`);
    }

    let results = (rows || []).map((r: any) => this.mapRow(r));

    if (category && category !== "ALL") {
      results = results.filter((t) => t.category === category);
    }

    if (metaStatus && metaStatus !== "ALL") {
      results = results.filter((t) => t.metaStatus === metaStatus);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter((t) => 
        t.title.toLowerCase().includes(q) || 
        t.bodyText.toLowerCase().includes(q) ||
        (t.metaTemplateName && t.metaTemplateName.toLowerCase().includes(q))
      );
    }

    return results;
  }

  // --- FIND ONE TEMPLATE ---
  async findOne(orgId: string, id: string): Promise<BroadcastTemplateItem> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    const rows = await this.db.sql`
      SELECT 
        id, organization_id, shop_id, title, body_text, category, media_type, media_url, 
        button_text, button_url, icon, variables,
        meta_template_id, meta_template_name, meta_status, meta_rejection_reason, 
        language, header_type, header_content, footer_text, buttons, sample_values,
        created_at, updated_at
      FROM broadcast_templates
      WHERE id = ${id} AND (organization_id = ${orgId} OR organization_id = 'system')
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Template not found.");
    }
    return this.mapRow(rows[0]);
  }

  // --- CREATE TEMPLATE ---
  async create(orgId: string, data: CreateTemplateInput): Promise<BroadcastTemplateItem> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    if (!data.title || !data.title.trim()) {
      throw new BadRequestException("Template title is required.");
    }
    if (!data.bodyText || !data.bodyText.trim()) {
      throw new BadRequestException("Template message body is required.");
    }

    const id = "tpl_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
    const category = data.category || "MARKETING";
    const mediaType = data.mediaType || "NONE";
    const headerType = data.headerType || (mediaType !== "NONE" ? mediaType : "NONE");
    const icon = data.icon || (category === "RECALL" ? "Eye" : category === "VIP" ? "Crown" : category === "PROMO" ? "Sun" : category === "PRODUCT" ? "Glasses" : "MessageSquare");

    // Slugify Meta template identifier
    const metaTemplateName = data.metaTemplateName 
      ? data.metaTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64)
      : data.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);

    // Dynamic variables
    const foundVars: Array<{ key: string; description: string }> = [];
    const matches = data.bodyText.match(/{{([a-zA-Z0-9_-]+)}}/g);
    if (matches) {
      Array.from(new Set(matches)).forEach((m) => {
        const cleanName = m.replace(/[{}]/g, "").replace(/_/g, " ");
        foundVars.push({ key: m, description: cleanName.charAt(0).toUpperCase() + cleanName.slice(1) });
      });
    }

    const buttonsJson = JSON.stringify(data.buttons || []);
    const sampleValuesJson = JSON.stringify(data.sampleValues || {});
    const varsJson = JSON.stringify(data.variables || foundVars);

    await this.db.sql`
      INSERT INTO broadcast_templates (
        id, organization_id, title, body_text, category, media_type, media_url, 
        button_text, button_url, icon, variables,
        meta_template_id, meta_template_name, meta_status, meta_rejection_reason,
        language, header_type, header_content, footer_text, buttons, sample_values,
        created_at, updated_at
      ) VALUES (
        ${id},
        ${orgId},
        ${data.title.trim()},
        ${data.bodyText.trim()},
        ${category},
        ${mediaType},
        ${data.mediaUrl ? normalizePublicMediaUrl(data.mediaUrl, mediaType as any) : null},
        ${data.buttonText?.trim() || null},
        ${data.buttonUrl?.trim() || null},
        ${icon},
        ${varsJson}::jsonb,
        ${data.metaTemplateId || null},
        ${metaTemplateName},
        ${data.metaStatus || 'LOCAL_DRAFT'},
        ${data.metaRejectionReason || null},
        ${data.language || 'en_US'},
        ${headerType},
        ${data.headerContent?.trim() || null},
        ${data.footerText?.trim() || null},
        ${buttonsJson}::jsonb,
        ${sampleValuesJson}::jsonb,
        NOW(),
        NOW()
      )
    `;

    return this.findOne(orgId, id);
  }

  // --- UPDATE TEMPLATE ---
  async update(orgId: string, id: string, data: Partial<CreateTemplateInput>): Promise<BroadcastTemplateItem> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    const existing = await this.findOne(orgId, id);
    if (existing.organizationId === "system") {
      throw new BadRequestException("System templates cannot be modified directly. Please duplicate to create a customizable copy.");
    }

    let varsJson = null;
    if (data.bodyText) {
      const matches = data.bodyText.match(/{{([a-zA-Z0-9_-]+)}}/g);
      if (matches) {
        const foundVars: Array<{ key: string; description: string }> = [];
        Array.from(new Set(matches)).forEach((m) => {
          const cleanName = m.replace(/[{}]/g, "").replace(/_/g, " ");
          foundVars.push({ key: m, description: cleanName.charAt(0).toUpperCase() + cleanName.slice(1) });
        });
        varsJson = JSON.stringify(foundVars);
      }
    }

    const normalizedUpdateMediaUrl = data.mediaUrl
      ? normalizePublicMediaUrl(data.mediaUrl, (data.mediaType || existing.mediaType) as any)
      : (data.mediaUrl === "" ? null : undefined);

    const metaName = data.metaTemplateName !== undefined
      ? data.metaTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64)
      : undefined;

    await this.db.sql`
      UPDATE broadcast_templates
      SET
        title = COALESCE(${data.title?.trim() || null}, title),
        body_text = COALESCE(${data.bodyText?.trim() || null}, body_text),
        category = COALESCE(${data.category || null}, category),
        media_type = COALESCE(${data.mediaType || null}, media_type),
        media_url = CASE WHEN ${data.mediaUrl !== undefined} THEN ${normalizedUpdateMediaUrl ?? null} ELSE media_url END,
        button_text = CASE WHEN ${data.buttonText !== undefined} THEN ${data.buttonText?.trim() || null} ELSE button_text END,
        button_url = CASE WHEN ${data.buttonUrl !== undefined} THEN ${data.buttonUrl?.trim() || null} ELSE button_url END,
        icon = COALESCE(${data.icon || null}, icon),
        variables = COALESCE(${varsJson ? varsJson : null}::jsonb, variables),
        meta_template_name = COALESCE(${metaName || null}, meta_template_name),
        language = COALESCE(${data.language || null}, language),
        header_type = COALESCE(${data.headerType || null}, header_type),
        header_content = CASE WHEN ${data.headerContent !== undefined} THEN ${data.headerContent?.trim() || null} ELSE header_content END,
        footer_text = CASE WHEN ${data.footerText !== undefined} THEN ${data.footerText?.trim() || null} ELSE footer_text END,
        buttons = CASE WHEN ${data.buttons !== undefined} THEN ${JSON.stringify(data.buttons)}::jsonb ELSE buttons END,
        sample_values = CASE WHEN ${data.sampleValues !== undefined} THEN ${JSON.stringify(data.sampleValues)}::jsonb ELSE sample_values END,
        updated_at = NOW()
      WHERE id = ${id} AND organization_id = ${orgId}
    `;

    return this.findOne(orgId, id);
  }

  // --- DUPLICATE TEMPLATE ---
  async duplicate(orgId: string, id: string): Promise<BroadcastTemplateItem> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    const orig = await this.findOne(orgId, id);
    const newTitle = orig.title + " (Copy)";
    const newMetaName = (orig.metaTemplateName || orig.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")) + "_copy";

    return this.create(orgId, {
      title: newTitle,
      metaTemplateName: newMetaName,
      bodyText: orig.bodyText,
      category: orig.category,
      mediaType: orig.mediaType,
      mediaUrl: orig.mediaUrl,
      buttonText: orig.buttonText,
      buttonUrl: orig.buttonUrl,
      icon: orig.icon,
      headerType: orig.headerType,
      headerContent: orig.headerContent,
      footerText: orig.footerText,
      buttons: orig.buttons,
      sampleValues: orig.sampleValues,
      language: orig.language,
      variables: orig.variables,
    });
  }

  // --- DELETE TEMPLATE ---
  async delete(orgId: string, id: string) {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    const existing = await this.findOne(orgId, id);
    if (existing.organizationId === "system") {
      throw new BadRequestException("System templates cannot be deleted.");
    }

    // If template was submitted to Meta, optionally attempt Meta deletion
    if (existing.metaTemplateName && existing.metaStatus !== "LOCAL_DRAFT") {
      try {
        await this.wabaService.deleteMetaTemplate(orgId, existing.metaTemplateName);
      } catch (err: any) {
        this.logger.warn(`Meta template deletion note: ${err.message}`);
      }
    }

    await this.db.sql`
      DELETE FROM broadcast_templates
      WHERE id = ${id} AND organization_id = ${orgId}
    `;
    return { success: true, message: "Template deleted successfully." };
  }

  // --- SUBMIT TEMPLATE TO META CLOUD API FOR VERIFICATION ---
  async submitToMeta(orgId: string, id: string): Promise<BroadcastTemplateItem> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }
    const tpl = await this.findOne(orgId, id);

    // 1. Slugify and validate template name
    let metaName = tpl.metaTemplateName;
    if (!metaName || !/^[a-z0-9_]+$/.test(metaName)) {
      metaName = tpl.title
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64);
    }
    if (!metaName) {
      metaName = `tpl_${Date.now()}`;
    }

    // 2. Map category to Meta's 3 official categories (MARKETING, UTILITY, AUTHENTICATION)
    let metaCategory = "MARKETING";
    if (tpl.category === "TRANSACTIONAL" || tpl.category === "RECALL" || tpl.category === "REMINDER" || tpl.category === "UTILITY") {
      metaCategory = "UTILITY";
    } else if (tpl.category === "AUTHENTICATION") {
      metaCategory = "AUTHENTICATION";
    }

    // 3. Process Body Text & Convert Named Tokens to Positional Tokens {{1}}, {{2}}
    const sampleValues = tpl.sampleValues || {};
    let varCounter = 1;
    const tokenMap: Record<string, number> = {};
    const bodySamples: string[] = [];

    // Strip spintax if present: Meta rejects templates with curly bracket spintax {Hello|Hi}
    let sanitizedBody = tpl.bodyText.replace(/{([^{}]+)}/g, (_, choices) => {
      const parts = choices.split("|");
      return parts[0] || choices;
    });

    const metaBodyText = sanitizedBody.replace(/{{([a-zA-Z0-9_\-]+)}}/g, (match, key) => {
      if (/^\d+$/.test(key)) {
        const num = parseInt(key, 10);
        const val = sampleValues[key] || `Sample ${num}`;
        bodySamples[num - 1] = val;
        return match;
      }
      if (!tokenMap[key]) {
        tokenMap[key] = varCounter++;
        const val = sampleValues[key] || sampleValues[String(tokenMap[key])] || key.replace(/_/g, " ");
        bodySamples.push(val);
      }
      return `{{${tokenMap[key]}}}`;
    });

    // Ensure no gaps in body samples
    for (let i = 0; i < bodySamples.length; i++) {
      if (!bodySamples[i]) {
        bodySamples[i] = `Sample ${i + 1}`;
      }
    }

    // 4. Build Components Array conforming to Meta Cloud API v20.0
    const components: any[] = [];

    // Header Component
    const headerType = tpl.headerType || (tpl.mediaType !== "NONE" ? tpl.mediaType : "NONE");
    if (headerType === "TEXT" && tpl.headerContent && tpl.headerContent.trim()) {
      const headerText = tpl.headerContent.trim();
      const hasVar = /{{1}}/.test(headerText);
      const headerComp: any = {
        type: "HEADER",
        format: "TEXT",
        text: headerText,
      };
      if (hasVar) {
        headerComp.example = {
          header_text: [sampleValues["header_1"] || "Welcome"],
        };
      }
      components.push(headerComp);
    } else if (["IMAGE", "DOCUMENT", "VIDEO"].includes(headerType)) {
      const mediaHeaderComp: any = {
        type: "HEADER",
        format: headerType,
      };
      const sampleMediaUrl = tpl.headerContent || tpl.mediaUrl;
      if (sampleMediaUrl && sampleMediaUrl.startsWith("http")) {
        mediaHeaderComp.example = {
          header_handle: [sampleMediaUrl],
        };
      }
      components.push(mediaHeaderComp);
    }

    // Body Component (Mandatory)
    const bodyComp: any = {
      type: "BODY",
      text: metaBodyText,
    };
    if (bodySamples.length > 0) {
      bodyComp.example = {
        body_text: [bodySamples],
      };
    }
    components.push(bodyComp);

    // Footer Component (Optional, max 60 chars)
    if (tpl.footerText && tpl.footerText.trim()) {
      components.push({
        type: "FOOTER",
        text: tpl.footerText.trim().slice(0, 60),
      });
    }

    // Buttons Component (Optional, up to 3 buttons)
    if (Array.isArray(tpl.buttons) && tpl.buttons.length > 0) {
      const validButtons = tpl.buttons.slice(0, 3).map((b) => {
        if (b.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: b.text.slice(0, 25) };
        } else if (b.type === "URL" && b.url) {
          return { type: "URL", text: b.text.slice(0, 25), url: b.url };
        } else if (b.type === "PHONE_NUMBER" && b.phoneNumber) {
          return { type: "PHONE_NUMBER", text: b.text.slice(0, 25), phone_number: b.phoneNumber };
        }
        return null;
      }).filter(Boolean);

      if (validButtons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: validButtons,
        });
      }
    }

    const payload = {
      name: metaName,
      category: metaCategory,
      language: tpl.language || "en_US",
      components,
    };

    this.logger.log(`Submitting template "${metaName}" to Meta Graph API: ${JSON.stringify(payload)}`);

    const metaRes = await this.wabaService.createMetaTemplate(orgId, payload);

    if (!metaRes.success) {
      // Mark as REJECTED in local DB with reason
      await this.db.sql`
        UPDATE broadcast_templates
        SET 
          meta_template_name = ${metaName},
          meta_status = 'REJECTED',
          meta_rejection_reason = ${metaRes.error || "Rejected by Meta API"},
          updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${orgId}
      `;
      throw new BadRequestException(`Meta Template Submission Failed: ${metaRes.error}`);
    }

    // Mark as PENDING or APPROVED
    const finalStatus = metaRes.status?.toUpperCase() === "APPROVED" ? "APPROVED" : "PENDING";
    await this.db.sql`
      UPDATE broadcast_templates
      SET 
        meta_template_id = ${metaRes.id || null},
        meta_template_name = ${metaName},
        meta_status = ${finalStatus},
        meta_rejection_reason = NULL,
        body_text = ${metaBodyText},
        updated_at = NOW()
      WHERE id = ${id} AND organization_id = ${orgId}
    `;

    return this.findOne(orgId, id);
  }

  // --- SYNC TEMPLATES FROM META CLOUD API ---
  async syncFromMeta(orgId: string): Promise<{ success: boolean; count: number; message: string }> {
    if (!orgId) {
      throw new UnauthorizedException("Organization ID is required.");
    }

    const res = await this.wabaService.getMetaTemplates(orgId);
    if (!res.success || !Array.isArray(res.data)) {
      throw new BadRequestException(res.error || "Failed to fetch templates from Meta Cloud API.");
    }

    let syncedCount = 0;

    for (const metaTpl of res.data) {
      const metaId = String(metaTpl.id);
      const metaName = metaTpl.name;
      const metaStatus = (metaTpl.status || "LOCAL_DRAFT").toUpperCase();
      const metaCat = metaTpl.category || "MARKETING";
      const metaLang = metaTpl.language || "en_US";
      const components = Array.isArray(metaTpl.components) ? metaTpl.components : [];

      // Extract components
      let bodyText = "";
      let headerType: any = "NONE";
      let headerContent: string | null = null;
      let footerText: string | null = null;
      let mediaType: any = "NONE";
      let mediaUrl: string | null = null;
      const buttons: TemplateButton[] = [];
      let sampleValues: Record<string, string> = {};

      for (const comp of components) {
        if (comp.type === "BODY") {
          bodyText = comp.text || "";
          if (comp.example?.body_text?.[0]) {
            comp.example.body_text[0].forEach((val: string, idx: number) => {
              sampleValues[String(idx + 1)] = val;
            });
          }
        } else if (comp.type === "HEADER") {
          headerType = comp.format || "TEXT";
          if (headerType === "TEXT") {
            headerContent = comp.text || null;
            if (comp.example?.header_text?.[0]) {
              sampleValues["header_1"] = comp.example.header_text[0];
            }
          } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
            mediaType = headerType;
            if (comp.example?.header_handle?.[0]) {
              mediaUrl = comp.example.header_handle[0];
              headerContent = mediaUrl;
            }
          }
        } else if (comp.type === "FOOTER") {
          footerText = comp.text || null;
        } else if (comp.type === "BUTTONS" && Array.isArray(comp.buttons)) {
          for (const btn of comp.buttons) {
            if (btn.type === "QUICK_REPLY") {
              buttons.push({ type: "QUICK_REPLY", text: btn.text });
            } else if (btn.type === "URL") {
              buttons.push({ type: "URL", text: btn.text, url: btn.url });
            } else if (btn.type === "PHONE_NUMBER") {
              buttons.push({ type: "PHONE_NUMBER", text: btn.text, phoneNumber: btn.phone_number });
            }
          }
        }
      }

      if (!bodyText) {
        bodyText = `Template: ${metaName}`;
      }

      // Check if template already exists
      const existing = await this.db.sql`
        SELECT id FROM broadcast_templates
        WHERE organization_id = ${orgId} AND (meta_template_name = ${metaName} OR meta_template_id = ${metaId})
        LIMIT 1
      `;

      if (existing && existing.length > 0) {
        // Update existing template
        await this.db.sql`
          UPDATE broadcast_templates
          SET
            meta_template_id = ${metaId},
            meta_template_name = ${metaName},
            meta_status = ${metaStatus},
            category = ${metaCat},
            language = ${metaLang},
            header_type = ${headerType},
            header_content = COALESCE(${headerContent}, header_content),
            footer_text = COALESCE(${footerText}, footer_text),
            buttons = ${JSON.stringify(buttons)}::jsonb,
            sample_values = ${JSON.stringify(sampleValues)}::jsonb,
            updated_at = NOW()
          WHERE id = ${existing[0].id} AND organization_id = ${orgId}
        `;
      } else {
        // Insert new template from Meta
        const newId = "tpl_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
        const formattedTitle = metaName
          .split("_")
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ");

        await this.db.sql`
          INSERT INTO broadcast_templates (
            id, organization_id, title, meta_template_name, meta_template_id, meta_status,
            language, header_type, header_content, footer_text, buttons, sample_values,
            body_text, category, media_type, media_url, icon, created_at, updated_at
          ) VALUES (
            ${newId},
            ${orgId},
            ${formattedTitle},
            ${metaName},
            ${metaId},
            ${metaStatus},
            ${metaLang},
            ${headerType},
            ${headerContent},
            ${footerText},
            ${JSON.stringify(buttons)}::jsonb,
            ${JSON.stringify(sampleValues)}::jsonb,
            ${bodyText},
            ${metaCat},
            ${mediaType},
            ${mediaUrl},
            'MessageSquare',
            NOW(),
            NOW()
          )
        `;
      }
      syncedCount++;
    }

    return {
      success: true,
      count: syncedCount,
      message: `Successfully synchronized ${syncedCount} templates from Meta Cloud API.`,
    };
  }

  private mapRow(r: any): BroadcastTemplateItem {
    const buttons = this.parseJson(r.buttons, []);
    const sampleValues = typeof r.sample_values === "object" && r.sample_values !== null 
      ? r.sample_values 
      : this.parseJson(r.sample_values, {});

    return {
      id: r.id,
      organizationId: r.organization_id,
      shopId: r.shop_id || undefined,
      title: r.title,
      bodyText: r.body_text,
      category: (r.category || "MARKETING") as any,
      mediaType: (r.media_type || "NONE") as any,
      mediaUrl: r.media_url ? normalizePublicMediaUrl(r.media_url, r.media_type === "DOCUMENT" ? "DOCUMENT" : "IMAGE") : undefined,
      buttonText: r.button_text || undefined,
      buttonUrl: r.button_url || undefined,
      icon: r.icon || "MessageSquare",
      variables: this.parseJson(r.variables, []),
      metaTemplateId: r.meta_template_id || undefined,
      metaTemplateName: r.meta_template_name || undefined,
      metaStatus: (r.meta_status || "LOCAL_DRAFT") as any,
      metaRejectionReason: r.meta_rejection_reason || undefined,
      language: r.language || "en_US",
      headerType: (r.header_type || (r.media_type && r.media_type !== "NONE" ? r.media_type : "NONE")) as any,
      headerContent: r.header_content || undefined,
      footerText: r.footer_text || undefined,
      buttons,
      sampleValues,
      createdAt: new Date(r.created_at || Date.now()),
      updatedAt: new Date(r.updated_at || Date.now()),
    };
  }
}
