import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import * as crypto from "crypto";

export interface BroadcastTemplateItem {
  id: string;
  organizationId: string;
  shopId?: string;
  title: string;
  bodyText: string;
  category: "RECALL" | "PRODUCT" | "VIP" | "PROMO" | "FESTIVAL" | "TRANSACTIONAL" | "GENERAL";
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  icon?: string;
  variables: Array<{ key: string; description: string; fallback?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  title: string;
  bodyText: string;
  category?: "RECALL" | "PRODUCT" | "VIP" | "PROMO" | "FESTIVAL" | "TRANSACTIONAL" | "GENERAL";
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  icon?: string;
  variables?: Array<{ key: string; description: string; fallback?: string }>;
}

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    await this.seedDefaultsIfEmpty();
  }

  private parseJson(v: any) {
    if (!v) return [];
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch { return []; }
  }

  // --- SEED DEFAULT HIGH QUALITY TEMPLATES IF DATABASE HAS NO TEMPLATES ---
  public async seedDefaultsIfEmpty() {
    try {
      const countRes = await this.db.sql`SELECT COUNT(*)::int as count FROM broadcast_templates`;
      const count = countRes[0]?.count || 0;

      if (count === 0) {
        const defaults: CreateTemplateInput[] = [
          {
            title: "Eye Checkup Renewal Recall",
            category: "RECALL",
            icon: "Eye",
            mediaType: "NONE",
            bodyText: "Dear {{customer_name}},\n\nIt's time for your annual eye prescription checkup at {{shop_name}}. Regular checkups ensure crystal clear vision and eye health.\n\nReply with 1 to book your slot or visit us in {{city}}!",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Valued Customer" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "OpticalManager" },
              { key: "{{city}}", description: "Store City", fallback: "your city" },
            ],
          },
          {
            title: "VIP Exclusive Discount Voucher",
            category: "VIP",
            icon: "Crown",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
            bodyText: "VIP Exclusive Alert for {{customer_name}}!\n\nAs our valued VIP customer, {{shop_name}} is giving you an instant discount on progressive and anti-glare lenses using code *{{voucher_code}}*.\n\nValid until {{expiry_date}}! Visit store or reply here to reserve.",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Customer" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "Optical Store" },
              { key: "{{voucher_code}}", description: "Promo Code", fallback: "VIP500" },
              { key: "{{expiry_date}}", description: "Voucher Expiry", fallback: "this weekend" },
            ],
          },
          {
            title: "Summer Polarized Sunglasses Promo",
            category: "PROMO",
            icon: "Sun",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80",
            bodyText: "Hey {{customer_name}}! ☀️\n\nProtect your eyes with style! Get 30% OFF on polarized & UV400 sunglasses at {{shop_name}}.\n\nVisit our {{city}} branch today - limited stock available!",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Friend" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "OpticalManager" },
              { key: "{{city}}", description: "Store City", fallback: "our store" },
            ],
          },
          {
            title: "Premium Titanium Frames & Lenses Offer",
            category: "PRODUCT",
            icon: "Glasses",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1577803645773-f96470509666?w=800&auto=format&fit=crop&q=80",
            bodyText: "Hello {{customer_name}},\n\nUpgrade your everyday look with lightweight Titanium Frames & Blue-Block Lenses at {{shop_name}}.\n\nSpecial combo pricing starting this week!",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Customer" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "Optical Store" },
            ],
          },
          {
            title: "Festival Greetings & Seasonal Offer",
            category: "FESTIVAL",
            icon: "Sparkles",
            mediaType: "IMAGE",
            mediaUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80",
            bodyText: "Wishing you and your family joy and celebration, {{customer_name}}!\n\nEnjoy {{discount_percent}} OFF on all designer eyewear across all {{shop_name}} outlets in {{city}}.\n\nHappy Celebrations!",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Valued Customer" },
              { key: "{{discount_percent}}", description: "Discount Percentage", fallback: "20%" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "OpticalManager" },
              { key: "{{city}}", description: "Store City", fallback: "our stores" },
            ],
          },
          {
            title: "Specs Order Ready for Pickup Alert",
            category: "TRANSACTIONAL",
            icon: "CheckCircle2",
            mediaType: "NONE",
            bodyText: "Dear {{customer_name}},\n\nYour spectacles order #{{order_id}} is ready for pickup at {{shop_name}}.\n\nPlease visit our store during operating hours to collect your glasses and get a free fitting adjustment!",
            variables: [
              { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Customer" },
              { key: "{{order_id}}", description: "Order Reference", fallback: "OM-8920" },
              { key: "{{shop_name}}", description: "Optical Store Name", fallback: "our branch" },
            ],
          },
        ];

        for (const t of defaults) {
          const id = "tpl_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
          await this.db.sql`
            INSERT INTO broadcast_templates (id, organization_id, title, body_text, category, media_type, media_url, button_text, button_url, icon, variables, created_at, updated_at)
            VALUES (
              ${id},
              'org-demo',
              ${t.title},
              ${t.bodyText},
              ${t.category || 'GENERAL'},
              ${t.mediaType || 'NONE'},
              ${t.mediaUrl || null},
              ${t.buttonText || null},
              ${t.buttonUrl || null},
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
  async findAll(orgId: string, category?: string, search?: string): Promise<BroadcastTemplateItem[]> {
    const effectiveOrg = orgId || "org-demo";

    const rows = await this.db.sql`
      SELECT id, organization_id, shop_id, title, body_text, category, media_type, media_url, button_text, button_url, icon, variables, created_at, updated_at
      FROM broadcast_templates
      WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
      ORDER BY updated_at DESC
    `;

    let results = (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      shopId: r.shop_id || undefined,
      title: r.title,
      bodyText: r.body_text,
      category: (r.category || "GENERAL") as any,
      mediaType: (r.media_type || "NONE") as any,
      mediaUrl: r.media_url || undefined,
      buttonText: r.button_text || undefined,
      buttonUrl: r.button_url || undefined,
      icon: r.icon || "MessageSquare",
      variables: this.parseJson(r.variables),
      createdAt: new Date(r.created_at || Date.now()),
      updatedAt: new Date(r.updated_at || Date.now()),
    }));

    if (category && category !== "ALL") {
      results = results.filter((t) => t.category === category);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter((t) => t.title.toLowerCase().includes(q) || t.bodyText.toLowerCase().includes(q));
    }

    return results;
  }

  // --- FIND ONE TEMPLATE ---
  async findOne(orgId: string, id: string): Promise<BroadcastTemplateItem> {
    const effectiveOrg = orgId || "org-demo";
    const rows = await this.db.sql`
      SELECT id, organization_id, shop_id, title, body_text, category, media_type, media_url, button_text, button_url, icon, variables, created_at, updated_at
      FROM broadcast_templates
      WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Template not found.");
    }
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      shopId: r.shop_id || undefined,
      title: r.title,
      bodyText: r.body_text,
      category: (r.category || "GENERAL") as any,
      mediaType: (r.media_type || "NONE") as any,
      mediaUrl: r.media_url || undefined,
      buttonText: r.button_text || undefined,
      buttonUrl: r.button_url || undefined,
      icon: r.icon || "MessageSquare",
      variables: this.parseJson(r.variables),
      createdAt: new Date(r.created_at || Date.now()),
      updatedAt: new Date(r.updated_at || Date.now()),
    };
  }

  // --- CREATE TEMPLATE ---
  async create(orgId: string, data: CreateTemplateInput): Promise<BroadcastTemplateItem> {
    if (!data.title || !data.title.trim()) {
      throw new BadRequestException("Template title is required.");
    }
    if (!data.bodyText || !data.bodyText.trim()) {
      throw new BadRequestException("Template message body is required.");
    }

    const effectiveOrg = orgId || "org-demo";
    const id = "tpl_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
    const category = data.category || "GENERAL";
    const mediaType = data.mediaType || "NONE";
    const icon = data.icon || (category === "RECALL" ? "Eye" : category === "VIP" ? "Crown" : category === "PROMO" ? "Sun" : category === "PRODUCT" ? "Glasses" : category === "FESTIVAL" ? "Sparkles" : "MessageSquare");

    // Extract dynamic variables from body text (e.g. {{customer_name}})
    const foundVars: Array<{ key: string; description: string }> = [];
    const matches = data.bodyText.match(/{{([a-zA-Z0-9_-]+)}}/g);
    if (matches) {
      Array.from(new Set(matches)).forEach((m) => {
        const cleanName = m.replace(/[{}]/g, "").replace(/_/g, " ");
        foundVars.push({ key: m, description: cleanName.charAt(0).toUpperCase() + cleanName.slice(1) });
      });
    }

    await this.db.sql`
      INSERT INTO broadcast_templates (
        id, organization_id, title, body_text, category, media_type, media_url, button_text, button_url, icon, variables, created_at, updated_at
      ) VALUES (
        ${id},
        ${effectiveOrg},
        ${data.title.trim()},
        ${data.bodyText.trim()},
        ${category},
        ${mediaType},
        ${data.mediaUrl || null},
        ${data.buttonText?.trim() || null},
        ${data.buttonUrl?.trim() || null},
        ${icon},
        ${JSON.stringify(data.variables || foundVars)}::jsonb,
        NOW(),
        NOW()
      )
    `;

    return this.findOne(effectiveOrg, id);
  }

  // --- UPDATE TEMPLATE ---
  async update(orgId: string, id: string, data: Partial<CreateTemplateInput>): Promise<BroadcastTemplateItem> {
    const effectiveOrg = orgId || "org-demo";
    await this.findOne(effectiveOrg, id);

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

    await this.db.sql`
      UPDATE broadcast_templates
      SET
        title = COALESCE(${data.title?.trim() || null}, title),
        body_text = COALESCE(${data.bodyText?.trim() || null}, body_text),
        category = COALESCE(${data.category || null}, category),
        media_type = COALESCE(${data.mediaType || null}, media_type),
        media_url = COALESCE(${data.mediaUrl || null}, media_url),
        button_text = COALESCE(${data.buttonText?.trim() || null}, button_text),
        button_url = COALESCE(${data.buttonUrl?.trim() || null}, button_url),
        icon = COALESCE(${data.icon || null}, icon),
        variables = COALESCE(${varsJson ? varsJson : null}::jsonb, variables),
        updated_at = NOW()
      WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    return this.findOne(effectiveOrg, id);
  }

  // --- DUPLICATE TEMPLATE ---
  async duplicate(orgId: string, id: string): Promise<BroadcastTemplateItem> {
    const orig = await this.findOne(orgId, id);
    return this.create(orgId, {
      title: orig.title + " (Copy)",
      bodyText: orig.bodyText,
      category: orig.category,
      mediaType: orig.mediaType,
      mediaUrl: orig.mediaUrl,
      buttonText: orig.buttonText,
      buttonUrl: orig.buttonUrl,
      icon: orig.icon,
      variables: orig.variables,
    });
  }

  // --- DELETE TEMPLATE ---
  async delete(orgId: string, id: string) {
    const effectiveOrg = orgId || "org-demo";
    await this.db.sql`
      DELETE FROM broadcast_templates
      WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;
    return { success: true, message: "Template deleted successfully." };
  }
}
