'use strict';

const { Pool } = require('pg');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('order-svc:db');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'wisebiz',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.ORDER_DB_NAME || 'wisebiz_orders',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
