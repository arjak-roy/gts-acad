# GTS Academy App

GTS Academy App is a Next.js 14 admin portal for academy operations.
It covers dashboard insights, learner management, attendance operations,
readiness scoring, and recruiter sync workflows.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- TanStack Query + TanStack Table

## Project Structure

- `app/` Route handlers, pages, server actions
- `components/` Layout, module UI, and reusable UI primitives
- `services/` Business/data access layer (DB + fallback behavior)
- `lib/` Utilities, Prisma client, validation schemas, mock data
- `prisma/` Prisma schema and migration context
- `hooks/` Client hooks for mutations and UI state

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file from `.env.example`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/gts_academy?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5435/gts_academy_test?schema=public"
```

### 3. Generate Prisma client

```bash
npm run prisma:generate
```

### 4. Start development server

```bash
npm run dev
```

## Database Setup With Docker (PostgreSQL)

Docker Compose files are included for both local development and isolated test runs.

Make sure Docker Desktop, or another running Docker daemon, is available before using the compose scripts.

### Development database

Start Postgres:

```bash
npm run db:up
```

Stop it:

```bash
npm run db:down
```

View logs:

```bash
npm run db:logs
```

### Test database

Start the isolated test Postgres instance on port `5435`:

```bash
npm run db:test:up
```

Stop it:

```bash
npm run db:test:down
```

View logs:

```bash
npm run db:test:logs
```

### Initialize schema

After Postgres is up and `DATABASE_URL` is set:

```bash
npm run prisma:generate
npm run prisma:push
npm run db:seed
```

For migration-based flow:

```bash
npm run prisma:migrate
```

For the test database:

```bash
npm run db:test:push
npm run db:test:seed
```

If you already have an existing database and need the auth/session tables added without a full push, run:

```bash
npm run db:sync:auth
npm run db:seed
```

That auth sync now applies the email 2FA, session registry, activation token, and login lockout schema changes.

For the test database:

```bash
npm run db:test:sync:auth
npm run db:test:seed
```

## Seed Data

The project includes an idempotent Prisma seed script at `prisma/seed.mjs`.

It creates:

- one admin user
- one trainer user and trainer profile
- two programs
- one batch per program
- three learners with enrollments
- attendance records
- assessments and scores
- readiness snapshots
- recruiter sync logs

Run it against the main database with:

```bash
npm run db:seed
```

## API Endpoints

These endpoints are available for other apps to consume:

- `GET /api/dashboard`
- `GET /api/learners`
- `GET /api/learners/:learnerCode`
- `POST /api/attendance`
- `POST /api/readiness/sync`

## Useful Scripts

- `npm run dev` Start dev server
- `npm run build` Create production build
- `npm run typecheck` Run TypeScript checks
- `npm run db:up` Start local Postgres via Docker Compose
- `npm run db:down` Stop local Postgres Compose stack
- `npm run db:seed` Seed the local database
- `npm run db:test:up` Start isolated test Postgres via Docker Compose
- `npm run db:test:push` Push Prisma schema to the test database
- `npm run db:test:seed` Seed the test database
- `npm run prisma:generate` Generate Prisma client
- `npm run prisma:push` Push schema to database
- `npm run prisma:migrate` Run migration workflow

## Vercel Deployment

This repo includes [vercel.json](vercel.json) with the production build command:

```bash
npm run prisma:generate && npm run build
```

If Vercel Project Settings already define a custom Build Command, that dashboard value overrides the repo config.

Use one of these options:

- clear the custom Build Command and let `vercel.json` apply
- set the custom Build Command to `npm run prisma:generate && npm run build`

Do not use `npm run prisma build npm run build`.
That makes npm look for a script named `prisma` and the deployment fails with `Missing script: "prisma"`.

## Notes

- If `DATABASE_URL` is not set, several services use mock fallback data.
- This allows UI development even when no database is running.


COmmands for running the gts academy admin nextjs app
docker build -t gts-academy-app .
docker run -p 3000:3000 -e DATABASE_URL="your_db_url" gts-academy-app
