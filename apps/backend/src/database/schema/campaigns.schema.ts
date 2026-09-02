import { pgTable, varchar, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const campaigns = pgTable(
  "campaigns",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    whatsappSessionId: varchar("whatsapp_session_id", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    targetAudienceType: varchar("target_audience_type", { length: 50 }).notNull().default("ALL"),
    audienceSegmentId: varchar("audience_segment_id", { length: 255 }),
    messageText: text("message_text").notNull(),
    mediaUrl: text("media_url"),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),

    totalRecipients: integer("total_recipients").default(0),
    sentCount: integer("sent_count").default(0),
    deliveredCount: integer("delivered_count").default(0),
    readCount: integer("read_count").default(0),
    failedCount: integer("failed_count").default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),

    contentType: varchar("content_type", { length: 32 }),
    pollQuestion: text("poll_question"),
    pollOptions: jsonb("poll_options"),
    actionButtons: jsonb("action_buttons"),
    menuData: jsonb("menu_data"),
    pollData: jsonb("poll_data"),
  },
  (table) => ({
    orgIdx: index("idx_campaigns_org").on(table.organizationId),
    statusSchedIdx: index("idx_campaigns_status_sched").on(table.status, table.scheduledAt),
  })
);

