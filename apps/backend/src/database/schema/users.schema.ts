import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    shopId: varchar("shop_id", { length: 64 }),
    role: varchar("role", { length: 32 }).notNull().default("OWNER"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    orgIdx: index("idx_users_org").on(table.organizationId),
  })
);
