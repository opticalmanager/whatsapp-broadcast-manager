import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";

export const welcomeMessageSettings = pgTable(
  "welcome_message_settings",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    instanceId: varchar("instance_id", { length: 255 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    frequency: varchar("frequency", { length: 32 }).notNull().default("FIRST_TIME_EVER"),
    minDelaySec: integer("min_delay_sec").notNull().default(3),
    maxDelaySec: integer("max_delay_sec").notNull().default(8),
    excludeFriendlyNumbers: boolean("exclude_friendly_numbers").notNull().default(true),
    responses: jsonb("responses").notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgInstIdx: index("idx_welcome_settings_org_inst").on(table.organizationId, table.instanceId),
  })
);

export const welcomeMessageLogs = pgTable(
  "welcome_message_logs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    instanceId: varchar("instance_id", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    name: varchar("name", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("DELIVERED"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgPhoneIdx: index("idx_welcome_logs_org_phone").on(table.organizationId, table.phone),
  })
);
