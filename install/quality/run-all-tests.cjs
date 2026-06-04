#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { createDiscoverySnapshot } = require('./test-discovery-governance.cjs');

const ROOT_DIR = process.cwd();
const snapshot = createDiscoverySnapshot(ROOT_DIR);

if (snapshot.officialTestFiles.length === 0) {
  console.error('No official test files discovered.');
  process.exit(1);
}

console.log('RL.SYS CORE Test Discovery Governance');
console.log(`OfficialPolicy: ${snapshot.officialPolicy}`);
console.log(`NestedLegacyPolicy: ${snapshot.nestedLegacyPolicy}`);
console.log(`DiscoveredTestFiles: ${snapshot.officialTestFileCount}`);
console.log(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
console.log(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);

const result = spawnSync(process.execPath, ['--test', ...snapshot.officialTestFiles], {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
