'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });

const { pool } = require('./pool');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('payment-svc:migrate');

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS payment_intents (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID         NOT NULL,
    user_id           UUID         NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    currency          VARCHAR(3)   NOT NULL DEFAULT 'INR',
    status            VARCHAR(30)  NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','processing','succeeded','failed','refunded','cancelled')),
    payment_method    VARCHAR(50)  NOT NULL,
    gateway_ref       VARCHAR(200),
    failure_reason    TEXT,
    metadata          JSONB,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID         NOT NULL REFERENCES payment_intents(id),
    amount            NUMERIC(12,2) NOT NULL,
    reason            TEXT,
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','succeeded','failed')),
    gateway_ref       VARCHAR(200),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id ON payment_intents(order_id);
  CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id  ON payment_intents(user_id);
  CREATE INDEX IF NOT EXISTS idx_payment_intents_status   ON payment_intents(status);
  CREATE INDEX IF NOT EXISTS idx_refunds_payment_intent   ON refunds(payment_intent_id);

  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON payment_intents;
  CREATE TRIGGER update_payment_intents_updated_at
    BEFORE UPDATE ON payment_intents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Running payment-svc migrations...');
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
