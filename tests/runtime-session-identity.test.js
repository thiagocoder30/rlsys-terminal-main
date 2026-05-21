const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeSessionIdentityFactory } = require('../dist/domain/session');

test('RuntimeSessionIdentityFactory creates deterministic UTC runtime session id', () => {
  const factory = new RuntimeSessionIdentityFactory();
  const identity = factory.create(Date.UTC(2026, 4, 21, 0, 45, 1));

  assert.equal(identity.sessionId, 'runtime-20260521-004501');
  assert.equal(identity.startedAtEpochMs, Date.UTC(2026, 4, 21, 0, 45, 1));
});
