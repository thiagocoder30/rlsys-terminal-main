#!/usr/bin/env node
'use strict';

const { createDiscoverySnapshot } = require('./test-discovery-governance.cjs');

function printSnapshot(snapshot) {
  console.log('RL.SYS CORE Test Discovery Audit');
  console.log(`OfficialPolicy: ${snapshot.officialPolicy}`);
  console.log(`NestedLegacyPolicy: ${snapshot.nestedLegacyPolicy}`);
  console.log(`OfficialTestFileCount: ${snapshot.officialTestFileCount}`);
  console.log(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
  console.log(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
  console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);

  if (snapshot.nestedLegacyTests.length > 0) {
    console.log('NestedLegacyTests:');

    for (const file of snapshot.nestedLegacyTests) {
      console.log(` - ${file}`);
    }
  }
}

if (require.main === module) {
  printSnapshot(createDiscoverySnapshot(process.cwd()));
}

module.exports = { printSnapshot };
