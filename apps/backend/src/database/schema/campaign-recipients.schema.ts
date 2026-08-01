import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.schema";

export const recipientStatusEnum = pgEnum("recipient_status", [
  "PENDING",
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "SKIPPED",
]);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    crmCustomerId: uuid("crm_customer_id"),
    recipientPhone: varchar("recipient_phone", { length: 30 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    variablePayload: jsonb("variable_payload").default({}),
    status: recipientStatusEnum("status").notNull().default("PENDING"),
    messageId: varchar("message_id", { length: 255 }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignStatusIdx: index("idx_recipients_campaign_status").on(table.campaignId, table.status),
    phoneIdx: index("idx_recipients_phone").on(table.recipientPhone),
  })
);
