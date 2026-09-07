'use strict';

/**
 * Tests for POST /api/orders — the core order creation flow.
 *
 * The order-svc depends on:
 *   - PostgreSQL (pool)          — mocked
 *   - axios → cart-svc snapshot  — mocked
 *   - axios → product-svc stock  — mocked
 *   - amqplib publisher          — mocked
 */

const request = require('supertest');

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../services/order-svc/src/db/pool', () => ({
  query:     jest.fn(),
  getClient: jest.fn(),
  pool:      { query: jest.fn(), end: jest.fn(), on: jest.fn() },
}));

jest.mock('axios');

// Mock the RabbitMQ publisher used by order-svc
jest.mock('../../services/order-svc/src/messaging/publisher', () => ({
  connect:  jest.fn().mockResolvedValue(undefined),
  publish:  jest.fn().mockResolvedValue(undefined),
  close:    jest.fn().mockResolvedValue(undefined),
}));

const axios    = require('axios');
const app      = require('../../services/order-svc/src/app');
const { query, getClient } = require('../../services/order-svc/src/db/pool');
const { addressPayload } = require('../setup/helpers');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CART = {
  items: [
    {
      product_id: 'prod-001',
      name:       'Wireless Headphones',
      price:      1299.00,
      quantity:   2,
      image:      null,
      variant:    null,
    },
  ],
  subtotal: 2598.00,
};

const MOCK_ORDER = {
  id:           'order-uuid-001',
  order_number: 'WB-TEST-0001',
  user_id:      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  user_email:   'test@wisebiz.online',
  status:       'pending',
  subtotal:     2598.00,
  shipping_amount: 0,
  tax_amount:   467.64,
  total_amount: 3065.64,
  currency:     'INR',
  shipping_address: addressPayload(),
  created_at:   new Date().toISOString(),
};

// ─── Setup helpers ────────────────────────────────────────────────────────────

function mockCartSnapshot(cartData = MOCK_CART) {
  axios.get.mockResolvedValueOnce({ data: { data: cartData } });
}

function mockDbTransaction(order = MOCK_ORDER) {
  const mockClient = {
    query:   jest.fn(),
    release: jest.fn(),
  };

  // BEGIN
  mockClient.query.mockResolvedValueOnce({});
  // INSERT order RETURNING
  mockClient.query.mockResolvedValueOnce({ rows: [order], rowCount: 1 });
  // INSERT order_item (one per cart item)
  mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  // INSERT order_status_history
  mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  // COMMIT
  mockClient.query.mockResolvedValueOnce({});

  getClient.mockResolvedValueOnce(mockClient);

  // getOrderById SELECT after creation
  query.mockResolvedValueOnce({
    rowCount: 1,
    rows: [{
      ...order,
      items: MOCK_CART.items.map((i) => ({
        id:            'item-001',
        product_id:    i.product_id,
        product_name:  i.name,
        product_image: null,
        variant:       null,
        unit_price:    i.price,
        quantity:      i.quantity,
        line_total:    i.price * i.quantity,
      })),
    }],
  });

  // Mock stock decrement (non-blocking axios.patch)
  axios.patch.mockResolvedValue({ data: { success: true } });

  return mockClient;
}

const VALID_BODY = {
  shipping_address: addressPayload(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  describe('Success cases', () => {
    it('returns 201 with order on valid cart and address', async () => {
      mockCartSnapshot();
      mockDbTransaction();

      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toMatchObject({
        user_id:  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        status:   'pending',
        currency: 'INR',
      });
      expect(res.body.data.order.items).toHaveLength(1);
    });

    it('calculates free shipping for orders over ₹1000', async () => {
      mockCartSnapshot({ ...MOCK_CART, subtotal: 2598 });
      mockDbTransaction();

      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY)
        .expect(201);

      expect(res.body.success).toBe(true);
      // shipping_amount should be 0 for subtotal >= 1000
      expect(res.body.data.order.shipping_amount).toBe(0);
    });

    it('publishes order.placed event (non-blocking)', async () => {
      mockCartSnapshot();
      mockDbTransaction();

      const publisher = require('../../services/order-svc/src/messaging/publisher');

      await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY);

      expect(publisher.publish).toHaveBeenCalledWith(
        'order.placed',
        expect.objectContaining({ user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
      );
    });
  });

  describe('Failure cases', () => {
    it('returns 400 when cart is empty', async () => {
      mockCartSnapshot({ items: [], subtotal: 0 });

      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMPTY_CART');
    });

    it('returns 502 when cart-svc is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY)
        .expect(502);

      expect(res.body.error.code).toBe('CART_UNAVAILABLE');
    });

    it('returns 400 when shipping_address is missing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when shipping_address is incomplete', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send({ shipping_address: { full_name: 'Test' } }) // missing required fields
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('rolls back DB transaction on insert error', async () => {
      mockCartSnapshot();

      const mockClient = {
        query:   jest.fn(),
        release: jest.fn(),
      };
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockRejectedValueOnce(new Error('DB write failed')); // INSERT fails
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      getClient.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/orders')
        .set('X-User-ID',    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        .set('X-User-Email', 'test@wisebiz.online')
        .send(VALID_BODY)
        .expect(500);

      expect(res.body.success).toBe(false);

      // Verify ROLLBACK was called
      const rollbackCall = mockClient.query.mock.calls.find(([sql]) => sql === 'ROLLBACK');
      expect(rollbackCall).toBeDefined();
    });
  });
});
