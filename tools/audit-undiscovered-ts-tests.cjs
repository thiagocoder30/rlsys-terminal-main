'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const outputFile = process.argv[2];

if (!outputFile) {
  console.error('Usage: node tools/audit-undiscovered-ts-tests.cjs <output-file>');
  process.exit(1);
}

const tsTests = [];

const walk = (directory) => {
  if (!fs.existsSync(directory)) return;

  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'artifacts', 'logs', 'coverage'].includes(entry.name)) {
        walk(absolutePath);
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      tsTests.push(path.relative(rootDir, absolutePath));
    }
  }
};

walk(path.join(rootDir, 'tests'));
tsTests.sort((a, b) => a.localeCompare(b));

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  [
    'RL.SYS CORE — TypeScript Test Discovery Audit',
    '',
    'Status: TRACKED_BY_OFFICIAL_JS_COVERAGE_GUARD',
    'Reason: current official npm test runner discovers root .test.js files; Sprint 232 adds JS coverage guard for Sprint 220–230 TS tests.',
    '',
    `UndiscoveredTsTestCount: ${tsTests.length}`,
    '',
    ...tsTests,
  ].join('\n') + '\n',
  'utf8',
);

console.log(`RL.SYS CORE TS test audit written: ${outputFile}`);
console.log(`RL.SYS CORE TS test audit count: ${tsTests.length}`);
