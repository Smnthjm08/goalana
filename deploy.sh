#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying Goalana production..."

echo "🌿 Switching to production branch..."
git checkout production

echo "⬇️ Pulling latest production code..."
git pull --ff-only origin production

echo "📦 Installing dependencies..."
bun install --frozen-lockfile

echo "🗄️ Running Prisma production migrations..."
bun run db:deploy

echo "♻️ Reloading Goalana API..."
pm2 reload goalana-api --update-env

echo "💾 Saving PM2 process list..."
pm2 save

echo "📊 PM2 status..."
pm2 status

echo "✅ Goalana production deployment complete!"