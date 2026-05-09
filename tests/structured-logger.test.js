const test = require('node:test');
const assert = require('node:assert/strict');
const { StructuredLogger } = require('../dist/infrastructure/observability/StructuredLogger');

test('StructuredLogger emits sanitized JSON logs', () => {
  const lines = [];
  const originalLog = console.log;
  console.log = line => lines.push(line);

  try {
    const logger = new StructuredLogger('test-service', 'debug');
    logger.info('login_attempt', { token: 'secret', userId: 'abc' });
  } finally {
    console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.service, 'test-service');
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.context.token, '[REDACTED]');
  assert.equal(parsed.context.userId, 'abc');
});
