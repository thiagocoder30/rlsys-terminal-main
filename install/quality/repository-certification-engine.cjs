#!/usr/bin/env node
'use strict';

const { createGovernanceSnapshot } = require('./repository-governance-engine.cjs');
const { createDependencySnapshot } = require('./dependency-governance-engine.cjs');
const { createArchitectureSnapshot } = require('./architecture-governance-engine.cjs');
const { createTechnicalDebtSnapshot } = require('./technical-debt-engine.cjs');

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    auditJsonPath: 'artifacts/dependency-governance/sprint-250-npm-audit.json',
    globalTestTotal: 0,
    globalTestPass: 0,
    globalTestFail: 0,
    oldGlobalTestBaseline: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--audit-json') {
      options.auditJsonPath = argv[index + 1] || options.auditJsonPath;
      index += 1;
    } else if (current === '--global-test-total') {
      options.globalTestTotal = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--global-test-pass') {
      options.globalTestPass = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--global-test-fail') {
      options.globalTestFail = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--old-global-test-baseline') {
      options.oldGlobalTestBaseline = parseNumber(argv[index + 1], 0);
      index += 1;
    }
  }

  return Object.freeze(options);
}

function createCertificationSnapshot(rootDir, options) {
  const baseDir = rootDir || process.cwd();
  const safeOptions = options || {};
  const repository = createGovernanceSnapshot(baseDir);
  const dependency = createDependencySnapshot(baseDir, safeOptions.auditJsonPath);
  const architecture = createArchitectureSnapshot(baseDir);
  const technicalDebt = createTechnicalDebtSnapshot(baseDir);

  const certificationChecks = [
    {
      name: 'RepositoryGovernance',
      pass: repository.status === 'PASS' && repository.repositoryGovernanceScore >= 100,
      score: repository.repositoryGovernanceScore,
    },
    {
      name: 'DependencyGovernance',
      pass:
        dependency.status === 'PASS' &&
        dependency.auditCounts.high === 0 &&
        dependency.auditCounts.critical === 0,
      score: dependency.dependencyGovernanceScore,
    },
    {
      name: 'ArchitectureGovernance',
      pass: architecture.status === 'PASS' && architecture.architectureGovernanceScore >= 100,
      score: architecture.architectureGovernanceScore,
    },
    {
      name: 'TechnicalDebt',
      pass:
        technicalDebt.status === 'PASS' &&
        technicalDebt.hardViolationCount === 0 &&
        technicalDebt.repositoryReadinessScore >= 90,
      score: technicalDebt.repositoryReadinessScore,
    },
    {
      name: 'GlobalTests',
      pass:
        safeOptions.globalTestFail === 0 &&
        safeOptions.globalTestTotal >= safeOptions.oldGlobalTestBaseline &&
        safeOptions.globalTestPass === safeOptions.globalTestTotal,
      score: safeOptions.globalTestFail === 0 ? 100 : 0,
    },
    {
      name: 'PaperOnlyInstitutionalFlags',
      pass:
        repository.paperOnly === true &&
        repository.productionMoneyAllowed === false &&
        repository.liveMoneyAuthorization === false &&
        repository.automaticExecutionAllowed === false &&
        architecture.automaticSuggestionAllowed === true &&
        architecture.automaticBetExecutionAllowed === false &&
        architecture.humanSupervisionRequired === true,
      score: 100,
    },
  ];

  const failedChecks = certificationChecks.filter((check) => !check.pass);
  const averageScore =
    certificationChecks.reduce((sum, check) => sum + Number(check.score || 0), 0) /
    certificationChecks.length;
  const repositoryCertificationScore = Math.round(averageScore);
  const repositoryCertified = failedChecks.length === 0 && repositoryCertificationScore >= 95;
  const paperPlatformReadyCandidate = repositoryCertified;

  return Object.freeze({
    rootDir: baseDir,
    repository,
    dependency,
    architecture,
    technicalDebt,
    certificationChecks: Object.freeze(certificationChecks),
    failedChecks: Object.freeze(failedChecks),
    failedCheckCount: failedChecks.length,
    repositoryCertificationScore,
    repositoryCertified,
    paperPlatformReadyCandidate,
    globalTestTotal: safeOptions.globalTestTotal,
    globalTestPass: safeOptions.globalTestPass,
    globalTestFail: safeOptions.globalTestFail,
    oldGlobalTestBaseline: safeOptions.oldGlobalTestBaseline,
    status: repositoryCertified ? 'CERTIFIED' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatCertificationReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Repository Certification Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`RepositoryCertified: ${snapshot.repositoryCertified}`);
  lines.push(`PaperPlatformReadyCandidate: ${snapshot.paperPlatformReadyCandidate}`);
  lines.push(`RepositoryCertificationScore: ${snapshot.repositoryCertificationScore}`);
  lines.push(`FailedCheckCount: ${snapshot.failedCheckCount}`);
  lines.push(`GlobalTestTotal: ${snapshot.globalTestTotal}`);
  lines.push(`GlobalTestPass: ${snapshot.globalTestPass}`);
  lines.push(`GlobalTestFail: ${snapshot.globalTestFail}`);
  lines.push(`OldGlobalTestBaseline: ${snapshot.oldGlobalTestBaseline}`);
  lines.push(`RepositoryGovernanceScore: ${snapshot.repository.repositoryGovernanceScore}`);
  lines.push(`DependencyGovernanceScore: ${snapshot.dependency.dependencyGovernanceScore}`);
  lines.push(`ArchitectureGovernanceScore: ${snapshot.architecture.architectureGovernanceScore}`);
  lines.push(`TechnicalDebtScore: ${snapshot.technicalDebt.technicalDebtScore}`);
  lines.push(`MaintainabilityScore: ${snapshot.technicalDebt.maintainabilityScore}`);
  lines.push(`RepositoryReadinessScore: ${snapshot.technicalDebt.repositoryReadinessScore}`);
  lines.push(`AuditHigh: ${snapshot.dependency.auditCounts.high}`);
  lines.push(`AuditCritical: ${snapshot.dependency.auditCounts.critical}`);
  lines.push(`AuditModerate: ${snapshot.dependency.auditCounts.moderate}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`AutomaticSuggestionAllowed: ${snapshot.automaticSuggestionAllowed}`);
  lines.push(`AutomaticBetExecutionAllowed: ${snapshot.automaticBetExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);
  lines.push('');
  lines.push('CertificationChecks:');

  for (const check of snapshot.certificationChecks) {
    lines.push(` - ${check.name}: ${check.pass ? 'PASS' : 'FAIL'} (${check.score})`);
  }

  if (snapshot.failedChecks.length > 0) {
    lines.push('');
    lines.push('FailedChecks:');

    for (const check of snapshot.failedChecks) {
      lines.push(` - ${check.name}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = createCertificationSnapshot(process.cwd(), options);
  process.stdout.write(formatCertificationReport(snapshot));

  if (!snapshot.repositoryCertified) {
    process.exit(1);
  }
}

module.exports = {
  createCertificationSnapshot,
  formatCertificationReport,
  parseArgs,
  parseNumber,
};
