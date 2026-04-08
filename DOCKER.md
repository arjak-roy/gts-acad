# Docker — GTS Academy App

Production container guide for the GTS Academy Next.js application.

---

## Overview

The image is built with a **three-stage Dockerfile**:

| Stage | Base image | Purpose |
|-------|-----------|---------|
| `base` | `node:24-alpine` | Shared layer — sets `WORKDIR /app` and disables Next.js telemetry |
| `deps` | inherits `base` | Installs production dependencies via `npm ci` |
| `builder` | inherits `base` | Generates the Prisma client and runs `next build` (standalone output) |
| `runner` | `gcr.io/distroless/nodejs24-debian12:nonroot` | Minimal, non-root production runtime |

The final image ships only the Next.js standalone bundle, static assets, public folder, and the Prisma client binaries — resulting in a lean image (~66 MB).

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine ≥ 24
- A running PostgreSQL instance (local, Neon, Supabase, RDS, etc.)
- A populated `.env` file (see [Environment Variables](#environment-variables))

---

## Building the Image

```bash
docker build -t gts-academy-admin .
```

> The build does not require a live database connection. `DATABASE_URL` is injected only so that `prisma generate` can resolve the datasource schema during the builder stage.

---

## Running the Container

```bash
docker run -d \
  --name gts-academy-admin \
  -p 3000:3000 \
  --env-file .env \
  gts-academy-admin
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env` file (never commit secrets). All variables prefixed with `NEXT_PUBLIC_` are embedded at build time.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (production database) |
| `SESSION_SECRET` | Secret used to sign session tokens (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the application (e.g. `https://academy.example.com`) |

### Mail (SMTP)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port (default `587`) |
| `SMTP_USER` | SMTP login username |
| `SMTP_PASS` | SMTP login password |
| `SMTP_FROM` | Sender address (e.g. `GTS Academy <no-reply@example.com>`) |

### File Storage

| Variable | Description |
|----------|-------------|
| `UPLOAD_STORAGE` | `LOCAL_PUBLIC` or `S3` |
| `AWS_REGION` | AWS region (S3 only) |
| `AWS_ACCESS_KEY_ID` | AWS access key (S3 only) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (S3 only) |
| `AWS_S3_BUCKET` | S3 bucket name (S3 only) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | `production` | Node environment |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry (already set in image) |

---

## Database Setup (First Run)

After the container is running, apply the schema and seed data against your production database from your local machine:

```bash
# Push the Prisma schema
npm run prisma:push

# Run all manual migration scripts in order
npm run db:sync:auth
npm run db:sync:templates
npm run db:sync:settings
npm run db:sync:logs-actions
npm run db:sync:schedule
npm run db:sync:authored-content
npm run db:backfill:codes

# Seed reference data (optional)
npm run db:seed
```

---

## Image Internals

```
/app
├── server.js              # Next.js standalone entrypoint
├── .next/
│   └── static/            # Compiled JS/CSS chunks
├── public/                # Static public assets & branding
└── node_modules/
    ├── .prisma/           # Compiled Prisma query engine
    └── @prisma/           # Prisma client library
```

The container runs as the **nonroot** user provided by the distroless base — no shell is available inside the running container by design.

---

## CI / GitLab Pipeline

The repository includes a `.gitlab-ci.yml` that builds and pushes the image automatically. Ensure the following CI/CD variables are configured in your GitLab project:

- `CI_REGISTRY` / `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD` — container registry credentials
- All production environment variables listed above

---

## Useful Commands

```bash
# View running container logs
docker logs -f gts-academy-admin

# Inspect final image size
docker image inspect gts-academy-admin --format '{{.Size}}'

# Open a shell in the builder stage for debugging (builder uses Alpine)
docker build --target builder -t gts-academy-admin-debug .
docker run --rm -it gts-academy-admin-debug sh

# Remove the container and image
docker rm -f gts-academy-admin
docker rmi gts-academy-admin
```
