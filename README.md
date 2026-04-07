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

For a real app instance, set these values explicitly instead of relying on defaults:

- `DATABASE_URL`
- `AUTH_SESSION_SECRET`
- `SETTINGS_ENCRYPTION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_APP_ORIGIN`
- `AUTH_PASSWORD_RESET_URL_BASE`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_FROM_ADDRESS`

### 3. Generate Prisma client

```bash
npm run prisma:generate
```

### 4. Initialize the database

After `DATABASE_URL` is set and your Postgres instance already exists:

```bash
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

If you already have an existing database and need the authored lesson course-content fields added without a full push, run:

```bash
npm run db:sync:authored-content
```

For the test database:

```bash
npm run db:test:sync:authored-content
```

For the test database:

```bash
npm run db:test:sync:auth
npm run db:test:seed
```

### 5. Start development server

```bash
npm run dev
```

## Docker

The Dockerfile builds only the Next.js application. It does not start Postgres or any other dependency, so point the container at an existing database with `DATABASE_URL`.

Build the image:

```bash
docker build -t gts-academy-app .
```

Run the container with your environment file:

```bash
docker run --rm -p 3000:3000 --env-file .env gts-academy-app
```

These runtime environment variables should be present for a production-style container:

- `DATABASE_URL`
- `AUTH_SESSION_SECRET`
- `SETTINGS_ENCRYPTION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_APP_ORIGIN`
- `AUTH_PASSWORD_RESET_URL_BASE`

Mail and notification flows also need:

- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_FROM_ADDRESS`
- `MAIL_FROM_NAME`
- `ADMIN_MAIL`

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
- `npm run db:seed` Seed the local database
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
