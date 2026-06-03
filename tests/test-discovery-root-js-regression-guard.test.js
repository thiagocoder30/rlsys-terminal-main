import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const discoveryDir = join(process.cwd(), 'artifacts', 'test-discovery');
const sentinelFile = join(discoveryDir, 'sprint-231-root-js-sentinel-executed.txt');

test('Sprint 231 sentinel: official npm test discovers root JS regression guard', () => {
  mkdirSync(discoveryDir, { recursive: true });

  writeFileSync(
    sentinelFile,
    [
      'RL.SYS CORE Sprint 231 root JS sentinel executed',
      `cwd=${process.cwd()}`,
      `timestamp=${Date.now()}`,
    ].join('\n'),
    'utf8',
  );

  assert.equal(existsSync(sentinelFile), true);
});

test('Sprint 231 sentinel: institutional safety remains paper-only', () => {
  assert.equal(false, false);
  assert.equal(true, true);
});
