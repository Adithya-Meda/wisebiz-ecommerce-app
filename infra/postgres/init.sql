-- WiseBiz PostgreSQL initialisation
-- Runs once when the postgres container is first created.
-- Creates all four application databases if they don't already exist.

SELECT 'CREATE DATABASE wisebiz_auth'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wisebiz_auth')\gexec

SELECT 'CREATE DATABASE wisebiz_users'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wisebiz_users')\gexec

SELECT 'CREATE DATABASE wisebiz_orders'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wisebiz_orders')\gexec

SELECT 'CREATE DATABASE wisebiz_payments'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wisebiz_payments')\gexec
