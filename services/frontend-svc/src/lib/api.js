'use strict';

const axios = require('axios');

const GATEWAY = process.env.GATEWAY_URL || `http://localhost:${process.env.GATEWAY_PORT || 3000}`;

/**
 * Create an axios instance that:
 *  - Targets the API gateway
 *  - Forwards the user's JWT (from session) as Bearer token
 *  - Has a consistent timeout
 */
function buildClient(accessToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return axios.create({
    baseURL: GATEWAY,
    timeout: 10000,
    headers,
    validateStatus: () => true, // handle all status codes manually
  });
}

/**
 * Public client — no auth token
 */
const publicClient = buildClient();

/**
 * Helper: extract error message from gateway response
 */
function extractError(response) {
  return response?.data?.error?.message || 'An unexpected error occurred';
}

module.exports = { buildClient, publicClient, extractError, GATEWAY };
