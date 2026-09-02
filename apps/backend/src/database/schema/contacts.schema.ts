import { pgTable, text, timestamp, varchar, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    shopId: varchar("shop_id", { length: 64 }),
    phone: varchar("phone", { length: 30 }).notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 100 }),
    dob: varchar("dob", { length: 50 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgPhoneIdx: uniqueIndex("idx_contacts_org_phone").on(table.organizationId, table.phone),
    orgIdx: index("idx_contacts_org").on(table.organizationId),
  })
);
