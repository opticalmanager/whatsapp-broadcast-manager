import { Injectable, BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import * as crypto from "crypto";

export interface ContactItem {
  id: string;
  organizationId: string;
  shopId?: string;
  phone: string;
  name?: string;
  email?: string;
  city?: string;
  dob?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

function parseTagsArray(rawTags: any): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.filter(Boolean).map(String);
  if (typeof rawTags === "string") {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      if (typeof parsed === "string") return [parsed];
    } catch {}
    const clean = rawTags.replace(/^\{|\}$/g, "");
    return clean.split(/[,;|]/).map((t: string) => t.trim().replace(/^"|"$/g, "")).filter(Boolean);
  }
  return [];
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly db: DatabaseService) {}

  public normalizePhone(phone: string): string | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      digits = "91" + digits;
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = "91" + digits.slice(1);
    }
    if (digits.length < 10 || digits.length > 15) return null;
    return "+" + digits;
  }

  async uploadCsv(orgId: string, shopId: string, csvContent: string, defaultTag?: string) {
    if (!csvContent || typeof csvContent !== "string") {
      throw new BadRequestException("CSV content is empty.");
    }

    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      throw new BadRequestException("No data rows found in CSV.");
    }

    const rawHeaders = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/[\"\'\s_]/g, ""));
    let nameIdx = -1;
    let phoneIdx = -1;
    let emailIdx = -1;
    let cityIdx = -1;
    let dobIdx = -1;
    let tagIdx = -1;

    rawHeaders.forEach((h, idx) => {
      if (["name", "customername", "fullname", "patientname", "contactname"].includes(h)) nameIdx = idx;
      else if (["phone", "mobile", "contact", "phonenumber", "mobilenumber", "cell", "whatsapp"].includes(h)) phoneIdx = idx;
      else if (["email", "emailaddress", "mail"].includes(h)) emailIdx = idx;
      else if (["city", "location", "address", "town", "place"].includes(h)) cityIdx = idx;
      else if (["dob", "dateofbirth", "birthdate", "birthday", "bday", "birth"].includes(h)) dobIdx = idx;
      else if (["tag", "tags", "category", "segment", "group", "status"].includes(h)) tagIdx = idx;
    });

    let startIndex = 1;
    if (phoneIdx === -1) {
      const firstRowCols = lines[0].split(/[,;\t]/);
      const isFirstRowPhone = firstRowCols.some((col) => col.replace(/\D/g, "").length >= 10);
      if (isFirstRowPhone) {
        startIndex = 0;
        phoneIdx = firstRowCols.findIndex((col) => col.replace(/\D/g, "").length >= 10);
        nameIdx = phoneIdx === 0 ? 1 : 0;
      } else {
        throw new BadRequestException("Could not detect Phone/Mobile column in CSV. Please include a 'Phone' header.");
      }
    }

    let inserted = 0;
    let skipped = 0;
    const sampleContacts: any[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(/[,;\t]/).map((c) => c.replace(/^[\"\'\s]+|[\"\'\s]+$/g, ""));
      if (cols.length === 0 || !cols[phoneIdx]) {
        skipped++;
        continue;
      }

      const normalized = this.normalizePhone(cols[phoneIdx]);
      if (!normalized) {
        skipped++;
        continue;
      }

      const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : "Customer";
      const email = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : null;
      const city = cityIdx !== -1 && cols[cityIdx] ? cols[cityIdx] : null;
      const dob = dobIdx !== -1 && cols[dobIdx] ? cols[dobIdx] : null;

      const rawTags = tagIdx !== -1 && cols[tagIdx] ? cols[tagIdx].split(/[|;,]/).map((t) => t.trim()).filter(Boolean) : [];
      if (defaultTag && defaultTag.trim() && !rawTags.includes(defaultTag.trim())) {
        rawTags.push(defaultTag.trim());
      }

      const contactId = "cnt_" + crypto.createHash("md5").update((orgId || "org-demo") + ":" + normalized).digest("hex").slice(0, 16);

      try {
        await this.db.sql`
          INSERT INTO contacts (id, organization_id, shop_id, phone, name, email, city, dob, tags, updated_at)
          VALUES (
            ${contactId},
            ${orgId || "org-demo"},
            ${shopId || "main-outlet"},
            ${normalized},
            ${name},
            ${email},
            ${city},
            ${dob},
            ${JSON.stringify(rawTags)}::jsonb,
            NOW()
          )
          ON CONFLICT (organization_id, phone)
          DO UPDATE SET
            name = EXCLUDED.name,
            email = COALESCE(EXCLUDED.email, contacts.email),
            city = COALESCE(EXCLUDED.city, contacts.city),
            dob = COALESCE(EXCLUDED.dob, contacts.dob),
            tags = (
              SELECT jsonb_agg(DISTINCT elem)
              FROM jsonb_array_elements_text(COALESCE(contacts.tags, '[]'::jsonb) || EXCLUDED.tags) AS elem
            ),
            updated_at = NOW()
        `;
        inserted++;
        if (sampleContacts.length < 5) {
          sampleContacts.push({ name, phone: normalized, city, dob, tags: rawTags });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to upsert contact ${normalized}: ${err.message}`);
        skipped++;
      }
    }

    this.logger.log(`CSV Upload processed for ${orgId}: ${inserted} upserted, ${skipped} skipped.`);

    return {
      success: true,
      message: `Successfully imported ${inserted} contacts (${skipped} skipped).`,
      totalRows: lines.length - startIndex,
      inserted,
      skipped,
      sampleContacts,
    };
  }

  async findAll(orgId: string, query?: { search?: string; tag?: string; limit?: number; offset?: number }) {
    const effectiveOrg = orgId || "org-demo";
    const limit = Math.min(query?.limit || 100, 1000);
    const offset = query?.offset || 0;
    const search = query?.search ? `%${query.search.trim()}%` : null;
    const tag = query?.tag && query.tag !== "ALL" && query.tag !== "All tags" ? query.tag.trim() : null;

    let rows;
    if (search && tag) {
      rows = await this.db.sql`
        SELECT id, organization_id as "organizationId", shop_id as "shopId", phone, name, email, city, dob, tags, created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
        WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
          AND (name ILIKE ${search} OR phone ILIKE ${search} OR city ILIKE ${search} OR dob ILIKE ${search})
          AND tags @> ${JSON.stringify([tag])}::jsonb
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (search) {
      rows = await this.db.sql`
        SELECT id, organization_id as "organizationId", shop_id as "shopId", phone, name, email, city, dob, tags, created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
        WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
          AND (name ILIKE ${search} OR phone ILIKE ${search} OR city ILIKE ${search} OR dob ILIKE ${search})
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (tag) {
      rows = await this.db.sql`
        SELECT id, organization_id as "organizationId", shop_id as "shopId", phone, name, email, city, dob, tags, created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
        WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
          AND tags @> ${JSON.stringify([tag])}::jsonb
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await this.db.sql`
        SELECT id, organization_id as "organizationId", shop_id as "shopId", phone, name, email, city, dob, tags, created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
        WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const countRes = await this.db.sql`
      SELECT COUNT(*)::int as total FROM contacts WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;
    const total = countRes[0]?.total || 0;

    const sanitizedRows = (rows || []).map((r) => ({
      ...r,
      tags: parseTagsArray(r.tags),
    }));

    return {
      success: true,
      data: sanitizedRows,
      total,
      limit,
      offset,
    };
  }

  async create(orgId: string, shopId: string, data: { phone: string; name?: string; email?: string; city?: string; dob?: string; tags?: string[] }) {
    const normalized = this.normalizePhone(data.phone);
    if (!normalized) {
      throw new BadRequestException("Invalid phone number format. Must be a valid 10-15 digit mobile number.");
    }

    const effectiveOrg = orgId || "org-demo";
    const contactId = "cnt_" + crypto.createHash("md5").update(effectiveOrg + ":" + normalized).digest("hex").slice(0, 16);
    const name = data.name?.trim() || "Customer";
    const tags = Array.isArray(data.tags) ? data.tags.map(t => t.trim()).filter(Boolean) : [];

    await this.db.sql`
      INSERT INTO contacts (id, organization_id, shop_id, phone, name, email, city, dob, tags, created_at, updated_at)
      VALUES (
        ${contactId},
        ${effectiveOrg},
        ${shopId || "main-outlet"},
        ${normalized},
        ${name},
        ${data.email || null},
        ${data.city || null},
        ${data.dob || null},
        ${JSON.stringify(tags)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id, phone)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, contacts.email),
        city = COALESCE(EXCLUDED.city, contacts.city),
        dob = COALESCE(EXCLUDED.dob, contacts.dob),
        tags = (
          SELECT jsonb_agg(DISTINCT elem)
          FROM jsonb_array_elements_text(COALESCE(contacts.tags, '[]'::jsonb) || EXCLUDED.tags) AS elem
        ),
        updated_at = NOW()
    `;

    return {
      success: true,
      message: "Contact saved successfully.",
      contact: {
        id: contactId,
        phone: normalized,
        name,
        email: data.email,
        city: data.city,
        dob: data.dob,
        tags,
      },
    };
  }

  async update(orgId: string, id: string, data: { name?: string; phone?: string; email?: string; city?: string; dob?: string; tags?: string[] }) {
    const effectiveOrg = orgId || "org-demo";
    let normalizedPhone: string | null = null;
    if (data.phone) {
      normalizedPhone = this.normalizePhone(data.phone);
    }

    const tagsJson = data.tags ? JSON.stringify(data.tags.map(t => t.trim()).filter(Boolean)) : null;

    await this.db.sql`
      UPDATE contacts
      SET 
        name = COALESCE(${data.name || null}, name),
        phone = COALESCE(${normalizedPhone || null}, phone),
        email = COALESCE(${data.email || null}, email),
        city = COALESCE(${data.city || null}, city),
        dob = COALESCE(${data.dob || null}, dob),
        tags = COALESCE(${tagsJson}::jsonb, tags),
        updated_at = NOW()
      WHERE id = ${id} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    return { success: true, message: "Contact updated successfully." };
  }

  async delete(orgId: string, contactId: string) {
    const effectiveOrg = orgId || "org-demo";
    await this.db.sql`
      DELETE FROM contacts WHERE id = ${contactId} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;
    return { success: true, message: "Contact deleted successfully." };
  }

  async bulkDelete(orgId: string, contactIds: string[]) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return { success: true, count: 0 };
    }
    const effectiveOrg = orgId || "org-demo";
    await this.db.sql`
      DELETE FROM contacts 
      WHERE id = ANY(${contactIds}) AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;
    return { success: true, message: `Deleted ${contactIds.length} contact(s).`, count: contactIds.length };
  }

  async bulkTag(orgId: string, contactIds: string[], tag: string) {
    if (!Array.isArray(contactIds) || contactIds.length === 0 || !tag?.trim()) {
      return { success: true, count: 0 };
    }
    const cleanTag = tag.trim();
    const effectiveOrg = orgId || "org-demo";

    await this.db.sql`
      UPDATE contacts
      SET 
        tags = (
          SELECT jsonb_agg(DISTINCT elem)
          FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb) || ${JSON.stringify([cleanTag])}::jsonb) AS elem
        ),
        updated_at = NOW()
      WHERE id = ANY(${contactIds}) AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    return { success: true, message: `Applied tag "${cleanTag}" to ${contactIds.length} contact(s).`, count: contactIds.length };
  }

  async bulkRemoveTag(orgId: string, contactIds: string[], tag: string) {
    if (!Array.isArray(contactIds) || contactIds.length === 0 || !tag?.trim()) {
      return { success: true, count: 0 };
    }
    const cleanTag = tag.trim();
    const effectiveOrg = orgId || "org-demo";

    await this.db.sql`
      UPDATE contacts
      SET 
        tags = COALESCE((
          SELECT jsonb_agg(elem)
          FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS elem
          WHERE elem <> ${cleanTag}
        ), '[]'::jsonb),
        updated_at = NOW()
      WHERE id = ANY(${contactIds}) AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    return { success: true, message: `Removed tag "${cleanTag}" from ${contactIds.length} contact(s).`, count: contactIds.length };
  }

  async updateContactTag(orgId: string, contactId: string, newTag?: string, oldTag?: string) {
    const effectiveOrg = orgId || "org-demo";
    
    const rows = await this.db.sql`
      SELECT tags FROM contacts WHERE id = ${contactId} LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Contact not found.");
    }

    let tagsList: string[] = parseTagsArray(rows[0].tags);

    if (oldTag && oldTag !== "Untagged") {
      tagsList = tagsList.filter((t) => t.toLowerCase() !== oldTag.toLowerCase());
    }

    if (newTag && newTag !== "Untagged" && !tagsList.includes(newTag)) {
      tagsList.push(newTag);
    }

    await this.db.sql`
      UPDATE contacts
      SET tags = ${JSON.stringify(tagsList)}::jsonb, updated_at = NOW()
      WHERE id = ${contactId}
    `;

    return { success: true, tags: tagsList };
  }

  async getTags(orgId: string): Promise<string[]> {
    const effectiveOrg = orgId || "org-demo";
    const rows = await this.db.sql`
      SELECT DISTINCT jsonb_array_elements_text(tags) as tag
      FROM contacts
      WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;
    const defaultPipeline = ["Lead", "Interested", "Customer", "Lost"];
    const dbTags = rows.map((r) => r.tag).filter(Boolean);
    const combined = Array.from(new Set([...defaultPipeline, ...dbTags]));
    return combined;
  }

  async bulkUpsertContacts(
    orgId: string,
    shopId: string,
    contactsList: Array<{ phone: string; name?: string; city?: string; dob?: string; tags?: string[]; metadata?: Record<string, any> }>,
    createAudienceName?: string
  ) {
    if (!Array.isArray(contactsList) || contactsList.length === 0) {
      return { success: true, count: 0 };
    }

    let insertedCount = 0;
    const contactIds: string[] = [];
    const effectiveOrg = orgId || "org-demo";

    for (const c of contactsList) {
      const normalized = this.normalizePhone(c.phone);
      if (!normalized) continue;

      const id = "cnt_" + crypto.createHash("md5").update(effectiveOrg + ":" + normalized).digest("hex").slice(0, 16);
      const name = c.name?.trim() || "Customer";
      const city = c.city?.trim() || null;
      const dob = c.dob?.trim() || null;
      const tags = Array.isArray(c.tags) ? c.tags.map(t => t.trim()).filter(Boolean) : [];
      const meta = c.metadata ? JSON.stringify(c.metadata) : null;

      try {
        await this.db.sql`
          INSERT INTO contacts (id, organization_id, shop_id, phone, name, city, dob, tags, metadata, created_at, updated_at)
          VALUES (${id}, ${effectiveOrg}, ${shopId || 'main-outlet'}, ${normalized}, ${name}, ${city}, ${dob}, ${JSON.stringify(tags)}::jsonb, ${meta}, NOW(), NOW())
          ON CONFLICT (organization_id, phone) DO UPDATE SET
            name = EXCLUDED.name,
            city = COALESCE(EXCLUDED.city, contacts.city),
            dob = COALESCE(EXCLUDED.dob, contacts.dob),
            tags = (
              SELECT jsonb_agg(DISTINCT elem)
              FROM jsonb_array_elements_text(COALESCE(contacts.tags, '[]'::jsonb) || EXCLUDED.tags) AS elem
            ),
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `;
        insertedCount++;
        contactIds.push(id);
      } catch (err: any) {
        this.logger.warn(`Failed to upsert contact ${normalized}: ${err.message}`);
      }
    }

    let audienceId: string | undefined;
    if (createAudienceName && createAudienceName.trim() && contactIds.length > 0) {
      try {
        audienceId = "aud_" + Date.now().toString(36);
        await this.db.sql`
          INSERT INTO audience_segments (id, organization_id, name, description, type, contact_count, created_at, updated_at)
          VALUES (${audienceId}, ${effectiveOrg}, ${createAudienceName.trim()}, 'Imported from Contacts Studio', 'CUSTOM', ${contactIds.length}, NOW(), NOW())
        `;

        for (const cId of contactIds) {
          await this.db.sql`
            INSERT INTO audience_members (audience_id, contact_id, added_at)
            VALUES (${audienceId}, ${cId}, NOW())
            ON CONFLICT DO NOTHING
          `;
        }
      } catch (audErr: any) {
        this.logger.warn(`Failed to create audience list: ${audErr.message}`);
      }
    }

    return {
      success: true,
      count: insertedCount,
      audienceId,
    };
  }
}
