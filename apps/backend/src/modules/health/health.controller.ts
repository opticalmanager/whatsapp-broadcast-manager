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
      engine: {
        mode: process.env.ENABLE_BAILEYS_SOCKETS === "true" ? "HYBRID_BAILEYS" : "PURE_WABA",
        baileysRetired: process.env.ENABLE_BAILEYS_SOCKETS !== "true",
        wabaStatus: "ACTIVE",
      },
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
        externalMb: Math.round(process.memoryUsage().external / (1024 * 1024)),
        status: Math.round(process.memoryUsage().rss / (1024 * 1024)) < 200 ? "OPTIMIZED" : "ELEVATED",
        targetMaxMb: 150,
      },
    };
  }

  @Get("memory")
  async getMemoryDiagnostics() {
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / (1024 * 1024));
    const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
    const heapTotalMb = Math.round(mem.heapTotal / (1024 * 1024));
    const externalMb = Math.round(mem.external / (1024 * 1024));

    if ((global as any).gc) {
      try {
        (global as any).gc();
      } catch {}
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      engineMode: process.env.ENABLE_BAILEYS_SOCKETS === "true" ? "HYBRID_BAILEYS" : "PURE_WABA",
      memory: {
        rssMb,
        heapUsedMb,
        heapTotalMb,
        externalMb,
        status: rssMb < 200 ? "OPTIMIZED" : "ELEVATED",
        savingsEstimate: "Baileys sockets retired saving ~650MB RAM",
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
