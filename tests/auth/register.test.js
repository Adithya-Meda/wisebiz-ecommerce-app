'use strict';

const request = require('supertest');

// ─── Mock the DB pool before any service module is loaded ────────────────────
jest.mock('../../services/auth-svc/src/db/pool', () => ({
  query:     jest.fn(),
  getClient: jest.fn(),
  pool:      { query: jest.fn(), end: jest.fn(), on: jest.fn() },
}));

// Mock RabbitMQ (amqplib) — registration publishes user.registered
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      publish:        jest.fn(),
      close:          jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

// Mock axios — registration calls user-svc to create a profile
jest.mock('axios');

const app         = require('../../services/auth-svc/src/app');
const { query, getClient } = require('../../services/auth-svc/src/db/pool');
const { registrationPayload } = require('../setup/helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Make the DB behave as if no existing user exists, then insert succeeds */
function mockSuccessfulRegistration() {
  // SELECT for uniqueness check → 0 rows
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  // INSERT returning new user
  query.mockResolvedValueOnce({
    rowCount: 1,
    rows: [{
      id:          'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      email:       'newuser@wisebiz.online',
      first_name:  'Test',
      last_name:   'User',
      role:        'customer',
      is_verified: false,
      created_at:  new Date().toISOString(),
    }],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  describe('Success cases', () => {
    it('returns 201 with user object on valid registration', async () => {
      mockSuccessfulRegistration();

      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        email:      'newuser@wisebiz.online',
        first_name: 'Test',
        last_name:  'User',
        role:       'customer',
      });
      // Password hash must NOT be returned
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('response message confirms account creation', async () => {
      mockSuccessfulRegistration();

      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload())
        .expect(201);

      expect(res.body.message).toMatch(/account created/i);
    });
  });

  describe('Conflict cases', () => {
    it('returns 409 when email is already registered', async () => {
      // SELECT finds existing user
      query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'existing-id' }],
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload())
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Validation cases', () => {
    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ email: undefined }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ email: 'not-an-email' }))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when password is too weak (no special char)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ password: 'Password1' }))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when password is shorter than 8 chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ password: 'Ab1@' }))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when first_name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({ first_name: undefined }))
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
