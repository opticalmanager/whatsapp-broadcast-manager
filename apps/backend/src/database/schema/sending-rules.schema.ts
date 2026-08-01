import { pgTable, uuid, timestamp, integer, boolean, time } from "drizzle-orm/pg-core";

export const sendingRules = pgTable("sending_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  shopId: uuid("shop_id").notNull().unique(),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(10),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(25),
  simulateTyping: boolean("simulate_typing").notNull().default(true),
  typingDurationSeconds: integer("typing_duration_seconds").notNull().default(3),
  batchPauseAfterMessages: integer("batch_pause_after_messages").notNull().default(40),
  batchPauseDurationMinutes: integer("batch_pause_duration_minutes").notNull().default(15),
  dailyMaxMessages: integer("daily_max_messages").notNull().default(500),
  businessHoursStart: time("business_hours_start").notNull().default("09:00:00"),
  businessHoursEnd: time("business_hours_end").notNull().default("20:00:00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
