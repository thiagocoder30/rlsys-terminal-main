#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function existsPath(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function runGit(rootDir, args) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return '';
  }
}

function listTrackedFiles(rootDir) {
  const output = runGit(rootDir, ['ls-files']);

  return uniqueSorted(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function countRecursiveFiles(rootDir, relativeDirectory, matcher) {
  const targetRoot = path.join(rootDir, relativeDirectory);

  if (!isDirectory(targetRoot)) {
    return 0;
  }

  const stack = [targetRoot];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && matcher(path.relative(rootDir, absolutePath))) {
        count += 1;
      }
    }
  }

  return count;
}

function collectNestedLegacyTests(rootDir) {
  const targetRoot = path.join(rootDir, 'tests');

  if (!isDirectory(targetRoot)) {
    return [];
  }

  const stack = [targetRoot];
  const nested = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relative = path.relative(rootDir, absolutePath);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.test.js') &&
        relative.split(path.sep).length > 2
      ) {
        nested.push(relative);
      }
    }
  }

  return uniqueSorted(nested);
}

function isTrackedGeneratedFile(file) {
  const normalized = file.replace(/\\/g, '/');

  if (normalized.startsWith('node_modules/')) return true;
  if (normalized.startsWith('dist/')) return true;
  if (normalized.startsWith('coverage/')) return true;
  if (normalized.startsWith('.nyc_output/')) return true;
  if (normalized.startsWith('logs/')) return true;
  if (normalized.startsWith('artifacts/tmp/')) return true;
  if (normalized.endsWith('.log')) return true;
  if (normalized.endsWith('.tmp')) return true;
  if (normalized.endsWith('.sqlite')) return true;
  if (normalized.endsWith('.db')) return true;
  if (normalized === 'terminal-buffer.log') return true;
  if (normalized === 'vision_log.png') return true;
  if (normalized === 'pacote_rlsys_ts.log') return true;
  if (/^data\/.*\.json$/.test(normalized)) return true;

  return false;
}

function collectTrackedGeneratedFiles(trackedFiles) {
  return trackedFiles.filter(isTrackedGeneratedFile);
}

function collectMissingRequiredFiles(rootDir, requiredFiles) {
  return requiredFiles.filter((file) => !existsPath(path.join(rootDir, file)));
}

function createGovernanceSnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const trackedFiles = listTrackedFiles(baseDir);
  const trackedGeneratedFiles = collectTrackedGeneratedFiles(trackedFiles);
  const nestedLegacyTests = collectNestedLegacyTests(baseDir);

  const requiredFiles = [
    'package.json',
    '.gitignore',
    'install/quality/run-all-tests.cjs',
    'install/quality/test-discovery-governance.cjs',
    'install/quality/parse-node-test-summary.cjs',
    'install/quality/audit-test-discovery.cjs',
    'install/quality/legacy-nested-regression-closure.cjs',
  ];

  const missingRequiredFiles = collectMissingRequiredFiles(baseDir, requiredFiles);

  const sourceJsCount = countRecursiveFiles(baseDir, 'src', (file) => file.endsWith('.js'));
  const institutionalTestCount = countRecursiveFiles(baseDir, 'test', (file) => file.endsWith('.test.js'));
  const topLevelLegacyTestCount = isDirectory(path.join(baseDir, 'tests'))
    ? fs
        .readdirSync(path.join(baseDir, 'tests'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js')).length
    : 0;

  const hardViolationCount =
    trackedGeneratedFiles.length + nestedLegacyTests.length + missingRequiredFiles.length;

  const repositoryGovernanceScore = Math.max(0, 100 - hardViolationCount * 10);

  return Object.freeze({
    rootDir: baseDir,
    trackedFileCount: trackedFiles.length,
    trackedGeneratedFileCount: trackedGeneratedFiles.length,
    trackedGeneratedFiles,
    nestedLegacyTestCount: nestedLegacyTests.length,
    nestedLegacyTests,
    requiredFileCount: requiredFiles.length,
    missingRequiredFileCount: missingRequiredFiles.length,
    missingRequiredFiles,
    sourceJsCount,
    institutionalTestCount,
    topLevelLegacyTestCount,
    hardViolationCount,
    repositoryGovernanceScore,
    status: hardViolationCount === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatGovernanceReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Repository Governance Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`RepositoryGovernanceScore: ${snapshot.repositoryGovernanceScore}`);
  lines.push(`TrackedFileCount: ${snapshot.trackedFileCount}`);
  lines.push(`TrackedGeneratedFileCount: ${snapshot.trackedGeneratedFileCount}`);
  lines.push(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);
  lines.push(`MissingRequiredFileCount: ${snapshot.missingRequiredFileCount}`);
  lines.push(`SourceJsCount: ${snapshot.sourceJsCount}`);
  lines.push(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
  lines.push(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.trackedGeneratedFiles.length > 0) {
    lines.push('');
    lines.push('TrackedGeneratedFiles:');
    for (const file of snapshot.trackedGeneratedFiles) {
      lines.push(` - ${file}`);
    }
  }

  if (snapshot.nestedLegacyTests.length > 0) {
    lines.push('');
    lines.push('NestedLegacyTests:');
    for (const file of snapshot.nestedLegacyTests) {
      lines.push(` - ${file}`);
    }
  }

  if (snapshot.missingRequiredFiles.length > 0) {
    lines.push('');
    lines.push('MissingRequiredFiles:');
    for (const file of snapshot.missingRequiredFiles) {
      lines.push(` - ${file}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const snapshot = createGovernanceSnapshot(process.cwd());
  process.stdout.write(formatGovernanceReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  collectMissingRequiredFiles,
  collectNestedLegacyTests,
  collectTrackedGeneratedFiles,
  createGovernanceSnapshot,
  formatGovernanceReport,
  isTrackedGeneratedFile,
  uniqueSorted,
};
