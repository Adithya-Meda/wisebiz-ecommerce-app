'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });

const { pool } = require('./pool');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('order-svc:migrate');

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS orders (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(30)  NOT NULL UNIQUE,
    user_id         UUID         NOT NULL,
    user_email      VARCHAR(255) NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
    subtotal        NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'INR',
    shipping_address JSONB       NOT NULL,
    billing_address  JSONB,
    notes           TEXT,
    payment_id      UUID,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      VARCHAR(100) NOT NULL,
    product_name    VARCHAR(300) NOT NULL,
    product_image   VARCHAR(500),
    variant         JSONB,
    unit_price      NUMERIC(12,2) NOT NULL,
    quantity        INTEGER       NOT NULL CHECK (quantity > 0),
    line_total      NUMERIC(12,2) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30)  NOT NULL,
    changed_by      VARCHAR(100),
    note            TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_number     ON orders(order_number);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
  CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Running order-svc migrations...');
    await client.query(SCHEMA);
    logger.info('Migrations completed');
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error('Fatal migration error', { error: err.message });
  process.exit(1);
});
