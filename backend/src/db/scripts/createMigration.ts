/**
 * Migration Generator Script
 * Creates a new migration file with timestamp and boilerplate
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  const migrationsDir = path.join(__dirname, "../migrations");

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Get existing migrations to determine next version
  const existingMigrations = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.match(/^\d{3}_.*\.sql$/) && !f.endsWith("_rollback.sql"))
    .sort();

  const nextVersion =
    existingMigrations.length > 0
      ? parseInt(existingMigrations[existingMigrations.length - 1].substring(0, 3)) + 1
      : 1;

  // Get migration name from user
  const name = await question("Migration name (e.g., add_user_roles): ");

  if (!name || !name.match(/^[a-z_]+$/)) {
    console.error("❌ Invalid migration name. Use lowercase letters and underscores only.");
    process.exit(1);
  }

  const versionStr = String(nextVersion).padStart(3, "0");
  const filename = `${versionStr}_${name}.sql`;
  const rollbackFilename = `${versionStr}_${name}_rollback.sql`;

  const migrationPath = path.join(migrationsDir, filename);
  const rollbackPath = path.join(migrationsDir, rollbackFilename);

  // Create migration file
  const migrationTemplate = `-- Migration: ${name}
-- Version: ${nextVersion}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

`;

  const rollbackTemplate = `-- Rollback: ${name}
-- Version: ${nextVersion}

-- Add your rollback SQL here

`;

  fs.writeFileSync(migrationPath, migrationTemplate);
  fs.writeFileSync(rollbackPath, rollbackTemplate);

  console.log(`✅ Created migration files:`);
  console.log(`   ${filename}`);
  console.log(`   ${rollbackFilename}`);
  console.log(`\nEdit these files and run: npm run migrate`);

  rl.close();
}

main().catch((err) => {
  console.error("❌ Failed to create migration:", err);
  process.exit(1);
});
