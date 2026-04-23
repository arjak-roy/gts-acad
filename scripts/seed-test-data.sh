#!/bin/bash
# Seed mock test data (test users, training centres, learners, etc.) — DEV ONLY
# This script enforces development environment only
# Usage: ./scripts/seed-test-data.sh
# Requires: NODE_ENV=development, DATABASE_URL environment variable

set -e

if [ "$NODE_ENV" != "development" ] && [ "$NODE_ENV" != "dev" ]; then
  echo "ERROR: Test data seeding is restricted to development environments only."
  echo "   Current NODE_ENV: ${NODE_ENV}"
  echo "   Allowed environments: development, dev"
  exit 1
fi

echo "Seeding test data (dev environment only)..."
echo "Environment: $NODE_ENV"
echo ""

node prisma/seed.mjs --force

echo ""
echo "Test data seed complete."
