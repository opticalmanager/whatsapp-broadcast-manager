import { pgTable, uuid, varchar, timestamp, integer, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { whatsappNumbers } from "./whatsapp-numbers.schema";
import { broadcastTemplates } from "./templates.schema";

export const campaignExecutionStatusEnum = pgEnum("campaign_execution_status", [
  "DRAFT",
  "SCHEDULED",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    shopId: uuid("shop_id").notNull(),
    whatsappNumberId: uuid("whatsapp_number_id")
      .notNull()
      .references(() => whatsappNumbers.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => broadcastTemplates.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    targetAudienceType: varchar("target_audience_type", { length: 50 }).notNull(),
    audienceFilterPayload: jsonb("audience_filter_payload"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    status: campaignExecutionStatusEnum("status").notNull().default("DRAFT"),

    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),

    minDelaySeconds: integer("min_delay_seconds").notNull().default(8),
    maxDelaySeconds: integer("max_delay_seconds").notNull().default(20),
    batchSize: integer("batch_size").notNull().default(50),
    batchPauseMinutes: integer("batch_pause_minutes").notNull().default(10),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgShopIdx: index("idx_campaigns_org_shop").on(table.organizationId, table.shopId),
    statusIdx: index("idx_campaigns_status").on(table.status),
  })
);
