'use strict';

/**
 * Tests for the token rotation lifecycle:
 *   POST /api/auth/refresh  — exchange refresh token for new pair
 *   POST /api/auth/logout   — revoke refresh token
 *   POST /api/auth/logout-all — revoke all sessions for a user
 */

const request = require('supertest');

jest.mock('../../services/auth-svc/src/db/pool', () => ({
  query:     jest.fn(),
  getClient: jest.fn(),
  pool:      { query: jest.fn(), end: jest.fn(), on: jest.fn() },
}));

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

const app  = require('../../services/auth-svc/src/app');
const { query, getClient } = require('../../services/auth-svc/src/db/pool');
const { makeTestToken } = require('../setup/helpers');

// ─── Token refresh ────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh token is provided', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({})
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid / unknown refresh token', async () => {
    // DB lookup returns no rows — token not found
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'totally-fake-token-value-that-wont-match-any-hash' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('returns 401 for a revoked refresh token', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id:         'token-id',
        user_id:    'user-id',
        email:      'user@wisebiz.online',
        role:       'customer',
        is_active:  true,
        revoked:    true,                   // ← revoked
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }],
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'some-valid-looking-token' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('returns 401 for an expired refresh token', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id:         'token-id',
        user_id:    'user-id',
        email:      'user@wisebiz.online',
        role:       'customer',
        is_active:  true,
        revoked:    false,
        expires_at: new Date(Date.now() - 1000).toISOString(), // ← already expired
      }],
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'some-valid-looking-token' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears cookies', async () => {
    // UPDATE to revoke the token
    query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: 'any-token' })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Both auth cookies should be cleared (Set-Cookie with empty value / past expiry)
    const setCookie = res.headers['set-cookie'] || [];
    const cookieStr = setCookie.join('; ');
    expect(cookieStr).toMatch(/access_token/);
    expect(cookieStr).toMatch(/refresh_token/);
  });

  it('returns 200 even when no token is sent (idempotent)', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/auth/logout')
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// ─── Logout-all ───────────────────────────────────────────────────────────────

describe('POST /api/auth/logout-all', () => {
  it('returns 200 and revokes all sessions for the user', async () => {
    query.mockResolvedValueOnce({ rowCount: 3, rows: [] });

    const { token } = makeTestToken();

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`)
      .set('X-User-ID', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/sessions terminated/i);

    // Verify the UPDATE query was called with the correct userId
    const updateCall = query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE user_id')
    );
    expect(updateCall).toBeDefined();
  });
});
