'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  collectNestedLegacyTests,
  createDiscoverySnapshot,
} = require('../../../install/quality/test-discovery-governance.cjs');

const {
  createClosureSnapshot,
} = require('../../../install/quality/legacy-nested-regression-closure.cjs');

test('legacy nested regression closure leaves no hidden nested tests under tests directory', () => {
  const nestedLegacyTests = collectNestedLegacyTests(process.cwd());

  assert.deepEqual(nestedLegacyTests, []);
});

test('test discovery snapshot reports zero nested legacy tests after closure', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());

  assert.equal(snapshot.nestedLegacyPolicy, 'diagnostic-only');
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.ok(snapshot.officialTestFileCount > 0);
});

test('legacy hidden tests are archived with an institutional manifest', () => {
  const manifestPath = 'docs/archive/legacy-hidden-tests/sprint-245-legacy-hidden-tests-manifest.txt';
  const snapshot = createClosureSnapshot(process.cwd(), manifestPath);

  assert.equal(snapshot.isClosed, true);
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.ok(snapshot.manifestLineCount > 0);
  assert.equal(fs.existsSync(manifestPath), true);
});
