FROM node:24-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package*.json ./
RUN npm ci --ignore-scripts

FROM base AS builder

# Build-time values used by prisma generate / next build.
# Pass real values with --build-arg in CI/CD when needed.
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gts_academy?schema=public"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV CI=1

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npm run prisma:generate

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=""
ENV AUTH_SESSION_SECRET=""
ENV SETTINGS_ENCRYPTION_SECRET=""
ENV INTERNAL_APP_ORIGIN=""
ENV AUTH_PASSWORD_RESET_URL_BASE=""
ENV MAIL_HOST=""
ENV MAIL_PORT=""
ENV MAIL_USERNAME=""
ENV MAIL_PASSWORD=""
ENV MAIL_FROM_ADDRESS=""
ENV MAIL_FROM_NAME=""
ENV ADMIN_MAIL=""

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy Prisma schema and seed for entrypoint migrations/seeding
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib/settings/settings-catalog.json ./lib/settings/settings-catalog.json
COPY --from=builder /app/scripts/load-local-env.mjs ./scripts/load-local-env.mjs

# Copy and setup entrypoint script
COPY --chmod=755 entrypoint.sh ./entrypoint.sh

# Set correct permissions for Next.js cache
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
