import * as fs from "fs";
import * as path from "path";

// Load .env file natively without external dependencies
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valParts] = trimmed.split("=");
        let val = valParts.join("=").trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        const cleanKey = key.trim();
        if (!process.env[cleanKey]) {
          process.env[cleanKey] = val;
        }
      }
    });
  }
} catch (e) {
  console.error("Failed to read .env file:", e);
}

process.on("unhandledRejection", (reason: any) => {
  console.warn("[Process Guard] Intercepted unhandled rejection:", reason?.message || reason);
});

process.on("uncaughtException", (err: any) => {
  console.warn("[Process Guard] Intercepted uncaught exception:", err?.message || err);
});

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("BroadcastBackend");
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server, mobile, curl or undefined origin
      if (!origin) return callback(null, true);

      const allowedPatterns = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
        /^https?:\/\/([a-z0-9-]+\.)?opticalmanager\.in$/,
      ];

      const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));
      if (isAllowed || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With", "Origin"],
    exposedHeaders: ["Authorization"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  app.setGlobalPrefix("api/v1");

  // Increase payload limit for media uploads and serve static files
  const express = require("express");
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  const port = process.env.PORT || 4000;

  try {
    await app.listen(port);
    logger.log(`OpticalManager Broadcast Backend API running on port ${port}`);
  } catch (err: any) {
    if (err?.code === "EADDRINUSE" || String(err).includes("EADDRINUSE")) {
      logger.warn(`Port ${port} is occupied. Automatically freeing port and restarting listener...`);
      try {
        const { execSync } = require("child_process");
        if (process.platform === "win32") {
          const out = execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`).toString().trim();
          if (out) {
            const pids = out.split(/\r?\n/).map((p: string) => p.trim()).filter(Boolean);
            for (const pid of pids) {
              if (pid && pid !== "0" && pid !== String(process.pid)) {
                try { process.kill(Number(pid)); } catch {
                  try { execSync(`taskkill /F /PID ${pid} 2>nul`); } catch {}
                }
              }
            }
          }
        } else {
          try { execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`); } catch {}
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 600));
      await app.listen(port);
      logger.log(`OpticalManager Broadcast Backend API running on port ${port} (post port-free)`);
    } else {
      throw err;
    }
  }
}

bootstrap();
