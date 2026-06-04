#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { collectNestedLegacyTests } = require('./test-discovery-governance.cjs');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function readManifestLines(rootDir, manifestRelativePath) {
  const manifestPath = path.join(rootDir || process.cwd(), manifestRelativePath);

  if (!existsFile(manifestPath)) {
    return [];
  }

  return fs
    .readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function createClosureSnapshot(rootDir, manifestRelativePath) {
  const baseDir = rootDir || process.cwd();
  const nestedLegacyTests = collectNestedLegacyTests(baseDir);
  const manifestLines = readManifestLines(baseDir, manifestRelativePath);

  return Object.freeze({
    rootDir: baseDir,
    manifestRelativePath,
    nestedLegacyTestCount: nestedLegacyTests.length,
    nestedLegacyTests,
    manifestLineCount: manifestLines.length,
    manifestLines,
    isClosed: nestedLegacyTests.length === 0,
  });
}

if (require.main === module) {
  const manifest = process.argv[2] || 'docs/archive/legacy-hidden-tests/sprint-245-legacy-hidden-tests-manifest.txt';
  const snapshot = createClosureSnapshot(process.cwd(), manifest);

  console.log('RL.SYS CORE Legacy Nested Regression Closure');
  console.log(`Manifest: ${snapshot.manifestRelativePath}`);
  console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);
  console.log(`ManifestLineCount: ${snapshot.manifestLineCount}`);
  console.log(`Closed: ${snapshot.isClosed ? 'true' : 'false'}`);

  if (!snapshot.isClosed) {
    for (const file of snapshot.nestedLegacyTests) {
      console.log(` - ${file}`);
    }
    process.exit(1);
  }
}

module.exports = {
  createClosureSnapshot,
  readManifestLines,
};
