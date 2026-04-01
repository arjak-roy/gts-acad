import { spawnSync } from "node:child_process";

import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const [envVarName, ...prismaArgs] = process.argv.slice(2);

if (!envVarName || prismaArgs.length === 0) {
  console.error("Usage: node scripts/prisma-env.mjs <ENV_VAR_NAME> <prisma args...>");
  process.exit(1);
}

const databaseUrl = process.env[envVarName];

if (!databaseUrl) {
  console.error(`Environment variable ${envVarName} is not set.`);
  process.exit(1);
}

const command = process.platform === "win32" ? "cmd.exe" : "npx";
const commandArgs = process.platform === "win32" ? ["/c", "npx", "prisma", ...prismaArgs] : ["prisma", ...prismaArgs];

const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PRISMA_PRESERVE_ENV_KEYS: "DATABASE_URL",
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);