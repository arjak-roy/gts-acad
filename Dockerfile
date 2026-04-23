FROM node:24-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package*.json ./
RUN npm ci --ignore-scripts

FROM base AS builder

# Build-time values used by prisma generate / next build.
# Pass real values with --build-arg in CI/CD when needed.
ARG DATABASE_URL="postgresql://neondb_owner:npg_oWQ9BrUbi5ds@ep-lingering-unit-aj1y79lu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
ARG NEXT_PUBLIC_APP_URL="https://dev-academy-candidate.globaltalentsquare.com/"
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
ENV DATABASE_URL="postgresql://neondb_owner:npg_oWQ9BrUbi5ds@ep-lingering-unit-aj1y79lu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
ARG NEXT_PUBLIC_APP_URL="https://dev-academy-candidate.globaltalentsquare.com/"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV AUTH_SESSION_SECRET="replace-with-a-long-random-secret"
ENV SETTINGS_ENCRYPTION_SECRET=""
ENV INTERNAL_APP_ORIGIN="https://dev-academy-admin.globaltalentsquare.com"
ENV AUTH_PASSWORD_RESET_URL_BASE="https://dev-academy-admin.globaltalentsquare.com"
ENV MAIL_HOST="smtp.zeptomail.in"
ENV MAIL_PORT="587"
ENV MAIL_USERNAME="emailapikey"
ENV MAIL_PASSWORD="PHtE6r0OFOy/jGMq8hIB7PG8H8KkNIMo/7tjf1ZFuYpKCqILTU1T+tgjxGO2/xsjAfNCF/6bwY08ub3Jt++MJGrpYT1EVWqyqK3sx/VYSPOZsbq6x00csVoZd0bfUYTnetJj1CfRuN7cNA=="
ENV MAIL_FROM_ADDRESS="noreply@2coms.com"
ENV MAIL_FROM_NAME="${APP_NAME}"
ENV ADMIN_MAIL="resumes@2coms.zohorecruitmail.in"

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
