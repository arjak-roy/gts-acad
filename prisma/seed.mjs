import { PrismaClient } from "@prisma/client";
import settingsCatalog from "../lib/settings/settings-catalog.json" with { type: "json" };

import { loadLocalEnv } from "../scripts/load-local-env.mjs";
import { cleanMockData } from "./seeds/clean.mjs";
import { seedEssentialData } from "./seeds/essential.mjs";
import { seedMockData } from "./seeds/mock.mjs";

loadLocalEnv({ preserveKeys: (process.env.PRISMA_PRESERVE_ENV_KEYS ?? "").split(",").filter(Boolean) });

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI orchestrator 
// ---------------------------------------------------------------------------
// --essential   Seed only system data (roles, permissions, settings, admin, geo).
//               Safe for production.
// --force       Wipe mock data then re-seed everything. Blocked in production.
// (default)     Seed essential + mock data. Mock data blocked in production.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isEssentialOnly = args.includes("--essential");
const isForce = args.includes("--force");
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && isForce) {
  console.error("ERROR: --force is not allowed when NODE_ENV=production");
  process.exit(1);
}

if (isProduction && !isEssentialOnly) {
  console.error("ERROR: Mock data seeding is blocked in production. Use --essential for system data only.");
  process.exit(1);
}

(async () => {
  try {
    if (isForce) {
      console.log("Force mode: cleaning mock data...");
      await cleanMockData(prisma);
    }

    console.log("Seeding essential data...");
    const essentialData = await seedEssentialData(prisma, settingsCatalog);

    if (!isEssentialOnly) {
      console.log("Seeding mock data...");
      await seedMockData(prisma, essentialData);
    }

    console.log("Seed finished successfully.");
  } catch (error) {
    console.error("Seed failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
