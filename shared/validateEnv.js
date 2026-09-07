'use strict';

/**
 * Validates that all required environment variables are set before a service starts.
 * Exits the process with a clear error message if any are missing in production.
 * In development, logs a warning so the developer can still run partial setups.
 *
 * Usage:
 *   const { validateEnv } = require('../../../shared/validateEnv');
 *   validateEnv(['JWT_ACCESS_SECRET', 'POSTGRES_PASSWORD', 'COOKIE_SECRET']);
 *
 * @param {string[]} required - Array of required env var names
 */
function validateEnv(required) {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length === 0) return;

  const message = `Missing required environment variables: ${missing.join(', ')}`;

  if (process.env.NODE_ENV === 'production') {
    // Hard fail in production — a misconfigured service must not start
    console.error(`[FATAL] ${message}`); // eslint-disable-line no-console
    process.exit(1);
  } else {
    // Soft warn in development to allow partial local setups
    console.warn(`[WARN]  ${message} — set these before deploying to production`); // eslint-disable-line no-console
  }
}

module.exports = { validateEnv };
