#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error && error.message ? error.message : String(error),
    };
  }
}

function countObjectKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 0;
  }

  return Object.keys(value).length;
}

function normalizeAuditCounts(auditJson) {
  const empty = Object.freeze({
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  });

  if (!auditJson || typeof auditJson !== 'object') {
    return empty;
  }

  if (
    auditJson.metadata &&
    auditJson.metadata.vulnerabilities &&
    typeof auditJson.metadata.vulnerabilities === 'object'
  ) {
    const source = auditJson.metadata.vulnerabilities;

    return Object.freeze({
      info: Number(source.info || 0),
      low: Number(source.low || 0),
      moderate: Number(source.moderate || 0),
      high: Number(source.high || 0),
      critical: Number(source.critical || 0),
      total: Number(source.total || 0),
    });
  }

  const vulnerabilities = auditJson.vulnerabilities && typeof auditJson.vulnerabilities === 'object'
    ? Object.values(auditJson.vulnerabilities)
    : [];

  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  for (const item of vulnerabilities) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const severity = String(item.severity || '').toLowerCase();

    if (Object.prototype.hasOwnProperty.call(counts, severity)) {
      counts[severity] += 1;
      counts.total += 1;
    }
  }

  return Object.freeze(counts);
}

function createDependencySnapshot(rootDir, auditJsonPath) {
  const baseDir = rootDir || process.cwd();
  const packagePath = path.join(baseDir, 'package.json');
  const lockPath = path.join(baseDir, 'package-lock.json');
  const resolvedAuditPath = auditJsonPath
    ? path.resolve(baseDir, auditJsonPath)
    : path.join(baseDir, 'artifacts/dependency-governance/npm-audit.json');

  const packageRead = readJsonFile(packagePath);
  const lockRead = readJsonFile(lockPath);
  const auditRead = existsFile(resolvedAuditPath)
    ? readJsonFile(resolvedAuditPath)
    : { ok: false, value: null, error: 'audit json not found' };

  const packageJson = packageRead.ok ? packageRead.value : {};
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const requiredScripts = ['build', 'test', 'test:audit'];
  const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);

  const dependencyCount = countObjectKeys(packageJson.dependencies);
  const devDependencyCount = countObjectKeys(packageJson.devDependencies);
  const optionalDependencyCount = countObjectKeys(packageJson.optionalDependencies);
  const peerDependencyCount = countObjectKeys(packageJson.peerDependencies);
  const auditCounts = normalizeAuditCounts(auditRead.value);
  const policyViolations = [];

  if (!packageRead.ok) {
    policyViolations.push('package.json is invalid or missing');
  }

  if (!lockRead.ok) {
    policyViolations.push('package-lock.json is invalid or missing');
  }

  if (missingScripts.length > 0) {
    policyViolations.push(`missing required npm scripts: ${missingScripts.join(', ')}`);
  }

  if (packageJson.type === 'commonjs') {
    policyViolations.push('package.json must not force type=commonjs');
  }

  if (auditCounts.high > 0) {
    policyViolations.push(`high severity vulnerabilities detected: ${auditCounts.high}`);
  }

  if (auditCounts.critical > 0) {
    policyViolations.push(`critical severity vulnerabilities detected: ${auditCounts.critical}`);
  }

  const hardViolationCount = policyViolations.length;
  const dependencyGovernanceScore = Math.max(
    0,
    100 - hardViolationCount * 20 - auditCounts.moderate * 2 - auditCounts.low
  );

  return Object.freeze({
    rootDir: baseDir,
    packageJsonValid: packageRead.ok,
    packageLockValid: lockRead.ok,
    packageName: packageJson.name || 'UNKNOWN',
    packageVersion: packageJson.version || 'UNKNOWN',
    packageType: packageJson.type || 'unspecified',
    dependencyCount,
    devDependencyCount,
    optionalDependencyCount,
    peerDependencyCount,
    requiredScripts,
    missingScripts,
    auditJsonAvailable: auditRead.ok,
    auditCounts,
    policyViolations,
    hardViolationCount,
    dependencyGovernanceScore,
    status: hardViolationCount === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatDependencyReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Dependency Governance Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`DependencyGovernanceScore: ${snapshot.dependencyGovernanceScore}`);
  lines.push(`PackageName: ${snapshot.packageName}`);
  lines.push(`PackageVersion: ${snapshot.packageVersion}`);
  lines.push(`PackageType: ${snapshot.packageType}`);
  lines.push(`PackageJsonValid: ${snapshot.packageJsonValid}`);
  lines.push(`PackageLockValid: ${snapshot.packageLockValid}`);
  lines.push(`DependencyCount: ${snapshot.dependencyCount}`);
  lines.push(`DevDependencyCount: ${snapshot.devDependencyCount}`);
  lines.push(`OptionalDependencyCount: ${snapshot.optionalDependencyCount}`);
  lines.push(`PeerDependencyCount: ${snapshot.peerDependencyCount}`);
  lines.push(`MissingRequiredScriptCount: ${snapshot.missingScripts.length}`);
  lines.push(`AuditJsonAvailable: ${snapshot.auditJsonAvailable}`);
  lines.push(`AuditInfo: ${snapshot.auditCounts.info}`);
  lines.push(`AuditLow: ${snapshot.auditCounts.low}`);
  lines.push(`AuditModerate: ${snapshot.auditCounts.moderate}`);
  lines.push(`AuditHigh: ${snapshot.auditCounts.high}`);
  lines.push(`AuditCritical: ${snapshot.auditCounts.critical}`);
  lines.push(`AuditTotal: ${snapshot.auditCounts.total}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.policyViolations.length > 0) {
    lines.push('');
    lines.push('PolicyViolations:');

    for (const violation of snapshot.policyViolations) {
      lines.push(` - ${violation}`);
    }
  }

  if (snapshot.auditCounts.moderate > 0 && snapshot.status === 'PASS') {
    lines.push('');
    lines.push('Advisory:');
    lines.push(' - Moderate vulnerabilities detected. Track remediation, but do not block this sprint unless high or critical risk appears.');
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const auditJsonPath = process.argv[2];
  const snapshot = createDependencySnapshot(process.cwd(), auditJsonPath);
  process.stdout.write(formatDependencyReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  countObjectKeys,
  createDependencySnapshot,
  formatDependencyReport,
  normalizeAuditCounts,
  readJsonFile,
};
