#!/usr/bin/env node
'use strict';

/**
 * migrate-all.js
 *
 * Runs all PostgreSQL migrations in dependency order:
 *   1. auth-svc    (users, refresh_tokens, password_reset_tokens)
 *   2. user-svc    (profiles, addresses, wishlists — FK on auth user id)
 *   3. order-svc   (orders, order_items, order_status_history)
 *   4. payment-svc (payment_intents, refunds)
 *
 * Usage:
 *   node scripts/migrate-all.js
 *
 * The script loads .env from the project root before each migration so
 * every migrate.js gets the correct DB credentials without a separate
 * environment setup step.
 *
 * Exit codes:
 *   0 — all migrations succeeded
 *   1 — one or more migrations failed (details logged to stderr)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { spawnSync } = require('child_process');
const path = require('path');

const MIGRATIONS = [
  { name: 'auth-svc',     script: 'services/auth-svc/src/db/migrate.js'     },
  { name: 'user-svc',     script: 'services/user-svc/src/db/migrate.js'     },
  { name: 'order-svc',    script: 'services/order-svc/src/db/migrate.js'    },
  { name: 'payment-svc',  script: 'services/payment-svc/src/db/migrate.js'  },
];

const ROOT = path.resolve(__dirname, '..');
const failed = [];

console.log('='.repeat(60));
console.log(' WiseBiz — Running all database migrations');
console.log('='.repeat(60));

for (const { name, script } of MIGRATIONS) {
  const scriptPath = path.join(ROOT, script);
  process.stdout.write(`\n▶  ${name.padEnd(16)} ... `);

  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'pipe',
    env: { ...process.env },
  });

  if (result.status === 0) {
    process.stdout.write('✓ done\n');
  } else {
    process.stdout.write('✗ FAILED\n');
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    if (stdout) { console.error(`   stdout: ${stdout}`); }
    if (stderr) { console.error(`   stderr: ${stderr}`); }
    failed.push(name);
  }
}

console.log('\n' + '='.repeat(60));

if (failed.length === 0) {
  console.log(' All migrations completed successfully.');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.error(` ${failed.length} migration(s) failed: ${failed.join(', ')}`);
  console.log('='.repeat(60));
  process.exit(1);
}
