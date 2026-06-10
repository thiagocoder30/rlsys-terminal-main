#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');
const distRoot = path.join(repoRoot, 'dist');

function fail(message) {
  console.error(`CLEAN_BUILD_ARTIFACT_GUARD_FAIL: ${message}`);
  process.exit(1);
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) {
    return output;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, output);
    } else if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
      output.push(fullPath);
    }
  }

  return output;
}

if (!fs.existsSync(srcRoot)) {
  fail('src directory not found');
}

if (!fs.existsSync(distRoot)) {
  fail('dist directory not found; run npm run build before this guard');
}

const tsFiles = walk(srcRoot);
const missing = [];

for (const sourceFile of tsFiles) {
  const relative = path.relative(srcRoot, sourceFile);
  const expectedDist = path.join(distRoot, relative.replace(/\.ts$/, '.js'));

  if (!fs.existsSync(expectedDist)) {
    missing.push(path.relative(repoRoot, expectedDist));
  }
}

if (missing.length > 0) {
  console.error('Missing dist artifacts generated from TypeScript sources:');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  fail(`${missing.length} missing dist artifact(s)`);
}

console.log(`CLEAN_BUILD_ARTIFACT_GUARD_OK: ${tsFiles.length} TypeScript source artifact(s) verified.`);
