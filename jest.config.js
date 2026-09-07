'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Find tests in any __tests__ folder or *.test.js file within services/
  testMatch: ['**/tests/**/*.test.js'],

  // Set a shared .env before each test suite so services can boot
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',

  // Coverage — collect from service source files only (not migrations, seeds, scripts)
  collectCoverageFrom: [
    'services/*/src/**/*.js',
    'shared/**/*.js',
    '!services/*/src/db/migrate.js',
    '!services/*/src/db/seed.js',
    '!**/node_modules/**',
  ],

  coverageThreshold: {
    global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  },

  // Longer timeout for async DB/HTTP flows in integration-style tests
  testTimeout: 15000,

  // Clear all mocks between tests
  clearMocks: true,
  restoreMocks: true,
};
