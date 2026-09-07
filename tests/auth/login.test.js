'use strict';

const request = require('supertest');
const bcrypt  = require('bcryptjs');

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

// Pre-hashed bcrypt password for 'Secure@123' — computed once to speed up tests
const HASHED_PASSWORD = bcrypt.hashSync('Secure@123', 1); // rounds=1 for test speed

const MOCK_USER = {
  id:            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email:         'user@wisebiz.online',
  password_hash: HASHED_PASSWORD,
  first_name:    'Test',
  last_name:     'User',
  role:          'customer',
  is_active:     true,
};

/** Make DB return a valid user for the SELECT in auth.service.login */
function mockUserFound(overrides = {}) {
  query.mockResolvedValueOnce({
    rowCount: 1,
    rows: [{ ...MOCK_USER, ...overrides }],
  });
  // Second query: INSERT refresh token
  query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
}

/** Make DB return no rows for the user SELECT */
function mockUserNotFound() {
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
}

describe('POST /api/auth/login', () => {
  describe('Success cases', () => {
    it('returns 200 with access_token and user on valid credentials', async () => {
      mockUserFound();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@wisebiz.online', password: 'Secure@123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.user.email).toBe('user@wisebiz.online');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('sets httpOnly cookies on successful login', async () => {
      mockUserFound();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@wisebiz.online', password: 'Secure@123' })
        .expect(200);

      const cookies = res.headers['set-cookie'] || [];
      const cookieNames = cookies.map((c) => c.split('=')[0]);
      expect(cookieNames).toContain('access_token');
      expect(cookieNames).toContain('refresh_token');
      // Verify httpOnly flag
      cookies.forEach((c) => {
        if (c.startsWith('access_token') || c.startsWith('refresh_token')) {
          expect(c.toLowerCase()).toContain('httponly');
        }
      });
    });
  });

  describe('Failure cases', () => {
    it('returns 401 for wrong password (timing-safe path)', async () => {
      mockUserFound();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@wisebiz.online', password: 'WrongPass@99' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for non-existent email (timing-safe path)', async () => {
      mockUserNotFound();
      // The service still runs bcrypt.compare on a dummy hash to prevent timing attacks
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@wisebiz.online', password: 'Secure@123' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for deactivated account', async () => {
      mockUserFound({ is_active: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@wisebiz.online', password: 'Secure@123' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation cases', () => {
    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Secure@123' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@wisebiz.online' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
