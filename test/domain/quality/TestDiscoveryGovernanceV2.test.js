'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  createDiscoverySnapshot,
  discoverOfficialTestFiles,
  collectNestedLegacyTests,
} = require('../../../install/quality/test-discovery-governance.cjs');

const {
  parseNodeTestSummary,
  formatSummaryLines,
  normalizeSummaryLine,
} = require('../../../install/quality/parse-node-test-summary.cjs');

test('test discovery governance V2 exposes deterministic official contract', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());

  assert.equal(snapshot.officialPolicy, 'tests top-level plus institutional recursive tests');
  assert.equal(snapshot.nestedLegacyPolicy, 'diagnostic-only');
  assert.ok(snapshot.officialTestFileCount > 0);
  assert.equal(snapshot.officialTestFileCount, snapshot.officialTestFiles.length);
  assert.deepEqual(snapshot.officialTestFiles, discoverOfficialTestFiles(process.cwd()));
});

test('nested legacy tests remain diagnostic-only and outside official discovery', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());
  const nestedLegacyTests = collectNestedLegacyTests(process.cwd());
  const official = new Set(snapshot.officialTestFiles);

  assert.deepEqual(snapshot.nestedLegacyTests, nestedLegacyTests);

  for (const nestedTest of nestedLegacyTests) {
    assert.equal(official.has(nestedTest), false);
  }
});

test('official runner exists and depends on shared discovery governance', () => {
  const runner = fs.readFileSync('install/quality/run-all-tests.cjs', 'utf8');

  assert.match(runner, /test-discovery-governance\.cjs/);
  assert.match(runner, /createDiscoverySnapshot/);
});

test('node test summary parser handles TAP hash summary output', () => {
  const parsed = parseNodeTestSummary(`
# tests 1323
# suites 0
# pass 1323
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9850.42
`);

  assert.equal(parsed.tests, 1323);
  assert.equal(parsed.pass, 1323);
  assert.equal(parsed.fail, 0);
  assert.deepEqual(formatSummaryLines(parsed), [
    'GlobalTestTotal=1323',
    'GlobalTestPass=1323',
    'GlobalTestFail=0',
  ]);
});

test('node test summary parser handles Node 24 info symbol summary output', () => {
  assert.equal(normalizeSummaryLine('ℹ tests 1327'), 'tests 1327');

  const parsed = parseNodeTestSummary(`
ℹ tests 1327
ℹ suites 0
ℹ pass 1327
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 22292.274129
`);

  assert.equal(parsed.tests, 1327);
  assert.equal(parsed.pass, 1327);
  assert.equal(parsed.fail, 0);
  assert.deepEqual(formatSummaryLines(parsed), [
    'GlobalTestTotal=1327',
    'GlobalTestPass=1327',
    'GlobalTestFail=0',
  ]);
});
