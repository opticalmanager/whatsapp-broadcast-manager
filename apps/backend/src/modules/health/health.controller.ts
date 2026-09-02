import { Controller, Get } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { WhatsAppSessionManagerService } from "../whatsapp-session/whatsapp-session.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly sessionService: WhatsAppSessionManagerService
  ) {}

  @Get()
  async getHealth() {
    const startTime = Date.now();
    let dbStatus = "OK";
    let dbLatencyMs = 0;

    try {
      const ping = await this.db.sql`SELECT 1 as ping`;
      dbLatencyMs = Date.now() - startTime;
      dbStatus = ping && ping.length > 0 ? "CONNECTED" : "UNRESPONSIVE";
    } catch (err: any) {
      dbStatus = `ERROR: ${err.message}`;
    }

    const instances = await this.sessionService.getInstances("org-demo");
    const connectedCount = instances.filter((i) => i.status === "CONNECTED").length;

    return {
      status: dbStatus === "CONNECTED" ? "HEALTHY" : "DEGRADED",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        provider: "PostgreSQL (Supabase/Neon Pooler Safe)",
      },
      whatsapp: {
        totalInstances: instances.length,
        connectedInstances: connectedCount,
      },
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
    };
  }

  @Get("database")
  async getDbHealth() {
    const startTime = Date.now();
    try {
      const tables = await this.db.sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      return {
        status: "CONNECTED",
        latencyMs: Date.now() - startTime,
        tablesCount: tables.length,
        tables: tables.map((t: any) => t.table_name),
      };
    } catch (err: any) {
      return {
        status: "ERROR",
        error: err.message,
      };
    }
  }
}
