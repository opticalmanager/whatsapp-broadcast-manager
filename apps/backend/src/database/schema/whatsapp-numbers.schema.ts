import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";

export const whatsappSessions = pgTable(
  "whatsapp_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 30 }),
    displayName: varchar("display_name", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("DISCONNECTED"),
    authDirKey: varchar("auth_dir_key", { length: 500 }).notNull(),
    batteryLevel: integer("battery_level").default(100),
    isPlugged: boolean("is_plugged").default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    instanceName: varchar("instance_name", { length: 255 }).default("Main Outlet"),
    qrCache: text("qr_cache"),
    notes: text("notes"),
    authCredsJson: text("auth_creds_json"),
    keysBackup: jsonb("keys_backup"),
  },
  (table) => ({
    orgIdx: index("idx_wa_sessions_org").on(table.organizationId),
  })
);

export const whatsappNumbers = whatsappSessions;

