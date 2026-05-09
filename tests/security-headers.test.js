const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeaders } = require('../dist/infrastructure/http/middleware/securityHeaders');

test('securityHeaders applies baseline hardening headers', () => {
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  let called = false;
  securityHeaders({}, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Cache-Control'], 'no-store');
});
