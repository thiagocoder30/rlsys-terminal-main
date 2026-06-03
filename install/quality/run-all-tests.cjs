#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = process.cwd();

function existsDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function collectTopLevelLegacyTests() {
  const legacyRoot = path.join(ROOT_DIR, 'tests');

  if (!existsDirectory(legacyRoot)) {
    return [];
  }

  return fs
    .readdirSync(legacyRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join('tests', entry.name));
}

function collectRecursiveInstitutionalTests() {
  const institutionalRoot = path.join(ROOT_DIR, 'test');

  if (!existsDirectory(institutionalRoot)) {
    return [];
  }

  const stack = [institutionalRoot];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.relative(ROOT_DIR, absolutePath));
      }
    }
  }

  return files;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

const testFiles = uniqueSorted([
  ...collectTopLevelLegacyTests(),
  ...collectRecursiveInstitutionalTests(),
]);

if (testFiles.length === 0) {
  console.error('No .test.js files discovered.');
  process.exit(1);
}

console.log('RL.SYS CORE Test Discovery Governance');
console.log('LegacyPolicy: tests/*.test.js');
console.log('InstitutionalPolicy: test/**/*.test.js');
console.log(`DiscoveredTestFiles: ${testFiles.length}`);

for (let index = 0; index < testFiles.length; index += 1) {
  console.log(` - ${testFiles[index]}`);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
