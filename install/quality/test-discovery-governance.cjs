#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function existsDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectTopLevelLegacyTests(rootDir) {
  const baseDir = rootDir || process.cwd();
  const legacyRoot = path.join(baseDir, 'tests');

  if (!existsDirectory(legacyRoot)) {
    return [];
  }

  return fs
    .readdirSync(legacyRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join('tests', entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function collectRecursiveTests(rootDir, relativeDirectory) {
  const baseDir = rootDir || process.cwd();
  const targetRoot = path.join(baseDir, relativeDirectory);

  if (!existsDirectory(targetRoot)) {
    return [];
  }

  const stack = [targetRoot];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.sort((left, right) => right.name.localeCompare(left.name));

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.relative(baseDir, absolutePath));
      }
    }
  }

  return uniqueSorted(files);
}

function collectInstitutionalTests(rootDir) {
  return collectRecursiveTests(rootDir || process.cwd(), 'test');
}

function collectAllLegacyTests(rootDir) {
  return collectRecursiveTests(rootDir || process.cwd(), 'tests');
}

function collectNestedLegacyTests(rootDir) {
  const baseDir = rootDir || process.cwd();
  const topLevel = new Set(collectTopLevelLegacyTests(baseDir));

  return collectAllLegacyTests(baseDir).filter((file) => !topLevel.has(file));
}

function discoverOfficialTestFiles(rootDir) {
  const baseDir = rootDir || process.cwd();

  return uniqueSorted([
    ...collectTopLevelLegacyTests(baseDir),
    ...collectInstitutionalTests(baseDir),
  ]);
}

function createDiscoverySnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const topLevelLegacyTests = collectTopLevelLegacyTests(baseDir);
  const institutionalTests = collectInstitutionalTests(baseDir);
  const nestedLegacyTests = collectNestedLegacyTests(baseDir);
  const officialTestFiles = uniqueSorted([...topLevelLegacyTests, ...institutionalTests]);

  return Object.freeze({
    rootDir: baseDir,
    officialPolicy: 'tests top-level plus institutional recursive tests',
    nestedLegacyPolicy: 'diagnostic-only',
    officialTestFileCount: officialTestFiles.length,
    topLevelLegacyTestCount: topLevelLegacyTests.length,
    institutionalTestCount: institutionalTests.length,
    nestedLegacyTestCount: nestedLegacyTests.length,
    officialTestFiles,
    topLevelLegacyTests,
    institutionalTests,
    nestedLegacyTests,
  });
}

module.exports = {
  collectTopLevelLegacyTests,
  collectInstitutionalTests,
  collectAllLegacyTests,
  collectNestedLegacyTests,
  createDiscoverySnapshot,
  discoverOfficialTestFiles,
  uniqueSorted,
};
