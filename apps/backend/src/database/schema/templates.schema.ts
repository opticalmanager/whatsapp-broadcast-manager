import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";

export const mediaTypeEnum = pgEnum("media_type", [
  "NONE",
  "IMAGE",
  "DOCUMENT",
  "VIDEO",
]);

export const broadcastTemplates = pgTable(
  "broadcast_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    shopId: uuid("shop_id"),
    title: varchar("title", { length: 255 }).notNull(),
    bodyText: text("body_text").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull().default("NONE"),
    mediaUrl: text("media_url"),
    variables: jsonb("variables").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_templates_org").on(table.organizationId),
  })
);
