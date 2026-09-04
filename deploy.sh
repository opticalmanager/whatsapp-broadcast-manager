#!/bin/bash
set -e

echo "========================================================"
echo "🚀 1. Syncing codebase with GitHub (origin/main)..."
echo "========================================================"
git fetch origin main
git reset --hard origin/main

# Enable Swap on low-RAM EC2 if not present
if [ -f /proc/swaps ] && [ $(wc -l < /proc/swaps) -le 1 ]; then
  echo "⚙️ Setting up 2GB swap for smooth EC2 builds..."
  sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null || true
  sudo chmod 600 /swapfile 2>/dev/null || true
  sudo mkswap /swapfile 2>/dev/null || true
  sudo swapon /swapfile 2>/dev/null || true
fi

# Set Node memory limit for fast builds on EC2
export NODE_OPTIONS="--max-old-space-size=2048"

echo "========================================================"
echo "📦 2. Checking workspace dependencies..."
echo "========================================================"
# Only run npm install if node_modules is missing or package.json was changed
if [ ! -d "node_modules" ] || [ ! -d "apps/backend/node_modules" ] || [ ! -d "apps/frontend/node_modules" ] || [ "$1" == "--install" ] || [ "$1" == "-i" ]; then
  echo "📦 Installing missing dependencies (fast offline mode)..."
  npm install --prefer-offline --no-audit --no-fund --progress=false
else
  echo "⚡ Dependencies already present. Skipping npm install for instant deployment!"
fi

echo "========================================================"
echo "🔨 3. Compiling NestJS Backend..."
echo "========================================================"
npm run build:backend

echo "========================================================"
echo "⚡ 4. Compiling Next.js Frontend..."
echo "========================================================"
npm run build:frontend

echo "========================================================"
echo "🔄 5. Reloading PM2 production processes..."
echo "========================================================"
pm2 start ecosystem.config.js --update-env || pm2 restart all
pm2 save

echo "========================================================"
echo "✅ Deployment Successful! Current PM2 Process Status:"
echo "========================================================"
pm2 status

