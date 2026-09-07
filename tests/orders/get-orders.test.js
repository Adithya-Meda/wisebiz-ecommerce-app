'use strict';

/**
 * Tests for order retrieval:
 *   GET /api/orders         — list orders (paginated)
 *   GET /api/orders/:id     — get single order
 *   POST /api/orders/:id/cancel — cancel an order
 */

const request = require('supertest');

jest.mock('../../services/order-svc/src/db/pool', () => ({
  query:     jest.fn(),
  getClient: jest.fn(),
  pool:      { query: jest.fn(), end: jest.fn(), on: jest.fn() },
}));

jest.mock('axios');
jest.mock('../../services/order-svc/src/messaging/publisher', () => ({
  connect: jest.fn(),
  publish: jest.fn().mockResolvedValue(undefined),
  close:   jest.fn(),
}));

const app  = require('../../services/order-svc/src/app');
const { query, getClient } = require('../../services/order-svc/src/db/pool');
const { v4: uuidv4 } = require('uuid');

const USER_ID  = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ORDER_ID = uuidv4();

const MOCK_ORDER_ROW = {
  id:           ORDER_ID,
  order_number: 'WB-TEST-0001',
  user_id:      USER_ID,
  user_email:   'test@wisebiz.online',
  status:       'pending',
  total_amount: 3065.64,
  currency:     'INR',
  shipping_address: { full_name: 'Test User', line1: '123 Main St', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001', country: 'India' },
  created_at:   new Date().toISOString(),
  items: [{ id: 'item-1', product_id: 'prod-001', product_name: 'Headphones', quantity: 2, unit_price: 1299, line_total: 2598, product_image: null, variant: null }],
};

// ─── GET /api/orders ──────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  it('returns paginated list of orders for the authenticated user', async () => {
    query.mockResolvedValueOnce({ rows: [MOCK_ORDER_ROW], rowCount: 1 }); // orders
    query.mockResolvedValueOnce({ rows: [{ count: '1' }],  rowCount: 1 }); // count

    const res = await request(app)
      .get('/api/orders')
      .set('X-User-ID', USER_ID)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ total: 1, page: 1 });
  });

  it('returns empty list when user has no orders', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    query.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

    const res = await request(app)
      .get('/api/orders')
      .set('X-User-ID', USER_ID)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('accepts status filter in query string', async () => {
    query.mockResolvedValueOnce({ rows: [MOCK_ORDER_ROW], rowCount: 1 });
    query.mockResolvedValueOnce({ rows: [{ count: '1' }],  rowCount: 1 });

    await request(app)
      .get('/api/orders?status=pending')
      .set('X-User-ID', USER_ID)
      .expect(200);

    // Verify the status param was passed to the DB query
    const statusQueryCall = query.mock.calls.find(([sql]) => sql.includes('o.status'));
    expect(statusQueryCall).toBeDefined();
  });
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  it('returns a single order belonging to the user', async () => {
    query.mockResolvedValueOnce({ rows: [MOCK_ORDER_ROW], rowCount: 1 });

    const res = await request(app)
      .get(`/api/orders/${ORDER_ID}`)
      .set('X-User-ID', USER_ID)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.id).toBe(ORDER_ID);
  });

  it('returns 404 for a non-existent order ID', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get(`/api/orders/${uuidv4()}`)
      .set('X-User-ID', USER_ID)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when order belongs to a different user', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...MOCK_ORDER_ROW, user_id: 'different-user-id' }],
      rowCount: 1,
    });

    const res = await request(app)
      .get(`/api/orders/${ORDER_ID}`)
      .set('X-User-ID', USER_ID)
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─── POST /api/orders/:id/cancel ─────────────────────────────────────────────

describe('POST /api/orders/:id/cancel', () => {
  it('returns 200 and cancelled order on valid pending order', async () => {
    const mockClient = {
      query:   jest.fn(),
      release: jest.fn(),
    };

    // getOrderById SELECT (ownership check inside cancelOrder)
    query.mockResolvedValueOnce({ rows: [{ ...MOCK_ORDER_ROW, status: 'pending' }], rowCount: 1 });

    // BEGIN, UPDATE status, INSERT history, COMMIT
    mockClient.query.mockResolvedValueOnce({});
    mockClient.query.mockResolvedValueOnce({ rows: [{ ...MOCK_ORDER_ROW, status: 'cancelled' }], rowCount: 1 });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    mockClient.query.mockResolvedValueOnce({});

    getClient.mockResolvedValueOnce(mockClient);

    // Final getOrderById after update
    query.mockResolvedValueOnce({ rows: [{ ...MOCK_ORDER_ROW, status: 'cancelled', items: MOCK_ORDER_ROW.items }], rowCount: 1 });

    const res = await request(app)
      .post(`/api/orders/${ORDER_ID}/cancel`)
      .set('X-User-ID', USER_ID)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('cancelled');
  });
});
