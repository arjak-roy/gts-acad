import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { loadLocalEnv } from "./scripts/load-local-env.mjs";

loadEnvConfig(process.cwd());
loadLocalEnv({ preserveKeys: (process.env.PRISMA_PRESERVE_ENV_KEYS ?? "").split(",").filter(Boolean) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  seed: "node prisma/seed.mjs",
});