#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="248"
NAME="Institutional Architecture Governance V2"
BRANCH="sprint-248-institutional-architecture-governance"
OLD_GLOBAL_TEST_BASELINE="1338"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/architecture-governance \
  install/quality \
  install/sprints \
  test/domain/quality

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
ARCHITECTURE_REPORT="artifacts/architecture-governance/sprint-${SPRINT}-architecture-governance-report.txt"
SUMMARY_PARSE_LOG="artifacts/architecture-governance/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/architecture-governance/sprint-${SPRINT}-failure-log-tail.txt"

exec > >(tee -a "$LOG_FILE") 2>&1

copy_mobile_logs() {
  if [ -d "/sdcard/Download" ]; then
    cp -f "$LOG_FILE" "/sdcard/Download/sprint-${SPRINT}-${TIMESTAMP}.log" 2>/dev/null || true
    cp -f "$SUCCESS_SUMMARY" "/sdcard/Download/sprint-${SPRINT}-success-summary.txt" 2>/dev/null || true
    cp -f "$FAILURE_SUMMARY" "/sdcard/Download/sprint-${SPRINT}-failure-summary.txt" 2>/dev/null || true
    cp -f "$GLOBAL_TEST_LOG" "/sdcard/Download/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log" 2>/dev/null || true
  fi
}

write_failure_summary() {
  local exit_code="$?"
  tail -220 "$LOG_FILE" > "$DEBUG_TAIL_LOG" 2>/dev/null || true

  {
    echo "========================================"
    echo "RL.SYS CORE — SPRINT FAILURE SUMMARY"
    echo "========================================"
    echo "Sprint: ${SPRINT}"
    echo "Name: ${NAME}"
    echo "Status: FAILURE"
    echo "ExitCode: ${exit_code}"
    echo
    echo "RepositoryRoot:"
    echo "$PROJECT_DIR"
    echo
    echo "HEAD:"
    git rev-parse --short HEAD 2>/dev/null || true
    echo
    echo "Branch:"
    git branch --show-current 2>/dev/null || true
    echo
    echo "GitStatus:"
    git status --short 2>/dev/null || true
    echo
    echo "LogFile:"
    echo "$LOG_FILE"
    echo
    echo "FailureTail:"
    echo "$DEBUG_TAIL_LOG"
    echo
    echo "Timestamp:"
    date -Iseconds
    echo "========================================"
  } > "$FAILURE_SUMMARY"

  copy_mobile_logs
  cat "$FAILURE_SUMMARY" || true
  echo
  cat "$DEBUG_TAIL_LOG" || true
  exit "$exit_code"
}

trap write_failure_summary ERR

extract_summary_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -1 | cut -d '=' -f 2- | tr -d '[:space:]'
}

count_files() {
  local target_dir="$1"
  local pattern="$2"

  if [ -d "$target_dir" ]; then
    find "$target_dir" -name "$pattern" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

count_nested_legacy_tests() {
  if [ -d tests ]; then
    find tests -mindepth 2 -name "*.test.js" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

echo "========================================"
echo "RL.SYS CORE — SPRINT ${SPRINT}"
echo "$NAME"
echo "========================================"
echo "RepositoryRoot: $PROJECT_DIR"

echo
echo "==> Recovery from previous attempts"

git fetch origin main

if [ "$(git branch --show-current || true)" != "main" ]; then
  git checkout main -f
fi

git reset --hard origin/main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
fi

rm -rf artifacts/architecture-governance
rm -f install/quality/architecture-governance-engine.cjs
rm -f test/domain/quality/ArchitectureGovernanceEngine.test.js

mkdir -p artifacts/architecture-governance install/quality test/domain/quality

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Architecture Governance Engine"

cat > install/quality/architecture-governance-engine.cjs <<'NODE'
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
NODE

chmod +x install/quality/architecture-governance-engine.cjs

echo
echo "==> Writing Sprint 248 tests"

cat > test/domain/quality/ArchitectureGovernanceEngine.test.js <<'NODE'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectForbiddenDomainDependencyViolations,
  collectForbiddenInstitutionalFlagViolations,
  createArchitectureSnapshot,
  formatArchitectureReport,
  inspectPackageArchitecture,
} = require('../../../install/quality/architecture-governance-engine.cjs');

function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-arch-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return root;
}

test('architecture governance detects forbidden institutional flag drift in governed runtime code', () => {
  const root = createFixture({
    'src/domain/example/BadEngine.js': `
      const policy = {
        productionMoneyAllowed: true,
        liveMoneyAuthorization: true,
        automaticExecutionAllowed: true,
        paperOnly: false
      };
      module.exports = policy;
    `,
  });

  const violations = collectForbiddenInstitutionalFlagViolations(root, ['src/domain/example/BadEngine.js']);

  assert.equal(violations.length, 4);
  assert.match(violations.join('\n'), /productionMoneyAllowed true/);
  assert.match(violations.join('\n'), /liveMoneyAuthorization true/);
  assert.match(violations.join('\n'), /automaticExecutionAllowed true/);
  assert.match(violations.join('\n'), /paperOnly false/);
});

test('architecture governance allows forbidden values inside tests as defensive fixtures', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());

  assert.equal(snapshot.institutionalFlagViolationCount, 0);
  assert.equal(snapshot.status, 'PASS');
});

test('architecture governance detects forbidden domain dependencies', () => {
  const root = createFixture({
    'src/domain/example/BadEngine.js': `
      const child = require('child_process');
      const tool = require('../../../install/quality/repository-governance-engine.cjs');
      child.execSync('echo bad');
    `,
  });

  const violations = collectForbiddenDomainDependencyViolations(root, ['src/domain/example/BadEngine.js']);

  assert.ok(violations.length >= 2);
  assert.match(violations.join('\n'), /domain must/);
});

test('architecture governance validates current repository clean architecture contract', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());

  assert.equal(snapshot.status, 'PASS');
  assert.equal(snapshot.architectureGovernanceScore, 100);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.equal(snapshot.automaticExecutionAllowed, false);
  assert.equal(snapshot.automaticSuggestionAllowed, true);
  assert.equal(snapshot.automaticBetExecutionAllowed, false);
  assert.equal(snapshot.paperOnly, true);
});

test('architecture governance report is deterministic and audit friendly', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());
  const report = formatArchitectureReport(snapshot);

  assert.match(report, /RL\.SYS CORE Architecture Governance Report/);
  assert.match(report, /Status: PASS/);
  assert.match(report, /ArchitectureGovernanceScore: 100/);
  assert.match(report, /AutomaticSuggestionAllowed: true/);
  assert.match(report, /AutomaticBetExecutionAllowed: false/);
  assert.match(report, /HumanSupervisionRequired: true/);
});

test('package architecture inspection rejects forced commonjs policy', () => {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'commonjs',
      scripts: {
        build: 'echo build',
        test: 'echo test',
      },
    }),
  });

  const inspected = inspectPackageArchitecture(root);

  assert.equal(inspected.ok, true);
  assert.equal(inspected.forcesCommonJs, true);
});
NODE

echo
echo "==> Updating package.json with architecture governance audit script"

node <<'NODE'
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['arch:audit'] = 'node install/quality/architecture-governance-engine.cjs';
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

echo
echo "==> Syntax validation"

node --check install/quality/architecture-governance-engine.cjs
node --check test/domain/quality/ArchitectureGovernanceEngine.test.js

echo
echo "==> Architecture governance report"

node install/quality/architecture-governance-engine.cjs | tee "$ARCHITECTURE_REPORT"

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/ArchitectureGovernanceEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js
node --test test/domain/quality/DependencyGovernanceEngine.test.js

echo
echo "==> Global npm test validation"

npm test | tee "$GLOBAL_TEST_LOG"

echo
echo "==> Parsing global Node test summary"

node install/quality/parse-node-test-summary.cjs "$GLOBAL_TEST_LOG" | tee "$SUMMARY_PARSE_LOG"

GLOBAL_TEST_TOTAL="$(extract_summary_value "GlobalTestTotal" "$SUMMARY_PARSE_LOG")"
GLOBAL_TEST_PASS="$(extract_summary_value "GlobalTestPass" "$SUMMARY_PARSE_LOG")"
GLOBAL_TEST_FAIL="$(extract_summary_value "GlobalTestFail" "$SUMMARY_PARSE_LOG")"

if [ "$GLOBAL_TEST_TOTAL" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_TOTAL" ]; then
  echo "ERROR: Global test total parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_PASS" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_PASS" ]; then
  echo "ERROR: Global test pass parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_FAIL" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_FAIL" ]; then
  echo "ERROR: Global test fail parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_FAIL" != "0" ]; then
  echo "ERROR: Global npm tests reported failures: $GLOBAL_TEST_FAIL"
  exit 1
fi

if [ "$GLOBAL_TEST_TOTAL" -lt "$OLD_GLOBAL_TEST_BASELINE" ]; then
  echo "ERROR: Global test total regressed below baseline ${OLD_GLOBAL_TEST_BASELINE}. Current: ${GLOBAL_TEST_TOTAL}"
  exit 1
fi

echo
echo "==> Git status before commit"

git status --short

git add \
  package.json \
  install/quality/architecture-governance-engine.cjs \
  test/domain/quality/ArchitectureGovernanceEngine.test.js \
  artifacts/architecture-governance \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "chore(governance): add institutional architecture governance"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional architecture governance"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

ARCHITECTURE_SCORE="$(grep -E '^ArchitectureGovernanceScore:' "$ARCHITECTURE_REPORT" | tail -1 | awk '{print $2}' || true)"
ARCHITECTURE_VIOLATION_COUNT="$(grep -E '^ViolationCount:' "$ARCHITECTURE_REPORT" | tail -1 | awk '{print $2}' || true)"

{
  echo "========================================"
  echo "RL.SYS CORE — SPRINT SUCCESS SUMMARY"
  echo "========================================"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Status: SUCCESS"
  echo
  echo "Previous HEAD:"
  echo "$PREVIOUS_HEAD"
  echo
  echo "Base HEAD:"
  echo "$BASE_HEAD"
  echo
  echo "Final HEAD:"
  echo "$FINAL_HEAD"
  echo
  echo "Branch:"
  echo "$BRANCH"
  echo
  echo "Build:"
  echo "PASS"
  echo
  echo "CurrentSprintSpecificTest:"
  echo "PASS"
  echo
  echo "PreviousQualityRegressionTests:"
  echo "PASS"
  echo
  echo "GlobalNpmTests:"
  echo "PASS"
  echo
  echo "OldGlobalTestBaseline:"
  echo "$OLD_GLOBAL_TEST_BASELINE"
  echo
  echo "GlobalTestTotal:"
  echo "$GLOBAL_TEST_TOTAL"
  echo
  echo "GlobalTestPass:"
  echo "$GLOBAL_TEST_PASS"
  echo
  echo "GlobalTestFail:"
  echo "$GLOBAL_TEST_FAIL"
  echo
  echo "SourceJsCount:"
  echo "$SOURCE_JS_COUNT"
  echo
  echo "OfficialTestFileCount:"
  echo "$OFFICIAL_TEST_FILE_COUNT"
  echo
  echo "LegacyTestFileCount:"
  echo "$LEGACY_TEST_FILE_COUNT"
  echo
  echo "LegacyNestedTestCount:"
  echo "$LEGACY_NESTED_TEST_COUNT"
  echo
  echo "ArchitectureGovernance:"
  echo "PASS"
  echo
  echo "ArchitectureGovernanceScore:"
  echo "${ARCHITECTURE_SCORE:-UNKNOWN}"
  echo
  echo "ArchitectureViolationCount:"
  echo "${ARCHITECTURE_VIOLATION_COUNT:-UNKNOWN}"
  echo
  echo "Architecture:"
  echo "Added institutional architecture governance to detect forbidden institutional flag drift in runtime code, prohibited domain dependencies, missing quality infrastructure, and package architecture violations while preserving tests as defensive fixtures and preserving PAPER-only supervised suggestion semantics."
  echo
  echo "Complexity:"
  echo "Time: O(f + r)"
  echo "Space: O(f + r)"
  echo
  echo "Institutional Flags:"
  echo "paperOnly=true"
  echo "productionMoneyAllowed=false"
  echo "liveMoneyAuthorization=false"
  echo "automaticExecutionAllowed=false"
  echo "humanSupervisionRequired=true"
  echo "automaticSuggestionAllowed=true"
  echo "automaticBetExecutionAllowed=false"
  echo
  echo "Files Added/Updated:"
  echo "package.json"
  echo "install/quality/architecture-governance-engine.cjs"
  echo "test/domain/quality/ArchitectureGovernanceEngine.test.js"
  echo
  echo "Reports:"
  echo "$ARCHITECTURE_REPORT"
  echo "$SUMMARY_PARSE_LOG"
  echo
  echo "LogFile:"
  echo "$LOG_FILE"
  echo
  echo "CurrentSprintTestLog:"
  echo "$CURRENT_TEST_LOG"
  echo
  echo "GlobalNpmTestLog:"
  echo "$GLOBAL_TEST_LOG"
  echo
  echo "Timestamp:"
  date -Iseconds
  echo "========================================"
} > "$SUCCESS_SUMMARY"

copy_mobile_logs

cat "$SUCCESS_SUMMARY"

echo
echo "Sprint ${SPRINT} completed successfully."
