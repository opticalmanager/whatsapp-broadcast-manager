#!/bin/bash
set -e

echo "========================================================"
echo "🚀 1. Syncing codebase with GitHub (origin/main)..."
echo "========================================================"
git fetch origin main
git reset --hard origin/main

echo "========================================================"
echo "📦 2. Ensuring all workspace dependencies are installed..."
echo "========================================================"
npm install

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
pm2 delete all || true
pm2 start ecosystem.config.js --update-env
pm2 save

echo "========================================================"
echo "✅ Deployment Successful! Current PM2 Process Status:"
echo "========================================================"
pm2 status
