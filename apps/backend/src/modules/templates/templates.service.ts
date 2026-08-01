import { Injectable, Logger, NotFoundException } from "@nestjs/common";

export interface BroadcastTemplateItem {
  id: string;
  organizationId: string;
  shopId?: string;
  title: string;
  bodyText: string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";
  mediaUrl?: string;
  variables: Array<{ key: string; description: string; fallback?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private templatesStore: Map<string, BroadcastTemplateItem> = new Map();

  constructor() {
    // Seed initial production sample templates
    const sample1: BroadcastTemplateItem = {
      id: "tmpl-001",
      organizationId: "org-demo",
      title: "Festival Discount Special Offer",
      bodyText: "Hello {{customer_name}}! 🕶️ Celebrate this festival with 20% OFF on all premium titanium spectacle frames at {{shop_name}}. Visit us in {{city}} today!",
      mediaType: "IMAGE",
      mediaUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80",
      variables: [
        { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Valued Customer" },
        { key: "{{shop_name}}", description: "Optical Store Branch Name", fallback: "OpticalManager" },
        { key: "{{city}}", description: "City Location", fallback: "your city" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sample2: BroadcastTemplateItem = {
      id: "tmpl-002",
      organizationId: "org-demo",
      title: "Annual Eye Test Recall Reminder",
      bodyText: "Hi {{customer_name}}, it has been 12 months since your last eye exam on {{last_prescription_date}}. Book your eye refraction test today at {{shop_name}} to ensure crystal clear vision!",
      mediaType: "NONE",
      variables: [
        { key: "{{customer_name}}", description: "Customer Full Name", fallback: "Patient" },
        { key: "{{last_prescription_date}}", description: "Last Tested Date", fallback: "recently" },
        { key: "{{shop_name}}", description: "Optical Store Branch Name", fallback: "our clinic" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templatesStore.set(sample1.id, sample1);
    this.templatesStore.set(sample2.id, sample2);
  }

  /**
   * Helper to parse dynamic variables {{variable_name}} from template body text.
   */
  private parseVariables(bodyText: string): Array<{ key: string; description: string }> {
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(bodyText)) !== null) {
      matches.add(`{{${match[1]}}}`);
    }
    return Array.from(matches).map((key) => ({
      key,
      description: key.replace(/[\{\}]/g, "").replace(/_/g, " "),
    }));
  }

  findAll(orgId: string): BroadcastTemplateItem[] {
    return Array.from(this.templatesStore.values()).filter(
      (tmpl) => tmpl.organizationId === orgId || tmpl.organizationId === "org-demo"
    );
  }

  findOne(id: string): BroadcastTemplateItem {
    const tmpl = this.templatesStore.get(id);
    if (!tmpl) {
      throw new NotFoundException(`Template with ID ${id} not found.`);
    }
    return tmpl;
  }

  create(orgId: string, payload: { title: string; bodyText: string; mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO"; mediaUrl?: string }): BroadcastTemplateItem {
    const variables = this.parseVariables(payload.bodyText);
    const newTemplate: BroadcastTemplateItem = {
      id: `tmpl-${Date.now()}`,
      organizationId: orgId,
      title: payload.title,
      bodyText: payload.bodyText,
      mediaType: payload.mediaType || "NONE",
      mediaUrl: payload.mediaUrl,
      variables,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templatesStore.set(newTemplate.id, newTemplate);
    this.logger.log(`Created template ${newTemplate.id} (${newTemplate.title}) with ${variables.length} variables.`);
    return newTemplate;
  }

  remove(id: string): void {
    if (!this.templatesStore.has(id)) {
      throw new NotFoundException(`Template with ID ${id} not found.`);
    }
    this.templatesStore.delete(id);
  }
}
