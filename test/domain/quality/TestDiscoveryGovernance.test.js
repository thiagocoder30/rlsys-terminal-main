'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
}

function collectTopLevelLegacyTests() {
  const legacyRoot = path.join(process.cwd(), 'tests');

  if (!fs.existsSync(legacyRoot)) {
    return [];
  }

  return fs
    .readdirSync(legacyRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join('tests', entry.name))
    .sort();
}

function collectInstitutionalTests() {
  const institutionalRoot = path.join(process.cwd(), 'test');

  if (!fs.existsSync(institutionalRoot)) {
    return [];
  }

  const stack = [institutionalRoot];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.relative(process.cwd(), absolutePath));
      }
    }
  }

  return files.sort();
}

test('npm test uses institutional recursive discovery runner', () => {
  const packageJson = readPackageJson();

  assert.equal(
    packageJson.scripts.test,
    'node install/quality/run-all-tests.cjs'
  );
});

test('test discovery includes legacy top-level tests and institutional domain tests', () => {
  const legacyTests = collectTopLevelLegacyTests();
  const institutionalTests = collectInstitutionalTests();

  assert.ok(
    legacyTests.length > 0,
    'legacy tests/*.test.js files must remain discoverable'
  );

  assert.ok(
    institutionalTests.includes('test/domain/learning/InstitutionalLearningGovernanceSnapshotEngine.test.js'),
    'Sprint 234 learning governance test must be discoverable'
  );

  assert.ok(
    institutionalTests.includes('test/domain/learning/ContextSimilarityEngineV2.test.js'),
    'Sprint 237 test must be discoverable'
  );

  assert.ok(
    institutionalTests.includes('test/domain/learning/OutcomeCorrelationEngine.test.js'),
    'Sprint 238 test must be discoverable'
  );

  assert.ok(
    institutionalTests.includes('test/domain/learning/LearningWeightAdjustmentEngine.test.js'),
    'Sprint 239 test must be discoverable'
  );
});

test('test discovery intentionally excludes stale recursive tests under tests subdirectories', () => {
  const legacyTests = collectTopLevelLegacyTests();

  assert.equal(
    legacyTests.some((file) => file.startsWith('tests/knowledge/')),
    false
  );

  assert.equal(
    legacyTests.some((file) => file.startsWith('tests/live/')),
    false
  );

  assert.equal(
    legacyTests.some((file) => file.startsWith('tests/research/')),
    false
  );
});
