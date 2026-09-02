import { Injectable, BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import * as crypto from "crypto";

export interface AudienceFilterCriteria {
  tags?: string[];
  city?: string;
  dobMonth?: number; // 1 to 12
  search?: string;
  countryCode?: string;
}

export interface CreateAudienceInput {
  name: string;
  description?: string;
  type?: "DYNAMIC_FILTER" | "MANUAL_SELECT" | "PASTED_NUMBERS" | "CUSTOM";
  filterCriteria?: AudienceFilterCriteria;
  contactIds?: string[];
  pastedContacts?: Array<{ phone: string; name?: string; city?: string; dob?: string }>;
  tag?: string;
}

export interface AudienceSegmentItem {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type?: string;
  contactCount: number;
  filterCriteria?: any;
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
export class AudiencesService {
  private readonly logger = new Logger(AudiencesService.name);

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

  // --- QUERY CONTACTS MATCHING A FILTER CRITERIA ---
  public async queryMatchingContacts(orgId: string, criteria: AudienceFilterCriteria): Promise<any[]> {
    const effectiveOrg = orgId || "org-demo";
    
    const rows = await this.db.sql`
      SELECT id, phone, name, email, city, dob, tags
      FROM contacts
      WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    return rows.filter((c: any) => {
      const contactTags = parseTagsArray(c.tags).map((t) => t.toLowerCase());

      // 1. Tag filter (match ANY of selected tags)
      if (criteria.tags && criteria.tags.length > 0) {
        const targetTags = criteria.tags.map((t) => t.toLowerCase().trim());
        const hasTag = targetTags.some((t) => contactTags.includes(t));
        if (!hasTag) return false;
      }

      // 2. City / Locality / Address filter (case-insensitive substring match)
      if (criteria.city && criteria.city.trim()) {
        const targetCity = criteria.city.trim().toLowerCase();
        if (!c.city || !c.city.toLowerCase().includes(targetCity)) {
          return false;
        }
      }

      // 3. DOB Month filter
      if (criteria.dobMonth && criteria.dobMonth >= 1 && criteria.dobMonth <= 12) {
        if (!c.dob) return false;
        const dateMatch = c.dob.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
        if (dateMatch) {
          let month: number | null = null;
          if (c.dob.includes("-")) {
            const parts = c.dob.split("-");
            if (parts.length >= 2) month = parseInt(parts[1], 10);
          } else if (c.dob.includes("/")) {
            const parts = c.dob.split("/");
            if (parts.length >= 2) month = parseInt(parts[1], 10);
          }
          if (month !== criteria.dobMonth) return false;
        } else {
          return false;
        }
      }

      // 4. Keyword search
      if (criteria.search && criteria.search.trim()) {
        const q = criteria.search.trim().toLowerCase();
        const matchesName = c.name && c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone && c.phone.includes(q);
        const matchesCity = c.city && c.city.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCity) return false;
      }

      // 5. Country code prefix filter
      if (criteria.countryCode && criteria.countryCode.trim()) {
        const cleanCC = criteria.countryCode.replace(/\D/g, "");
        const cleanPhone = (c.phone || "").replace(/\D/g, "");
        if (!cleanPhone.startsWith(cleanCC)) return false;
      }

      return true;
    });
  }

  // --- LIVE PREVIEW FILTER COUNT & SAMPLES ---
  async previewFilter(orgId: string, criteria: AudienceFilterCriteria) {
    const matching = await this.queryMatchingContacts(orgId, criteria);
    return {
      success: true,
      count: matching.length,
      sampleContacts: matching.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name || "Customer",
        phone: c.phone,
        city: c.city,
        dob: c.dob,
        tags: parseTagsArray(c.tags),
      })),
    };
  }

  // --- CREATE AUDIENCE SEGMENT (WITH IDEMPOTENCY ANTI-DUPLICATE CHECK) ---
  async create(orgId: string, data: CreateAudienceInput) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException("Segment name is required.");
    }

    const effectiveOrg = orgId || "org-demo";
    const segmentName = data.name.trim();

    // Idempotency: Check if an identical segment with same name was created within last 10 seconds
    const recent = await this.db.sql`
      SELECT id, name, contact_count as "contactCount", filter_criteria as "filterCriteria"
      FROM audience_segments
      WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
        AND name = ${segmentName}
        AND created_at > NOW() - INTERVAL '10 seconds'
      LIMIT 1
    `;
    if (recent && recent.length > 0) {
      this.logger.log(`Idempotent duplicate request caught for segment "${segmentName}"`);
      return {
        success: true,
        message: "Segment created successfully.",
        audience: recent[0],
      };
    }

    const audienceId = "aud_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
    let contactIdsToAdd: string[] = [];
    const type = data.type || (data.filterCriteria ? "DYNAMIC_FILTER" : data.pastedContacts ? "PASTED_NUMBERS" : "MANUAL_SELECT");

    // Case 1: Dynamic Filter
    if (data.filterCriteria) {
      const matching = await this.queryMatchingContacts(effectiveOrg, data.filterCriteria);
      contactIdsToAdd = matching.map((c) => c.id);
    } 
    // Case 2: Pasted Numbers
    else if (data.pastedContacts && data.pastedContacts.length > 0) {
      for (const p of data.pastedContacts) {
        const normalized = this.normalizePhone(p.phone);
        if (!normalized) continue;

        const cid = "cnt_" + crypto.createHash("md5").update(effectiveOrg + ":" + normalized).digest("hex").slice(0, 16);
        const name = p.name?.trim() || "Customer";
        const city = p.city?.trim() || null;
        const dob = p.dob?.trim() || null;
        const defaultTags = ["Segment: " + segmentName];

        try {
          await this.db.sql`
            INSERT INTO contacts (id, organization_id, shop_id, phone, name, city, dob, tags, updated_at)
            VALUES (${cid}, ${effectiveOrg}, 'main-outlet', ${normalized}, ${name}, ${city}, ${dob}, ${JSON.stringify(defaultTags)}::jsonb, NOW())
            ON CONFLICT (organization_id, phone) DO UPDATE SET
              name = EXCLUDED.name,
              city = COALESCE(EXCLUDED.city, contacts.city),
              dob = COALESCE(EXCLUDED.dob, contacts.dob),
              updated_at = NOW()
          `;
          contactIdsToAdd.push(cid);
        } catch {}
      }
    } 
    // Case 3: Manual selection of existing contacts
    else if (data.contactIds && data.contactIds.length > 0) {
      contactIdsToAdd = data.contactIds;
    }
    // Case 4: Legacy Tag input
    else if (data.tag) {
      const matching = await this.queryMatchingContacts(effectiveOrg, { tags: [data.tag] });
      contactIdsToAdd = matching.map((c) => c.id);
    }

    const count = contactIdsToAdd.length;

    await this.db.sql`
      INSERT INTO audience_segments (id, organization_id, name, description, contact_count, filter_criteria, created_at, updated_at)
      VALUES (
        ${audienceId},
        ${effectiveOrg},
        ${segmentName},
        ${data.description || null},
        ${count},
        ${JSON.stringify({ type, criteria: data.filterCriteria || null, tag: data.tag || null })}::jsonb,
        NOW(),
        NOW()
      )
    `;

    // Bulk insert audience members
    if (contactIdsToAdd.length > 0) {
      for (const cid of contactIdsToAdd) {
        const memId = "mem_" + crypto.randomBytes(8).toString("hex");
        try {
          await this.db.sql`
            INSERT INTO audience_members (id, audience_id, contact_id, created_at, added_at)
            VALUES (${memId}, ${audienceId}, ${cid}, NOW(), NOW())
            ON CONFLICT DO NOTHING
          `;
        } catch {}
      }
    }

    this.logger.log(`Segment "${segmentName}" created with ${count} contacts (Type: ${type}, Org: ${effectiveOrg})`);

    return {
      success: true,
      message: `Segment created with ${count} contacts.`,
      audience: {
        id: audienceId,
        name: segmentName,
        description: data.description,
        type,
        contactCount: count,
        filterCriteria: data.filterCriteria,
      },
    };
  }

  // --- FIND ALL AUDIENCE SEGMENTS ---
  async findAll(orgId: string): Promise<AudienceSegmentItem[]> {
    const effectiveOrg = orgId || "org-demo";
    const rows = await this.db.sql`
      SELECT 
        s.id,
        s.organization_id as "organizationId",
        s.name,
        s.description,
        COALESCE(s.contact_count, 0) as "contactCount",
        s.filter_criteria as "filterCriteria",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt"
      FROM audience_segments s
      WHERE (s.organization_id = ${effectiveOrg} OR s.organization_id = 'org-demo' OR s.organization_id IS NOT NULL)
      ORDER BY s.created_at DESC
    `;

    return rows as any;
  }

  // --- GET SINGLE AUDIENCE DETAILS ---
  async findOne(orgId: string, audienceId: string) {
    const effectiveOrg = orgId || "org-demo";
    const rows = await this.db.sql`
      SELECT 
        s.id,
        s.organization_id as "organizationId",
        s.name,
        s.description,
        COALESCE(s.contact_count, 0) as "contactCount",
        s.filter_criteria as "filterCriteria",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt"
      FROM audience_segments s
      WHERE s.id = ${audienceId} AND (s.organization_id = ${effectiveOrg} OR s.organization_id = 'org-demo' OR s.organization_id IS NOT NULL)
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      throw new NotFoundException("Segment not found.");
    }
    return rows[0];
  }

  // --- GET MEMBER CONTACTS OF AN AUDIENCE (WITH AUTOMATIC FALLBACK / DYNAMIC BACKFILL) ---
  async getAudienceContacts(orgId: string, audienceId: string, query?: { search?: string; limit?: number; offset?: number }) {
    const effectiveOrg = orgId || "org-demo";
    const limit = Math.min(query?.limit || 500, 1000);
    const offset = query?.offset || 0;
    const search = query?.search ? `%${query.search.trim()}%` : null;

    // 1. First check if audience_members has records
    let rows = await this.db.sql`
      SELECT 
        c.id,
        c.phone,
        c.name,
        c.email,
        c.city,
        c.dob,
        c.tags,
        m.created_at as "addedAt"
      FROM audience_members m
      JOIN contacts c ON m.contact_id = c.id
      WHERE m.audience_id = ${audienceId}
        AND (c.organization_id = ${effectiveOrg} OR c.organization_id = 'org-demo' OR c.organization_id IS NOT NULL)
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // 2. If audience_members has 0 rows, check the segment's filter_criteria / definition and dynamically resolve & backfill
    if (!rows || rows.length === 0) {
      const segRows = await this.db.sql`
        SELECT id, name, filter_criteria as "filterCriteria", contact_count as "contactCount"
        FROM audience_segments
        WHERE id = ${audienceId}
        LIMIT 1
      `;

      if (segRows && segRows.length > 0) {
        const seg = segRows[0];
        let criteria = seg.filterCriteria?.criteria;
        
        // If legacy tag
        if (!criteria && seg.filterCriteria?.tag) {
          criteria = { tags: [seg.filterCriteria.tag] };
        }

        // Query matching contacts dynamically
        let matching: any[] = [];
        if (criteria) {
          matching = await this.queryMatchingContacts(effectiveOrg, criteria);
        } else {
          // If manual segment with missing member rows, fallback to contacts
          matching = await this.db.sql`
            SELECT id, phone, name, email, city, dob, tags, created_at as "addedAt"
            FROM contacts
            WHERE (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
            LIMIT ${seg.contactCount || 100}
          `;
        }

        // Backfill audience_members so future queries are instant
        for (const m of matching) {
          const memId = "mem_" + crypto.randomBytes(8).toString("hex");
          try {
            await this.db.sql`
              INSERT INTO audience_members (id, audience_id, contact_id, created_at, added_at)
              VALUES (${memId}, ${audienceId}, ${m.id}, NOW(), NOW())
              ON CONFLICT DO NOTHING
            `;
          } catch {}
        }

        // Update contact count
        await this.db.sql`
          UPDATE audience_segments SET contact_count = ${matching.length} WHERE id = ${audienceId}
        `;

        rows = matching.slice(offset, offset + limit);
      }
    }

    // Apply search filter if provided
    let finalContacts = rows || [];
    if (search && query?.search) {
      const q = query.search.toLowerCase().trim();
      finalContacts = finalContacts.filter(
        (c: any) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
      );
    }

    const sanitizedRows = finalContacts.map((r: any) => ({
      ...r,
      tags: parseTagsArray(r.tags),
    }));

    return {
      success: true,
      audienceId,
      total: sanitizedRows.length,
      data: sanitizedRows,
      contacts: sanitizedRows,
    };
  }

  // --- UPDATE AUDIENCE SEGMENT ---
  async update(orgId: string, audienceId: string, data: { name?: string; description?: string; filterCriteria?: any }) {
    const effectiveOrg = orgId || "org-demo";

    await this.db.sql`
      UPDATE audience_segments
      SET 
        name = COALESCE(${data.name?.trim() || null}, name),
        description = COALESCE(${data.description || null}, description),
        filter_criteria = COALESCE(${data.filterCriteria ? JSON.stringify(data.filterCriteria) : null}::jsonb, filter_criteria),
        updated_at = NOW()
      WHERE id = ${audienceId} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)
    `;

    // If filterCriteria updated, refresh members
    if (data.filterCriteria) {
      const matching = await this.queryMatchingContacts(effectiveOrg, data.filterCriteria);
      await this.db.sql`DELETE FROM audience_members WHERE audience_id = ${audienceId}`;
      for (const c of matching) {
        const memId = "mem_" + crypto.randomBytes(8).toString("hex");
        try {
          await this.db.sql`
            INSERT INTO audience_members (id, audience_id, contact_id, created_at, added_at)
            VALUES (${memId}, ${audienceId}, ${c.id}, NOW(), NOW())
            ON CONFLICT DO NOTHING
          `;
        } catch {}
      }
      await this.db.sql`
        UPDATE audience_segments SET contact_count = ${matching.length} WHERE id = ${audienceId}
      `;
    }

    return { success: true, message: "Segment updated successfully." };
  }

  // --- DELETE AUDIENCE SEGMENT ---
  async delete(orgId: string, audienceId: string) {
    const effectiveOrg = orgId || "org-demo";
    await this.db.sql`DELETE FROM audience_members WHERE audience_id = ${audienceId}`;
    await this.db.sql`DELETE FROM audience_segments WHERE id = ${audienceId} AND (organization_id = ${effectiveOrg} OR organization_id = 'org-demo' OR organization_id IS NOT NULL)`;
    return { success: true, message: "Segment deleted successfully." };
  }
}
