'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });

const { pool } = require('./pool');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('user-svc:migrate');

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS profiles (
    id            UUID PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    phone         VARCHAR(20),
    date_of_birth DATE,
    gender        VARCHAR(20) CHECK (gender IN ('male', 'female', 'non-binary', 'prefer_not_to_say')),
    avatar_url    VARCHAR(500),
    bio           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label         VARCHAR(50)  NOT NULL DEFAULT 'home' CHECK (label IN ('home', 'work', 'other')),
    full_name     VARCHAR(200) NOT NULL,
    line1         VARCHAR(255) NOT NULL,
    line2         VARCHAR(255),
    city          VARCHAR(100) NOT NULL,
    state         VARCHAR(100) NOT NULL,
    postal_code   VARCHAR(20)  NOT NULL,
    country       VARCHAR(100) NOT NULL DEFAULT 'India',
    phone         VARCHAR(20),
    is_default    BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id    VARCHAR(100) NOT NULL,
    product_name  VARCHAR(255) NOT NULL,
    product_price NUMERIC(10,2),
    product_image VARCHAR(500),
    added_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
  CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);

  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
  CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
  CREATE TRIGGER update_addresses_updated_at
    BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Running user-svc migrations...');
    await client.query(SCHEMA);
    logger.info('Migrations completed successfully');
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
