FROM node:24-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package*.json ./
RUN npm ci --ignore-scripts

FROM base AS builder

# Prisma generate needs a datasource value even though the build does not connect to a database.
ENV DATABASE_URL="postgresql://neondb_owner:npg_oWQ9BrUbi5ds@ep-lingering-unit-aj1y79lu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npm run prisma:generate

COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD ["server.js"]
