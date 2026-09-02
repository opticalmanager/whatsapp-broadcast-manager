import { pgTable, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.schema";

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    campaignId: varchar("campaign_id", { length: 255 })
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    contactId: varchar("contact_id", { length: 255 }),
    phone: varchar("phone", { length: 30 }).notNull(),
    name: varchar("name", { length: 255 }),
    messageId: varchar("message_id", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    pollVote: text("poll_vote"),
    pollVotedAt: timestamp("poll_voted_at", { withTimezone: true }),
    replyText: text("reply_text"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    buttonClicked: text("button_clicked"),
    buttonClickedAt: timestamp("button_clicked_at", { withTimezone: true }),
  },
  (table) => ({
    campaignIdx: index("idx_recipients_campaign").on(table.campaignId),
    msgIdIdx: index("idx_recipients_msg_id").on(table.messageId),
    phoneIdx: index("idx_recipients_phone").on(table.phone),
  })
);

