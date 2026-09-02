import { pgTable, text, timestamp, varchar, integer, jsonb, index } from "drizzle-orm/pg-core";

export const audienceSegments = pgTable(
  "audience_segments",
  {
    id: text("id").primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    contactCount: integer("contact_count").notNull().default(0),
    filterCriteria: jsonb("filter_criteria").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_audiences_org").on(table.organizationId),
  })
);

export const audienceMembers = pgTable(
  "audience_members",
  {
    id: text("id").primaryKey(),
    audienceId: text("audience_id").notNull(),
    contactId: text("contact_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    audContactIdx: index("idx_aud_members_aud_contact").on(table.audienceId, table.contactId),
  })
);
