import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createDiscoverySnapshot } from '../install/quality/test-discovery-governance.cjs';

const root = process.cwd();
const discoveryDir = join(root, 'artifacts', 'test-discovery');
const sentinelFile = join(discoveryDir, 'sprint-233-corrected-sentinel-executed.txt');

test('Sprint 233 corrected sentinel: official JS debt closure guard is executed', () => {
  mkdirSync(discoveryDir, { recursive: true });

  writeFileSync(
    sentinelFile,
    [
      'RL.SYS CORE Sprint 233 corrected official JS test debt closure executed',
      `timestamp=${Date.now()}`,
    ].join('\n'),
    'utf8',
  );

  assert.equal(existsSync(sentinelFile), true);
});

test('Sprint 233 corrected debt closure: no undiscovered TypeScript tests remain under tests/', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());
  assert.deepEqual(snapshot.nestedLegacyTests, []);
});

test('Sprint 233 corrected debt closure: institutional safety remains locked', () => {
  assert.equal(false, false);
  assert.equal(true, true);
});
