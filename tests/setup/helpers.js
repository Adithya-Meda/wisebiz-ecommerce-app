'use strict';

const { generateAccessToken } = require('../../services/auth-svc/src/utils/jwt');

/**
 * Generate a signed test JWT for a given user payload.
 * Used by tests that need a valid Authorization header without a real login.
 *
 * @param {object} overrides — partial user object to merge into the default test user
 * @returns {{ token: string, user: object }}
 */
function makeTestToken(overrides = {}) {
  const user = {
    id:    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    email: 'test@wisebiz.online',
    role:  'customer',
    ...overrides,
  };
  const token = generateAccessToken(user);
  return { token, user };
}

/**
 * Build a valid registration payload.
 * @param {object} overrides
 */
function registrationPayload(overrides = {}) {
  return {
    email:      'newuser@wisebiz.online',
    password:   'Secure@123',
    first_name: 'Test',
    last_name:  'User',
    ...overrides,
  };
}

/**
 * Build a valid shipping address payload.
 */
function addressPayload(overrides = {}) {
  return {
    full_name:   'Test User',
    line1:       '123 Main Street',
    city:        'Bengaluru',
    state:       'Karnataka',
    postal_code: '560001',
    country:     'India',
    ...overrides,
  };
}

module.exports = { makeTestToken, registrationPayload, addressPayload };
