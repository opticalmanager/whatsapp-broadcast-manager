import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";

export const autoReplyRules = pgTable(
  "auto_reply_rules",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    instanceId: varchar("instance_id", { length: 255 }),
    matchType: varchar("match_type", { length: 32 }).notNull().default("Contains"),
    keyword: text("keyword").notNull(),
    responses: jsonb("responses").notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgEnabledIdx: index("idx_auto_reply_rules_org").on(table.organizationId, table.enabled),
  })
);

export const autoReplySettings = pgTable(
  "auto_reply_settings",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    instanceId: varchar("instance_id", { length: 255 }).notNull(),
    botEngineEnabled: boolean("bot_engine_enabled").notNull().default(true),
    minDelaySec: integer("min_delay_sec").notNull().default(2),
    maxDelaySec: integer("max_delay_sec").notNull().default(6),
    friendlyNumbers: jsonb("friendly_numbers").default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgInstIdx: index("idx_auto_reply_settings_org_inst").on(table.organizationId, table.instanceId),
  })
);
