#!/bin/bash
# Seed essential system data only (roles, permissions, settings, admin user, geo)
# Safe and idempotent for all environments
# Usage: ./scripts/seed-essential.sh
# Requires: DATABASE_URL environment variable

set -e

echo "Seeding essential system data..."
echo "Environment: ${NODE_ENV:-development}"
echo ""

node prisma/seed.mjs --essential

echo ""
echo "Essential seed complete."
