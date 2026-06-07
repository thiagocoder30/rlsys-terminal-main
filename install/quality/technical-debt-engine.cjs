#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function existsFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch (_) {
    return false;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectFiles(rootDir, directories, predicate) {
  const baseDir = rootDir || process.cwd();
  const files = [];

  for (const relativeDirectory of directories) {
    const absoluteRoot = path.join(baseDir, relativeDirectory);

    if (!isDirectory(absoluteRoot)) {
      continue;
    }

    const stack = [absoluteRoot];

    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });

      entries.sort((left, right) => right.name.localeCompare(left.name));

      for (const entry of entries) {
        const absolutePath = path.join(current, entry.name);
        const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (
            relativePath.startsWith('docs/archive') ||
            relativePath === 'node_modules' ||
            relativePath === 'dist' ||
            relativePath === 'coverage'
          ) {
            continue;
          }

          stack.push(absolutePath);
        } else if (entry.isFile() && predicate(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }

  return uniqueSorted(files);
}

function readLines(rootDir, relativePath) {
  try {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8').split(/\r?\n/);
  } catch (_) {
    return [];
  }
}

function countTopLevelLegacyTests(rootDir) {
  const testsRoot = path.join(rootDir, 'tests');

  if (!isDirectory(testsRoot)) {
    return 0;
  }

  return fs
    .readdirSync(testsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js')).length;
}

function countNestedLegacyTests(rootDir) {
  const testsRoot = path.join(rootDir, 'tests');

  if (!isDirectory(testsRoot)) {
    return 0;
  }

  const stack = [testsRoot];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js') && relativePath.split('/').length > 2) {
        count += 1;
      }
    }
  }

  return count;
}

function inspectPackageScripts(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
    const requiredScripts = ['build', 'test', 'test:audit', 'deps:audit', 'arch:audit'];
    const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);

    return Object.freeze({
      valid: true,
      requiredScripts,
      missingScripts,
      scriptCount: Object.keys(scripts).length,
    });
  } catch (_) {
    return Object.freeze({
      valid: false,
      requiredScripts: ['build', 'test', 'test:audit', 'deps:audit', 'arch:audit'],
      missingScripts: ['package.json-invalid'],
      scriptCount: 0,
    });
  }
}

function analyzeTextDebt(rootDir, files) {
  const oversizedFiles = [];
  const longLineFiles = [];
  const todoFiles = [];
  const consoleFiles = [];
  let totalLineCount = 0;
  let longLineCount = 0;
  let todoCount = 0;
  let consoleUsageCount = 0;

  for (const file of files) {
    const lines = readLines(rootDir, file);
    let fileHasLongLine = false;
    let fileHasTodo = false;
    let fileHasConsole = false;

    totalLineCount += lines.length;

    for (const line of lines) {
      if (line.length > 180) {
        longLineCount += 1;
        fileHasLongLine = true;
      }

      if (/\b(TODO|FIXME|HACK)\b/i.test(line)) {
        todoCount += 1;
        fileHasTodo = true;
      }

      if (file.startsWith('src/') && /\bconsole\.(log|warn|error|info|debug)\s*\(/.test(line)) {
        consoleUsageCount += 1;
        fileHasConsole = true;
      }
    }

    if (lines.length > 450) {
      oversizedFiles.push(`${file}:${lines.length}`);
    }

    if (fileHasLongLine) {
      longLineFiles.push(file);
    }

    if (fileHasTodo) {
      todoFiles.push(file);
    }

    if (fileHasConsole) {
      consoleFiles.push(file);
    }
  }

  return Object.freeze({
    totalLineCount,
    longLineCount,
    todoCount,
    consoleUsageCount,
    oversizedFileCount: oversizedFiles.length,
    oversizedFiles: uniqueSorted(oversizedFiles),
    longLineFileCount: longLineFiles.length,
    longLineFiles: uniqueSorted(longLineFiles),
    todoFileCount: todoFiles.length,
    todoFiles: uniqueSorted(todoFiles),
    consoleFileCount: consoleFiles.length,
    consoleFiles: uniqueSorted(consoleFiles),
  });
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createTechnicalDebtSnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const sourceFiles = collectFiles(baseDir, ['src'], (file) => file.endsWith('.js'));
  const institutionalTests = collectFiles(baseDir, ['test'], (file) => file.endsWith('.test.js'));
  const topLevelLegacyTests = countTopLevelLegacyTests(baseDir);
  const nestedLegacyTests = countNestedLegacyTests(baseDir);
  const qualityFiles = collectFiles(baseDir, ['install/quality'], (file) => file.endsWith('.cjs'));
  const governedFiles = uniqueSorted([...sourceFiles, ...institutionalTests, ...qualityFiles]);
  const textDebt = analyzeTextDebt(baseDir, governedFiles);
  const packageScripts = inspectPackageScripts(baseDir);

  const sourceToTestRatio = sourceFiles.length === 0
    ? 0
    : (institutionalTests.length + topLevelLegacyTests) / sourceFiles.length;

  const hardViolations = [];

  if (sourceFiles.length === 0) {
    hardViolations.push('no source files discovered');
  }

  if (institutionalTests.length === 0) {
    hardViolations.push('no institutional tests discovered');
  }

  if (nestedLegacyTests > 0) {
    hardViolations.push(`nested legacy tests still present: ${nestedLegacyTests}`);
  }

  if (!packageScripts.valid) {
    hardViolations.push('package.json invalid');
  }

  if (packageScripts.missingScripts.length > 0) {
    hardViolations.push(`missing governance scripts: ${packageScripts.missingScripts.join(', ')}`);
  }

  const technicalDebtPenalty =
    textDebt.todoCount * 2 +
    textDebt.longLineCount +
    textDebt.oversizedFileCount * 5 +
    textDebt.consoleUsageCount * 4 +
    hardViolations.length * 20;

  const technicalDebtScore = clampScore(100 - technicalDebtPenalty);
  const maintainabilityScore = clampScore(
    100 -
      textDebt.oversizedFileCount * 4 -
      Math.min(25, textDebt.longLineCount) -
      Math.max(0, 2 - sourceToTestRatio) * 10
  );
  const repositoryReadinessScore = clampScore(
    (technicalDebtScore * 0.35) +
      (maintainabilityScore * 0.35) +
      (hardViolations.length === 0 ? 30 : 0)
  );

  return Object.freeze({
    rootDir: baseDir,
    sourceFileCount: sourceFiles.length,
    institutionalTestFileCount: institutionalTests.length,
    topLevelLegacyTestCount: topLevelLegacyTests,
    nestedLegacyTestCount: nestedLegacyTests,
    qualityFileCount: qualityFiles.length,
    governedFileCount: governedFiles.length,
    totalLineCount: textDebt.totalLineCount,
    todoCount: textDebt.todoCount,
    todoFileCount: textDebt.todoFileCount,
    longLineCount: textDebt.longLineCount,
    longLineFileCount: textDebt.longLineFileCount,
    oversizedFileCount: textDebt.oversizedFileCount,
    consoleUsageCount: textDebt.consoleUsageCount,
    sourceToTestRatio,
    packageScriptCount: packageScripts.scriptCount,
    missingScriptCount: packageScripts.missingScripts.length,
    hardViolationCount: hardViolations.length,
    hardViolations,
    technicalDebtScore,
    maintainabilityScore,
    repositoryReadinessScore,
    status: hardViolations.length === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatTechnicalDebtReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Technical Debt Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`TechnicalDebtScore: ${snapshot.technicalDebtScore}`);
  lines.push(`MaintainabilityScore: ${snapshot.maintainabilityScore}`);
  lines.push(`RepositoryReadinessScore: ${snapshot.repositoryReadinessScore}`);
  lines.push(`SourceFileCount: ${snapshot.sourceFileCount}`);
  lines.push(`InstitutionalTestFileCount: ${snapshot.institutionalTestFileCount}`);
  lines.push(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
  lines.push(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);
  lines.push(`QualityFileCount: ${snapshot.qualityFileCount}`);
  lines.push(`GovernedFileCount: ${snapshot.governedFileCount}`);
  lines.push(`TotalLineCount: ${snapshot.totalLineCount}`);
  lines.push(`TodoCount: ${snapshot.todoCount}`);
  lines.push(`LongLineCount: ${snapshot.longLineCount}`);
  lines.push(`OversizedFileCount: ${snapshot.oversizedFileCount}`);
  lines.push(`ConsoleUsageCount: ${snapshot.consoleUsageCount}`);
  lines.push(`SourceToTestRatio: ${snapshot.sourceToTestRatio.toFixed(2)}`);
  lines.push(`PackageScriptCount: ${snapshot.packageScriptCount}`);
  lines.push(`MissingScriptCount: ${snapshot.missingScriptCount}`);
  lines.push(`HardViolationCount: ${snapshot.hardViolationCount}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`AutomaticSuggestionAllowed: ${snapshot.automaticSuggestionAllowed}`);
  lines.push(`AutomaticBetExecutionAllowed: ${snapshot.automaticBetExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.hardViolations.length > 0) {
    lines.push('');
    lines.push('HardViolations:');

    for (const violation of snapshot.hardViolations) {
      lines.push(` - ${violation}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const snapshot = createTechnicalDebtSnapshot(process.cwd());
  process.stdout.write(formatTechnicalDebtReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  analyzeTextDebt,
  clampScore,
  collectFiles,
  createTechnicalDebtSnapshot,
  formatTechnicalDebtReport,
  inspectPackageScripts,
  uniqueSorted,
};
