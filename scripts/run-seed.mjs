import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const [databaseUrlOrEnvVar] = process.argv.slice(2);

if (!databaseUrlOrEnvVar) {
  console.error("Usage: node scripts/run-seed.mjs <DATABASE_URL|ENV_VAR_NAME>");
  process.exit(1);
}

const databaseUrl = databaseUrlOrEnvVar.includes("://") ? databaseUrlOrEnvVar : process.env[databaseUrlOrEnvVar];

if (!databaseUrl) {
  console.error(`Could not resolve a database URL from ${databaseUrlOrEnvVar}.`);
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;
process.env.PRISMA_PRESERVE_ENV_KEYS = "DATABASE_URL";

await import("../prisma/seed.mjs");