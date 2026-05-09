const test = require('node:test');
const assert = require('node:assert/strict');
const { ConfigValidator } = require('../dist/application/config/ConfigValidator');

const validConfig = {
  appVersion: '1.0.0-test',
  nodeEnv: 'test',
  serverPort: 3000,
  serverHost: '0.0.0.0',
  historyBufferSize: 100,
  geminiApiKey: '',
  signalLogPath: './data/signals.jsonl',
  auditLogPath: './data/audit.jsonl',
  dataPath: './data',
  logLevel: 'info'
};

test('ConfigValidator accepts production-safe defaults with warnings only', () => {
  const result = new ConfigValidator().validate(validConfig);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.sanitized.hasGeminiApiKey, false);
});

test('ConfigValidator rejects invalid ports and log levels', () => {
  const result = new ConfigValidator().validate({ ...validConfig, serverPort: 70000, logLevel: 'trace' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(issue => issue.key === 'PORT'));
  assert.ok(result.errors.some(issue => issue.key === 'LOG_LEVEL'));
});
