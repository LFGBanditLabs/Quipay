/**
 * Script to create a new migration file
 * Usage: npm run migrate:create -- "migration_name"
 */

import fs from "fs";
import path from "path";

const migrationsDir = path.join(__dirname, "..", "migrations");

function getNextVersion(): number {
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return 1;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.includes("_rollback"))
    .sort();

  if (files.length === 0) {
    return 1;
  }

  const lastFile = files[files.length - 1];
  const match = lastFile.match(/^(\d+)_/);

  if (!match) {
    return 1;
  }

  return parseInt(match[1], 10) + 1;
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createMigrationTemplate(version: number, name: string): string {
  const today = new Date().toISOString().split("T")[0];

  return `-- Migration: ${String(version).padStart(3, "0")}_${name}
-- Description: [Add description here]
-- Created: ${today}

-- Add your migration SQL here
-- Example:
-- ALTER TABLE table_name ADD COLUMN column_name TYPE;
-- CREATE INDEX idx_name ON table_name(column_name);

-- Remember to create a corresponding rollback file if needed:
-- ${String(version).padStart(3, "0")}_${name}_rollback.sql
`;
}

function createRollbackTemplate(version: number, name: string): string {
  const today = new Date().toISOString().split("T")[0];

  return `-- Rollback: ${String(version).padStart(3, "0")}_${name}
-- Description: Rollback for ${name}
-- Created: ${today}

-- Add your rollback SQL here
-- Example:
-- DROP INDEX IF EXISTS idx_name;
-- ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
`;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ Error: Migration name is required");
    console.log('\nUsage: npm run migrate:create -- "migration_name"');
    console.log('Example: npm run migrate:create -- "add_user_email_column"');
    process.exit(1);
  }

  const rawName = args.join("_");
  const name = sanitizeName(rawName);

  if (!name) {
    console.error("❌ Error: Invalid migration name");
    process.exit(1);
  }

  const version = getNextVersion();
  const versionStr = String(version).padStart(3, "0");

  const migrationFilename = `${versionStr}_${name}.sql`;
  const rollbackFilename = `${versionStr}_${name}_rollback.sql`;

  const migrationPath = path.join(migrationsDir, migrationFilename);
  const rollbackPath = path.join(migrationsDir, rollbackFilename);

  // Create migration file
  fs.writeFileSync(migrationPath, createMigrationTemplate(version, name));
  console.log(`✅ Created migration: ${migrationFilename}`);

  // Create rollback file
  fs.writeFileSync(rollbackPath, createRollbackTemplate(version, name));
  console.log(`✅ Created rollback: ${rollbackFilename}`);

  console.log(`\n📝 Edit the files at:`);
  console.log(`   ${migrationPath}`);
  console.log(`   ${rollbackPath}`);
  console.log(`\n🚀 Run migration with: npm run migrate`);
}

main();
