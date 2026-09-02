#!/bin/bash
# ===================================================================
# Zero-Downtime Deploy / Update Script
# ===================================================================
set -e

echo "=== 1. Pulling Latest Changes ==="
git pull origin main

echo "=== 2. Installing Dependencies ==="
npm install

echo "=== 3. Building Backend & Frontend ==="
cd apps/backend && npm run build && cd ../..
cd apps/frontend && npm run build && cd ../..

echo "=== 4. Reloading PM2 Cluster ==="
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save

echo "=== 5. Deployment Succeeded! ==="
pm2 status
