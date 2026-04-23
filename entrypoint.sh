#!/bin/sh
set -e

# --- GTS Academy Container Startup ---
# Migrations are controlled by:
#   RUN_MIGRATIONS=true  - Enable automatic migrations on startup
#   MIGRATION_MODE=push  - Use db push (dev/uat, syncs schema)
#   MIGRATION_MODE=deploy - Use migrate deploy (production, applies migration files)
#
# Auto-detection: If MIGRATION_MODE is not set, defaults based on NODE_ENV

echo "Starting GTS Academy App (Port: ${PORT:-3000})..."
echo "Environment: ${NODE_ENV:-development}"

# Auto-detect migration mode based on environment
if [ -z "$MIGRATION_MODE" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    MIGRATION_MODE="deploy"
  else
    MIGRATION_MODE="push"
  fi
fi

echo "Migration mode: $MIGRATION_MODE"

# Run migrations if enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Checking database connectivity..."

  # Wait for DB to be reachable first
  MAX_RETRIES=30
  RETRY_COUNT=0
  until node -e "
const net = require('net');
const url = new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://'));
const socket = new net.Socket();
socket.setTimeout(2000);
socket.on('connect', () => process.exit(0));
socket.on('error', () => process.exit(1));
socket.connect(url.port || 5432, url.hostname);
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "ERROR: Database not reachable after $MAX_RETRIES attempts"
      exit 1
    fi
    echo "Waiting for DB connectivity ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 2
  done

  echo "Database reachable. Running migrations..."

  if [ "$MIGRATION_MODE" = "push" ]; then
    # DEV/UAT: Use db push to sync schema
    echo "Using db push (development mode)..."
    node ./node_modules/prisma/build/index.js db push --skip-generate || {
      echo "WARNING: db push failed, trying with --accept-data-loss for dev..."
      if [ "$NODE_ENV" = "production" ]; then
        echo "ERROR: Cannot use --accept-data-loss in production!"
        exit 1
      fi
      node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss
    }
  else
    # PRODUCTION: Use migrate deploy (requires migration files)
    echo "Using migrate deploy (production mode)..."
    node ./node_modules/prisma/build/index.js migrate deploy
  fi

  echo "Migrations complete."

  # Optional: Run essential seeding
  if [ "$RUN_SEED" = "true" ]; then
    echo "Running essential seed data..."
    node prisma/seed.mjs --essential
  fi
fi

# Start the application
exec "$@"
