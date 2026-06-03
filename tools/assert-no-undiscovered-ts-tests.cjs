'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const outputFile = process.argv[2];

if (!outputFile) {
  console.error('Usage: node tools/assert-no-undiscovered-ts-tests.cjs <output-file>');
  process.exit(1);
}

const tsTests = [];

const walk = (directory) => {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
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
    'RL.SYS CORE — TypeScript Test Debt Closure Audit',
    '',
    tsTests.length === 0 ? 'Status: CLOSED' : 'Status: BLOCKED',
    '',
    `RemainingTsTestCount: ${tsTests.length}`,
    '',
    ...tsTests,
  ].join('\n') + '\n',
  'utf8',
);

console.log(`RL.SYS CORE TS test debt audit written: ${outputFile}`);
console.log(`RL.SYS CORE remaining TS test count: ${tsTests.length}`);

if (tsTests.length > 0) {
  process.exit(1);
}
