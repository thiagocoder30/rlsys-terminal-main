const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { HealthCheckService } = require('../dist/application/health/HealthCheckService');

test('HealthCheckService reports readiness with writable data directory', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rlsys-health-'));
  const service = new HealthCheckService('0.9.0-test', dir);
  const readiness = await service.readiness();

  assert.equal(readiness.status, 'ok');
  assert.equal(readiness.version, '0.9.0-test');
  assert.equal(readiness.checks.runtime.status, 'ok');
  assert.equal(readiness.checks.filesystem.status, 'ok');
});
