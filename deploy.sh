#!/usr/bin/env bash
set -Eeuo pipefail

echo "🚀 Deploying Goalana production..."

echo "🌿 Switching to production branch..."
git fetch origin
git checkout production
git pull --ff-only origin production

echo "📦 Installing dependencies..."
bun install --frozen-lockfile

echo "🗄️ Running Prisma production migrations..."
bun run db:deploy

echo "⚙️ Generating Prisma Client..."
bun run db:generate

echo "♻️ Reloading Goalana API..."
pm2 reload goalana-api --update-env

echo "⏳ Waiting for API to start..."
sleep 5

echo "🩹 Reconciling in-progress fixtures..."
(cd apps/api && bun run src/scripts/reconcile-scores.ts)

echo "🔎 Verifying Nginx config..."
sudo nginx -t
sudo systemctl reload nginx

echo "🏥 Health check..."
curl --fail https://goalana-api.smnthjm08.dev/health

echo "💾 Saving PM2 process list..."
pm2 save

echo "📊 PM2 status..."
pm2 status

echo "✅ Goalana production deployment complete!"

# cd apps/api

# dry run — just prints on-chain/db status, changes nothing
# bun run src/scripts/sync-france-england-markets.ts

# writes — but this will be a safe no-op right now
# bun run src/scripts/sync-france-england-markets.ts --execute  
