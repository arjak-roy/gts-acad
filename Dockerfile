# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl-dev

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npm run prisma:generate

# Copy the rest of the application
COPY . .

# Ensure public directory exists
RUN mkdir -p public

# Build the Next.js application with no sourcemaps
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Clean up builder artifacts
RUN rm -rf .next/cache .next/static/chunks .git

# Remove all Prisma engines from builder
RUN rm -rf node_modules/.prisma node_modules/@prisma/engines || true

# Runtime stage — distroless Node.js (~50MB vs ~160MB for node:alpine)
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy .next standalone build (includes all dependencies)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# nonroot user (uid 65532) is the default for this image
EXPOSE 3000

CMD ["server.js"]
