#!/usr/bin/env node

/**
 * Script to apply manual migrations to the database
 * 
 * Usage:
 *   npm run apply-migrations
 *   or
 *   node scripts/apply-migrations.mjs
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const migrationsDir = path.join(process.cwd(), "prisma", "manual-migrations");
const appliedMigrationsFile = path.join(process.cwd(), ".prisma-applied-migrations.json");

// Load previously applied migrations
let appliedMigrations = [];
if (fs.existsSync(appliedMigrationsFile)) {
  appliedMigrations = JSON.parse(fs.readFileSync(appliedMigrationsFile, "utf-8"));
}

// Get all migration files, sorted by name
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

console.log(`Found ${migrationFiles.length} SQL migration files\n`);

let appliedCount = 0;
for (const file of migrationFiles) {
  if (appliedMigrations.includes(file)) {
    console.log(`✓ ${file} (already applied)`);
    continue;
  }

  const filePath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filePath, "utf-8");

  console.log(`Applying: ${file}...`);

  try {
    // Use Prisma's db execute command
    const result = execSync(
      `echo ${Buffer.from(sql).toString("base64")} | base64 -d | npx prisma db execute --stdin --schema prisma/schema.prisma`,
      { encoding: "utf-8", stdio: "pipe" }
    );

    console.log(`✓ ${file} applied successfully\n`);
    appliedMigrations.push(file);
    appliedCount += 1;
  } catch (error) {
    console.error(`✗ Failed to apply ${file}:`);
    console.error(error.message);
    console.error(
      "\nNote: You can manually apply this migration with:\n" +
        `  Get-Content prisma/manual-migrations/${file} | npx prisma db execute --stdin --schema prisma/schema.prisma\n`
    );
  }
}

// Save applied migrations
fs.writeFileSync(appliedMigrationsFile, JSON.stringify(appliedMigrations, null, 2));

console.log(`\n✓ Migration complete! Applied ${appliedCount} new migration(s)`);
if (appliedCount > 0) {
  console.log("Run: npm run dev");
  console.log("to restart your development server.");
}
