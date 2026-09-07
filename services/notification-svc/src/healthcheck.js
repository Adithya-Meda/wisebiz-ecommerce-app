// Lightweight Docker HEALTHCHECK — uses only Node.js built-in http module.
// No curl or external dependencies required in the container image.
'use strict';

const http = require('http');

const port = parseInt(process.env.NOTIFICATION_SVC_PORT || '3007', 10);

const req = http.request(
  { host: '127.0.0.1', port, path: '/health', timeout: 5000 },
  (res) => process.exit(res.statusCode === 200 || res.statusCode === 204 ? 0 : 1)
);

req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
req.end();
