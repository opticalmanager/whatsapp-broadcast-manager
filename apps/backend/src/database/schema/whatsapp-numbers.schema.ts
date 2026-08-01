import { pgTable, uuid, varchar, text, timestamp, boolean, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const whatsappConnectionStatusEnum = pgEnum("whatsapp_connection_status", [
  "UNLINKED",
  "GENERATING_QR",
  "CONNECTED",
  "RECONNECTING",
  "LOGGED_OUT",
]);

export const whatsappNumbers = pgTable(
  "whatsapp_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    shopId: uuid("shop_id").notNull(),
    phoneNumber: varchar("phone_number", { length: 30 }),
    displayName: varchar("display_name", { length: 255 }),
    status: whatsappConnectionStatusEnum("status").notNull().default("UNLINKED"),
    sessionDataRef: text("session_data_ref"),
    qrCodeBase64: text("qr_code_base64"),
    batteryLevel: integer("battery_level"),
    warmupTier: integer("warmup_tier").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgShopIdx: index("idx_wa_numbers_org_shop").on(table.organizationId, table.shopId),
  })
);
