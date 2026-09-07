'use strict';

/**
 * Shared logger factory.
 *
 * Output format is controlled by LOG_FORMAT:
 *   LOG_FORMAT=json  → structured JSON (default in production, required by log aggregators)
 *   LOG_FORMAT=text  → human-readable text (default in development)
 *
 * LOG_LEVEL controls verbosity: error | warn | info | debug  (default: info)
 *
 * Usage:
 *   const { createLogger } = require('../../../shared/logger');
 *   const logger = createLogger('auth-svc');
 *   logger.info('User registered', { userId: '...' });
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

// Use JSON in production OR when explicitly requested; fall back to text otherwise
const useJson =
  process.env.LOG_FORMAT === 'json' ||
  (process.env.NODE_ENV === 'production' && process.env.LOG_FORMAT !== 'text');

/**
 * Build a JSON log entry — one object per line, ready for CloudWatch / Loki / Datadog.
 */
function formatJson(level, service, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
  };
  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    // Flatten meta fields directly onto the log entry for easy querying
    Object.assign(entry, meta);
  }
  return JSON.stringify(entry);
}

/**
 * Build a human-readable log line for local development.
 */
function formatText(level, service, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${service}] ${message}`;
  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function format(level, service, message, meta) {
  return useJson
    ? formatJson(level, service, message, meta)
    : formatText(level, service, message, meta);
}

function createLogger(service) {
  return {
    error: (msg, meta) => {
      if (currentLevel >= LOG_LEVELS.error) {
        console.error(format('error', service, msg, meta)); // eslint-disable-line no-console
      }
    },
    warn: (msg, meta) => {
      if (currentLevel >= LOG_LEVELS.warn) {
        console.warn(format('warn', service, msg, meta)); // eslint-disable-line no-console
      }
    },
    info: (msg, meta) => {
      if (currentLevel >= LOG_LEVELS.info) {
        console.info(format('info', service, msg, meta)); // eslint-disable-line no-console
      }
    },
    debug: (msg, meta) => {
      if (currentLevel >= LOG_LEVELS.debug) {
        console.debug(format('debug', service, msg, meta)); // eslint-disable-line no-console
      }
    },
  };
}

module.exports = { createLogger };
