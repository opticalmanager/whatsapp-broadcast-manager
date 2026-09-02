import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import * as postgresModule from "postgres";

const getPostgresClient = () => {
  if (typeof postgresModule === "function") return postgresModule;
  if ((postgresModule as any).default && typeof (postgresModule as any).default === "function") {
    return (postgresModule as any).default;
  }
  try {
    const req = require("postgres");
    if (typeof req === "function") return req;
    if (req.default && typeof req.default === "function") return req.default;
  } catch {}
  return postgresModule as any;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  public sql!: any;

  constructor() {
    this.init();
  }

  private init() {
    if (this.sql) return;
    const dbUrl =
      process.env.DATABASE_URL ||
      "postgresql://postgres.mouybojqnhvhuzcdwxuz:Broadcaste%40manager2026@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

    const isLocalhost =
      dbUrl.includes("localhost") ||
      dbUrl.includes("127.0.0.1") ||
      dbUrl.includes("::1");
    const forceSsl = process.env.DATABASE_SSL === "true";
    const disableSsl = process.env.DATABASE_SSL === "false";
    const sslOption = disableSsl
      ? false
      : forceSsl || !isLocalhost
      ? "require"
      : false;

    const isPooler =
      dbUrl.includes(":6543") ||
      dbUrl.includes("pooler") ||
      process.env.DATABASE_PREPARE === "false";

    const postgresFactory = getPostgresClient();

    this.sql = postgresFactory(dbUrl, {
      ssl: sslOption,
      max: parseInt(process.env.DB_POOL_MAX || "10", 10),
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: !isPooler, // Disable prepared statements when using PgBouncer/Supabase transaction pooler
    });
  }

  async onModuleInit() {
    this.init();
    setImmediate(async () => {
      try {
        const ping = await this.sql`SELECT 1 as connected`;
        if (ping && ping.length > 0) {
          this.logger.log("Connected to PostgreSQL database with pooler resilience.");
          await this.initDatabaseSchema();
        }
      } catch (err: any) {
        this.logger.warn(`Database connection initialized with warning: ${err.message}`);
      }
    });
  }


  /**
   * Automatically ensures all required tables and indexes exist on boot.
   * Safe and idempotent across both localhost and production databases.
   */
  public async initDatabaseSchema() {
    try {
      // 1. WhatsApp Sessions Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          phone_number VARCHAR(30),
          display_name VARCHAR(255),
          status VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED',
          auth_dir_key VARCHAR(500) NOT NULL,
          battery_level INTEGER DEFAULT 100,
          is_plugged BOOLEAN DEFAULT true,
          connected_at TIMESTAMPTZ,
          last_active_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          instance_name VARCHAR(255) DEFAULT 'Main Outlet',
          qr_cache TEXT,
          notes TEXT,
          auth_creds_json TEXT,
          keys_backup JSONB,
          account_maturity_type VARCHAR(32) NOT NULL DEFAULT 'MATURED',
          warmup_started_at TIMESTAMPTZ DEFAULT NOW(),
          daily_sent_count INTEGER DEFAULT 0,
          last_sent_date VARCHAR(10) DEFAULT ''
        );
      `;
      // Safe Column Migrations for existing deployments
      await this.sql`ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS account_maturity_type VARCHAR(32) NOT NULL DEFAULT 'MATURED';`.catch(() => {});
      await this.sql`ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ DEFAULT NOW();`.catch(() => {});
      await this.sql`ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS daily_sent_count INTEGER DEFAULT 0;`.catch(() => {});
      await this.sql`ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS last_sent_date VARCHAR(10) DEFAULT '';`.catch(() => {});

      // 2. Users Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.users (
          id TEXT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          organization_id VARCHAR(64) NOT NULL,
          shop_id VARCHAR(64),
          role VARCHAR(32) NOT NULL DEFAULT 'OWNER',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 3. Contacts Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.contacts (
          id TEXT PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          shop_id VARCHAR(64),
          phone VARCHAR(30) NOT NULL,
          name VARCHAR(255),
          email VARCHAR(255),
          city VARCHAR(100),
          tags JSONB DEFAULT '[]'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 4. Audience Segments & Members Tables
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.audience_segments (
          id TEXT PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          contact_count INTEGER NOT NULL DEFAULT 0,
          filter_criteria JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS public.audience_members (
          id TEXT PRIMARY KEY,
          audience_id TEXT NOT NULL,
          contact_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 5. Campaigns Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.campaigns (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          whatsapp_session_id VARCHAR(255),
          name VARCHAR(255) NOT NULL,
          target_audience_type VARCHAR(50) NOT NULL DEFAULT 'ALL',
          audience_segment_id VARCHAR(255),
          message_text TEXT NOT NULL,
          media_url TEXT,
          status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
          scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          delivered_count INTEGER DEFAULT 0,
          read_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          content_type VARCHAR(32),
          poll_question TEXT,
          poll_options JSONB,
          action_buttons JSONB,
          menu_data JSONB,
          poll_data JSONB
        );
      `;

      // 6. Campaign Recipients Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.campaign_recipients (
          id VARCHAR(255) PRIMARY KEY,
          campaign_id VARCHAR(255) NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
          organization_id VARCHAR(64) NOT NULL,
          contact_id VARCHAR(255),
          phone VARCHAR(30) NOT NULL,
          name VARCHAR(255),
          message_id VARCHAR(255),
          status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          poll_vote TEXT,
          poll_voted_at TIMESTAMPTZ,
          reply_text TEXT,
          replied_at TIMESTAMPTZ,
          button_clicked TEXT,
          button_clicked_at TIMESTAMPTZ
        );
      `;

      // 7. Auto-Reply Rules & Settings Tables
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.auto_reply_rules (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          instance_id VARCHAR(255),
          match_type VARCHAR(32) NOT NULL DEFAULT 'Contains',
          keyword TEXT NOT NULL,
          responses JSONB NOT NULL DEFAULT '[]'::jsonb,
          enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS public.auto_reply_settings (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          instance_id VARCHAR(255) NOT NULL,
          bot_engine_enabled BOOLEAN NOT NULL DEFAULT true,
          min_delay_sec INTEGER NOT NULL DEFAULT 2,
          max_delay_sec INTEGER NOT NULL DEFAULT 6,
          friendly_numbers JSONB DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 8. Welcome Message Settings & Logs Tables
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.welcome_message_settings (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          instance_id VARCHAR(255) NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT false,
          frequency VARCHAR(32) NOT NULL DEFAULT 'FIRST_TIME_EVER',
          min_delay_sec INTEGER NOT NULL DEFAULT 3,
          max_delay_sec INTEGER NOT NULL DEFAULT 8,
          exclude_friendly_numbers BOOLEAN NOT NULL DEFAULT true,
          responses JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS public.welcome_message_logs (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          instance_id VARCHAR(255) NOT NULL,
          phone VARCHAR(30) NOT NULL,
          name VARCHAR(255),
          status VARCHAR(32) NOT NULL DEFAULT 'DELIVERED',
          sent_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 9. Broadcast Templates Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.broadcast_templates (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          shop_id VARCHAR(64),
          title VARCHAR(255) NOT NULL,
          body_text TEXT NOT NULL,
          media_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
          media_url TEXT,
          variables JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 10. Broadcast Global Settings Table
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.broadcast_settings (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL UNIQUE,
          switch_account_after INTEGER NOT NULL DEFAULT 1,
          send_parallel_instances BOOLEAN NOT NULL DEFAULT true,
          min_delay_sec INTEGER NOT NULL DEFAULT 15,
          max_delay_sec INTEGER NOT NULL DEFAULT 20,
          sleep_enabled BOOLEAN NOT NULL DEFAULT true,
          sleep_after_messages INTEGER NOT NULL DEFAULT 25,
          sleep_for_seconds INTEGER NOT NULL DEFAULT 10,
          default_country_code VARCHAR(10) NOT NULL DEFAULT '91',
          default_country_name VARCHAR(50) NOT NULL DEFAULT 'India',
          default_language VARCHAR(50) NOT NULL DEFAULT 'English',
          warmup_week1_limit INTEGER NOT NULL DEFAULT 50,
          warmup_week2_limit INTEGER NOT NULL DEFAULT 150,
          warmup_week3_limit INTEGER NOT NULL DEFAULT 300,
          warmup_week4_limit INTEGER NOT NULL DEFAULT 500,
          delivery_window_enabled BOOLEAN NOT NULL DEFAULT true,
          delivery_window_start VARCHAR(10) NOT NULL DEFAULT '10:00',
          delivery_window_end VARCHAR(10) NOT NULL DEFAULT '19:00',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      // Safe Column Migrations for broadcast_settings
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS warmup_week1_limit INTEGER NOT NULL DEFAULT 50;`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS warmup_week2_limit INTEGER NOT NULL DEFAULT 150;`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS warmup_week3_limit INTEGER NOT NULL DEFAULT 300;`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS warmup_week4_limit INTEGER NOT NULL DEFAULT 500;`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS delivery_window_enabled BOOLEAN NOT NULL DEFAULT true;`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS delivery_window_start VARCHAR(10) NOT NULL DEFAULT '10:00';`.catch(() => {});
      await this.sql`ALTER TABLE public.broadcast_settings ADD COLUMN IF NOT EXISTS delivery_window_end VARCHAR(10) NOT NULL DEFAULT '19:00';`.catch(() => {});

      // 11. Unsubscriber Settings & Unsubscribers Tables
      await this.sql`
        CREATE TABLE IF NOT EXISTS public.unsubscriber_settings (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL UNIQUE,
          enabled BOOLEAN NOT NULL DEFAULT true,
          optout_text TEXT NOT NULL DEFAULT 'Reply STOP to unsubscribe from promotional messages.',
          trigger_keywords TEXT NOT NULL DEFAULT 'STOP,UNSUBSCRIBE,OPTOUT',
          auto_reply_confirmation BOOLEAN NOT NULL DEFAULT true,
          confirmation_message TEXT NOT NULL DEFAULT 'You have been successfully unsubscribed. You will no longer receive promotional broadcasts from us.',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS public.unsubscribers (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(64) NOT NULL,
          phone VARCHAR(30) NOT NULL,
          name VARCHAR(255),
          reason TEXT,
          trigger_keyword VARCHAR(100) DEFAULT 'STOP',
          instance_id VARCHAR(255),
          source VARCHAR(64) DEFAULT 'AUTO_KEYWORD',
          unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_org_phone_unsub UNIQUE (organization_id, phone)
        );
      `;

      // 12. Performance Indexes
      await this.sql`CREATE INDEX IF NOT EXISTS idx_broadcast_settings_org ON public.broadcast_settings (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_unsub_settings_org ON public.unsubscriber_settings (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_unsubscribers_org ON public.unsubscribers (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_unsubscribers_phone ON public.unsubscribers (phone);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_wa_sessions_org ON public.whatsapp_sessions (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_users_org ON public.users (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts (organization_id);`;
      await this.sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone ON public.contacts (organization_id, phone);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_audiences_org ON public.audience_segments (organization_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns (organization_id);`;
      await this.sql`ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS quoted_message_id VARCHAR(255);`.catch(() => {});
      await this.sql`ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS quoted_content TEXT;`.catch(() => {});
      await this.sql`ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS quoted_sender VARCHAR(255);`.catch(() => {});
      await this.sql`CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_created ON public.chat_messages (conversation_id, created_at DESC);`.catch(() => {});
      await this.sql`CREATE INDEX IF NOT EXISTS idx_chat_msg_phone_created ON public.chat_messages (phone, created_at DESC);`.catch(() => {});
      await this.sql`CREATE INDEX IF NOT EXISTS idx_chat_conv_org_updated ON public.chat_conversations (organization_id, last_message_at DESC);`.catch(() => {});
      // 13. Self-Healing Data Cleanup for Production Accuracy
      await this.sql`
        UPDATE public.campaign_recipients
        SET 
          reply_text = NULL,
          replied_at = NULL,
          poll_vote = NULL,
          poll_voted_at = NULL,
          button_clicked = NULL,
          button_clicked_at = NULL,
          read_at = NULL,
          status = CASE WHEN delivered_at IS NOT NULL THEN 'DELIVERED' ELSE 'SENT' END
        WHERE read_at IS NOT NULL 
          AND sent_at IS NOT NULL 
          AND read_at < sent_at - INTERVAL '30 seconds';
      `.catch(() => {});

      await this.sql`
        DELETE FROM public.unsubscribers 
        WHERE LENGTH(REGEXP_REPLACE(phone, '\\D', '', 'g')) > 13;
      `.catch(() => {});

      await this.sql`
        DELETE FROM public.chat_messages 
        WHERE id LIKE 'cmp_msg_%' OR sender_name = 'Broadcast';
      `.catch(() => {});
      await this.sql`CREATE INDEX IF NOT EXISTS idx_welcome_settings_org_inst ON public.welcome_message_settings (organization_id, instance_id);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_welcome_logs_org_phone ON public.welcome_message_logs (organization_id, phone);`;
      await this.sql`CREATE INDEX IF NOT EXISTS idx_templates_org ON public.broadcast_templates (organization_id);`;

      this.logger.log("Database schema & performance indexes verified successfully.");
    } catch (migErr: any) {
      this.logger.warn(`Schema initialization warning: ${migErr.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.sql) {
      await this.sql.end();
    }
  }
}

