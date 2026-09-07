'use strict';

/**
 * Jest globalSetup — runs once before the entire test suite.
 *
 * Injects the minimal environment variables that services require to boot
 * without a real .env file, so tests work in CI with no filesystem side-effects.
 */
module.exports = async function globalSetup() {
  // Node environment
  process.env.NODE_ENV = 'test';

  // Logger — use text format in tests for readable output
  process.env.LOG_FORMAT = 'text';
  process.env.LOG_LEVEL  = 'error'; // suppress info/debug noise during tests

  // JWT secrets (32-char minimum; these are test-only values)
  process.env.JWT_ACCESS_SECRET  = 'test-access-secret-that-is-at-least-64-chars-long-xxxxxxxxxxx';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-64-chars-long-xxxxxxxxxx';
  process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  // Cookie / session secrets
  process.env.COOKIE_SECRET   = 'test-cookie-secret-32-chars-xxxxx';
  process.env.INTERNAL_SECRET = 'test-internal-secret-32-chars-xxx';

  // PostgreSQL — values not used because pool.query is always mocked in unit tests
  process.env.POSTGRES_HOST     = 'localhost';
  process.env.POSTGRES_PORT     = '5432';
  process.env.POSTGRES_USER     = 'wisebiz';
  process.env.POSTGRES_PASSWORD = 'test-password';
  process.env.AUTH_DB_NAME      = 'wisebiz_auth_test';
  process.env.USER_DB_NAME      = 'wisebiz_users_test';
  process.env.ORDER_DB_NAME     = 'wisebiz_orders_test';
  process.env.PAYMENT_DB_NAME   = 'wisebiz_payments_test';

  // Service URLs
  process.env.CART_SVC_URL    = 'http://localhost:3004';
  process.env.PRODUCT_SVC_URL = 'http://localhost:3003';
  process.env.ORDER_SVC_URL   = 'http://localhost:3005';
  process.env.USER_SVC_URL    = 'http://localhost:3002';

  // App
  process.env.APP_URL  = 'http://localhost:8080';
  process.env.APP_NAME = 'WiseBiz';

  // Storage
  process.env.UPLOAD_STORAGE  = 'local';
  process.env.UPLOAD_DIR      = '/tmp/wisebiz-test-uploads';
  process.env.MAX_FILE_SIZE_MB = '5';
};
