import { pgTable, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const broadcastTemplates = pgTable(
  "broadcast_templates",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    shopId: varchar("shop_id", { length: 64 }),
    title: varchar("title", { length: 255 }).notNull(),
    bodyText: text("body_text").notNull(),
    category: varchar("category", { length: 64 }).default("GENERAL"),
    mediaType: varchar("media_type", { length: 32 }).notNull().default("NONE"),
    mediaUrl: text("media_url"),
    buttonText: varchar("button_text", { length: 128 }),
    buttonUrl: text("button_url"),
    icon: varchar("icon", { length: 64 }).default("MessageSquare"),
    variables: jsonb("variables").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_templates_org").on(table.organizationId),
  })
);

