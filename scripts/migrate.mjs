#!/usr/bin/env node
/**
 * Runs Drizzle SQL migrations in order. Used in Docker before starting the server.
 * Usage: node scripts/migrate.mjs (expects DATABASE_URL and migrations in ./migrations)
 */
import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

if (!existsSync(migrationsDir)) {
  console.log('No migrations dir, skipping');
  process.exit(0);
}

const journalPath = join(migrationsDir, 'meta', '_journal.json');
if (!existsSync(journalPath)) {
  console.log('No journal, skipping');
  process.exit(0);
}

const sql = postgres(url, { max: 1 });
try {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  for (const entry of journal.entries) {
    const file = join(migrationsDir, entry.tag + '.sql');
    const content = readFileSync(file, 'utf8');
    await sql.unsafe(content);
    console.log('Ran migration:', entry.tag);
  }
  console.log('Migrations complete');
} finally {
  await sql.end();
}
