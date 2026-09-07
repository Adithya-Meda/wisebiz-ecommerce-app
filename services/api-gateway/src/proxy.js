'use strict';

const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, requireRole } = require('./middleware/auth');
const { authRateLimiter, refreshRateLimiter, passwordResetRateLimiter } = require('./middleware/rateLimiter');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('api-gateway:proxy');

/**
 * Route definitions — each entry maps a path prefix to a downstream service.
 * `protected: true`  → JWT required for ALL sub-routes.
 * `protected: false` → public by default; fine-grained auth added via adminRules.
 */
const SERVICE_ROUTES = [
  {
    path: '/api/auth',
    target: process.env.AUTH_SVC_URL || 'http://localhost:3001',
    protected: false,
    rateLimit: authRateLimiter,
    name: 'auth-svc',
  },
  {
    path: '/api/users',
    target: process.env.USER_SVC_URL || 'http://localhost:3002',
    protected: true,
    name: 'user-svc',
  },
  {
    path: '/api/products',
    target: process.env.PRODUCT_SVC_URL || 'http://localhost:3003',
    protected: false, // GET is public; writes guarded below via adminRules
    name: 'product-svc',
  },
  {
    path: '/api/cart',
    target: process.env.CART_SVC_URL || 'http://localhost:3004',
    protected: true,
    name: 'cart-svc',
  },
  {
    path: '/api/orders',
    target: process.env.ORDER_SVC_URL || 'http://localhost:3005',
    protected: true,
    name: 'order-svc',
  },
  {
    path: '/api/payments',
    target: process.env.PAYMENT_SVC_URL || 'http://localhost:3006',
    protected: true,
    name: 'payment-svc',
  },
];

/**
 * Fine-grained admin-only rules applied BEFORE the broad proxy.
 * Each entry: { method, pathRegex, middlewares[] }
 * These mount as express route handlers so they run first when method+path match.
 */
function registerAdminRules(app) {
  const adminGuard = [authenticateToken, requireRole('admin')];

  // ── Fine-grained auth sub-route limiters ──────────────────────────────────
  // These must be registered before the broad /api/auth proxy so they fire first.
  app.post('/api/auth/refresh',         refreshRateLimiter,       proxyPassthrough('auth-svc'));
  app.post('/api/auth/forgot-password', passwordResetRateLimiter, proxyPassthrough('auth-svc'));

  // ── Product catalog writes — admin only ───────────────────────────────────
  app.post('/api/products/categories', ...adminGuard, proxyPassthrough('product-svc'));
  app.post('/api/products', ...adminGuard, proxyPassthrough('product-svc'));
  app.put('/api/products/:id', ...adminGuard, proxyPassthrough('product-svc'));
  app.delete('/api/products/:id', ...adminGuard, proxyPassthrough('product-svc'));
  app.patch('/api/products/:id/stock', ...adminGuard, proxyPassthrough('product-svc'));

  // Order status update — admin only
  app.patch('/api/orders/:id/status', ...adminGuard, proxyPassthrough('order-svc'));
}

/**
 * Returns a one-off proxy middleware for a named service.
 * Used by the fine-grained admin rules above.
 */
function proxyPassthrough(serviceName) {
  const route = SERVICE_ROUTES.find((r) => r.name === serviceName);
  if (!route) { throw new Error(`Unknown service: ${serviceName}`); }

  return createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    on: {
      error: makeErrorHandler(route.name),
      proxyReq: forwardHeaders,
    },
  });
}

function makeErrorHandler(name) {
  return (err, req, res) => {
    logger.error(`Proxy error for ${name}`, { error: err.message, path: req.path });
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: `${name} is temporarily unavailable` },
      });
    }
  };
}

function forwardHeaders(proxyReq, req) {
  if (req.user) {
    proxyReq.setHeader('X-User-ID', req.user.userId);
    proxyReq.setHeader('X-User-Role', req.user.role);
    proxyReq.setHeader('X-User-Email', req.user.email);
  }
  proxyReq.setHeader('X-Request-ID', req.id || '');
  proxyReq.setHeader('X-Forwarded-For', req.ip || '');
}

function createProxies(app) {
  // ── Step 1: mount fine-grained admin rules FIRST ──────────────────────────
  // These handle specific method+path combos before the catch-all proxy below.
  registerAdminRules(app);

  // ── Step 2: mount broad proxies for each service prefix ───────────────────
  SERVICE_ROUTES.forEach((route) => {
    const middlewares = [];

    if (route.rateLimit) {
      middlewares.push(route.rateLimit);
    }

    if (route.protected) {
      middlewares.push(authenticateToken);
    }

    middlewares.push(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        on: {
          error: makeErrorHandler(route.name),
          proxyReq: forwardHeaders,
        },
      })
    );

    app.use(route.path, ...middlewares);
    logger.info(`Registered proxy: ${route.path} → ${route.target}`);
  });
}

module.exports = { createProxies };
