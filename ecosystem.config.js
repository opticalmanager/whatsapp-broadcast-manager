module.exports = {
  apps: [
    {
      name: "broadcast-backend",
      cwd: "./apps/backend",
      script: "dist/src/main.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        AUTH_STORAGE_DIR: "/var/data/whatsapp_sessions",
      },
    },
    {
      name: "broadcast-frontend",
      cwd: "./apps/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
