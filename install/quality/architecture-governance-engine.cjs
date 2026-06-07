#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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

function collectFiles(rootDir, relativeDirectory, predicate) {
  const baseDir = rootDir || process.cwd();
  const targetRoot = path.join(baseDir, relativeDirectory);

  if (!isDirectory(targetRoot)) {
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
        continue;
      }

      const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');

      if (entry.isFile() && predicate(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  return uniqueSorted(files);
}

function readTextFile(rootDir, relativePath) {
  try {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  } catch (_) {
    return '';
  }
}

function collectForbiddenInstitutionalFlagViolations(rootDir, files) {
  const violations = [];
  const forbiddenPatterns = [
    {
      name: 'productionMoneyAllowed true assignment',
      pattern: /productionMoneyAllowed\s*[:=]\s*true/g,
    },
    {
      name: 'liveMoneyAuthorization true assignment',
      pattern: /liveMoneyAuthorization\s*[:=]\s*true/g,
    },
    {
      name: 'automaticExecutionAllowed true assignment',
      pattern: /automaticExecutionAllowed\s*[:=]\s*true/g,
    },
    {
      name: 'paperOnly false assignment',
      pattern: /paperOnly\s*[:=]\s*false/g,
    },
  ];

  for (const file of files) {
    const content = readTextFile(rootDir, file);

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(content)) {
        violations.push(`${file}: ${rule.name}`);
      }

      rule.pattern.lastIndex = 0;
    }
  }

  return uniqueSorted(violations);
}

function collectForbiddenDomainDependencyViolations(rootDir, files) {
  const violations = [];
  const domainFiles = files.filter((file) => file.startsWith('src/domain/') && file.endsWith('.js'));
  const forbiddenPatterns = [
    {
      name: 'domain must not depend on install quality tooling',
      pattern: /require\(['"`].*install\/quality/g,
    },
    {
      name: 'domain must not spawn processes',
      pattern: /require\(['"`]child_process['"`]\)/g,
    },
    {
      name: 'domain must not execute shell commands',
      pattern: /\bexecFileSync\b|\bexecSync\b|\bspawnSync\b/g,
    },
  ];

  for (const file of domainFiles) {
    const content = readTextFile(rootDir, file);

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(content)) {
        violations.push(`${file}: ${rule.name}`);
      }

      rule.pattern.lastIndex = 0;
    }
  }

  return uniqueSorted(violations);
}

function collectMissingRequiredArchitectureFiles(rootDir) {
  const requiredFiles = [
    'package.json',
    'package-lock.json',
    'install/quality/run-all-tests.cjs',
    'install/quality/test-discovery-governance.cjs',
    'install/quality/parse-node-test-summary.cjs',
    'install/quality/repository-governance-engine.cjs',
    'install/quality/dependency-governance-engine.cjs',
  ];

  return requiredFiles.filter((file) => !existsPath(path.join(rootDir, file)));
}

function inspectPackageArchitecture(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    return Object.freeze({
      ok: true,
      type: packageJson.type || 'unspecified',
      hasBuildScript: Boolean(packageJson.scripts && packageJson.scripts.build),
      hasTestScript: Boolean(packageJson.scripts && packageJson.scripts.test),
      hasTestAuditScript: Boolean(packageJson.scripts && packageJson.scripts['test:audit']),
      hasDepsAuditScript: Boolean(packageJson.scripts && packageJson.scripts['deps:audit']),
      forcesCommonJs: packageJson.type === 'commonjs',
    });
  } catch (_) {
    return Object.freeze({
      ok: false,
      type: 'invalid',
      hasBuildScript: false,
      hasTestScript: false,
      hasTestAuditScript: false,
      hasDepsAuditScript: false,
      forcesCommonJs: false,
    });
  }
}

function createArchitectureSnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const sourceFiles = collectFiles(baseDir, 'src', (file) => file.endsWith('.js'));
  const qualityFiles = collectFiles(baseDir, 'install/quality', (file) => file.endsWith('.cjs'));
  const institutionalTests = collectFiles(baseDir, 'test', (file) => file.endsWith('.test.js'));
  const legacyTopLevelTests = isDirectory(path.join(baseDir, 'tests'))
    ? fs
        .readdirSync(path.join(baseDir, 'tests'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
        .map((entry) => `tests/${entry.name}`)
    : [];

  /*
   * Important institutional rule:
   * flag drift is enforced on runtime/quality code only.
   * Test files intentionally contain forbidden values to prove defensive gates.
   */
  const flagGovernedFiles = uniqueSorted([...sourceFiles, ...qualityFiles]);
  const allGovernedFiles = uniqueSorted([...sourceFiles, ...qualityFiles, ...institutionalTests, ...legacyTopLevelTests]);

  const institutionalFlagViolations = collectForbiddenInstitutionalFlagViolations(baseDir, flagGovernedFiles);
  const domainDependencyViolations = collectForbiddenDomainDependencyViolations(baseDir, sourceFiles);
  const missingRequiredFiles = collectMissingRequiredArchitectureFiles(baseDir);
  const packageArchitecture = inspectPackageArchitecture(baseDir);

  const packageViolations = [];

  if (!packageArchitecture.ok) {
    packageViolations.push('package.json invalid or unreadable');
  }

  if (packageArchitecture.forcesCommonJs) {
    packageViolations.push('package.json must not force type=commonjs');
  }

  if (!packageArchitecture.hasBuildScript) {
    packageViolations.push('missing build script');
  }

  if (!packageArchitecture.hasTestScript) {
    packageViolations.push('missing test script');
  }

  if (!packageArchitecture.hasTestAuditScript) {
    packageViolations.push('missing test:audit script');
  }

  if (!packageArchitecture.hasDepsAuditScript) {
    packageViolations.push('missing deps:audit script');
  }

  const violations = uniqueSorted([
    ...institutionalFlagViolations,
    ...domainDependencyViolations,
    ...missingRequiredFiles.map((file) => `missing required architecture file: ${file}`),
    ...packageViolations,
  ]);

  const architectureGovernanceScore = Math.max(0, 100 - violations.length * 10);

  return Object.freeze({
    rootDir: baseDir,
    sourceFileCount: sourceFiles.length,
    qualityFileCount: qualityFiles.length,
    institutionalTestCount: institutionalTests.length,
    legacyTopLevelTestCount: legacyTopLevelTests.length,
    governedFileCount: allGovernedFiles.length,
    flagGovernedFileCount: flagGovernedFiles.length,
    institutionalFlagViolationCount: institutionalFlagViolations.length,
    domainDependencyViolationCount: domainDependencyViolations.length,
    missingRequiredFileCount: missingRequiredFiles.length,
    packageViolationCount: packageViolations.length,
    violationCount: violations.length,
    violations,
    packageArchitecture,
    architectureGovernanceScore,
    status: violations.length === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatArchitectureReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Architecture Governance Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`ArchitectureGovernanceScore: ${snapshot.architectureGovernanceScore}`);
  lines.push(`SourceFileCount: ${snapshot.sourceFileCount}`);
  lines.push(`QualityFileCount: ${snapshot.qualityFileCount}`);
  lines.push(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
  lines.push(`LegacyTopLevelTestCount: ${snapshot.legacyTopLevelTestCount}`);
  lines.push(`GovernedFileCount: ${snapshot.governedFileCount}`);
  lines.push(`FlagGovernedFileCount: ${snapshot.flagGovernedFileCount}`);
  lines.push(`InstitutionalFlagViolationCount: ${snapshot.institutionalFlagViolationCount}`);
  lines.push(`DomainDependencyViolationCount: ${snapshot.domainDependencyViolationCount}`);
  lines.push(`MissingRequiredFileCount: ${snapshot.missingRequiredFileCount}`);
  lines.push(`PackageViolationCount: ${snapshot.packageViolationCount}`);
  lines.push(`ViolationCount: ${snapshot.violationCount}`);
  lines.push(`PackageType: ${snapshot.packageArchitecture.type}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`AutomaticSuggestionAllowed: ${snapshot.automaticSuggestionAllowed}`);
  lines.push(`AutomaticBetExecutionAllowed: ${snapshot.automaticBetExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.violations.length > 0) {
    lines.push('');
    lines.push('ArchitectureViolations:');

    for (const violation of snapshot.violations) {
      lines.push(` - ${violation}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const snapshot = createArchitectureSnapshot(process.cwd());
  process.stdout.write(formatArchitectureReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  collectFiles,
  collectForbiddenDomainDependencyViolations,
  collectForbiddenInstitutionalFlagViolations,
  collectMissingRequiredArchitectureFiles,
  createArchitectureSnapshot,
  formatArchitectureReport,
  inspectPackageArchitecture,
  uniqueSorted,
};
