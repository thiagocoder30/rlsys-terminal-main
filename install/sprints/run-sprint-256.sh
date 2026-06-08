#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="256"
NAME="Paper Certification Report Exporter"
BRANCH="sprint-256-paper-certification-report-exporter"
OLD_GLOBAL_TEST_BASELINE="1378"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/paper-certification-report-exporter \
  install/sprints \
  src/application/runtime \
  test/domain/runtime

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/paper-certification-report-exporter/sprint-${SPRINT}-parsed-node-test-summary.txt"
EXPORTER_REPORT="artifacts/paper-certification-report-exporter/sprint-${SPRINT}-exporter-report.txt"
DEBUG_TAIL_LOG="artifacts/paper-certification-report-exporter/sprint-${SPRINT}-failure-log-tail.txt"

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
  tail -240 "$LOG_FILE" > "$DEBUG_TAIL_LOG" 2>/dev/null || true

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

rm -rf artifacts/paper-certification-report-exporter
rm -f src/application/runtime/PaperCertificationReportExporter.ts
rm -f test/domain/runtime/PaperCertificationReportExporter.test.js

mkdir -p artifacts/paper-certification-report-exporter src/application/runtime test/domain/runtime

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Paper Certification Report Exporter"

cat > src/application/runtime/PaperCertificationReportExporter.ts <<'TS'
import type {
  InstitutionalPaperCertificationReport,
} from './InstitutionalPaperCertificationEngine.js';

export type PaperCertificationExportFormat =
  | 'TEXT'
  | 'JSON';

export interface PaperCertificationReportExporterInput {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly certification: InstitutionalPaperCertificationReport;
  readonly format: PaperCertificationExportFormat;
}

export interface PaperCertificationJsonExport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationReport['status'];
  readonly certificationScore: number;
  readonly campaignCount: number;
  readonly dryRunCount: number;
  readonly averageReadinessRatio: number;
  readonly averageReviewRatio: number;
  readonly averageBlockedRatio: number;
  readonly decisionCounts: InstitutionalPaperCertificationReport['decisionCounts'];
  readonly reasons: readonly string[];
  readonly operatorSummary: string;
  readonly governance: {
    readonly paperOnly: true;
    readonly productionMoneyAllowed: false;
    readonly liveMoneyAuthorization: false;
    readonly automaticExecutionAllowed: false;
    readonly automaticSuggestionAllowed: true;
    readonly automaticBetExecutionAllowed: false;
    readonly humanSupervisionRequired: true;
  };
}

export interface PaperCertificationReportExporterReport {
  readonly exportId: string;
  readonly format: PaperCertificationExportFormat;
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationReport['status'];
  readonly text: string;
  readonly json: PaperCertificationJsonExport;
  readonly lineCount: number;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperCertificationReportExporterFailure {
  readonly code: 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type PaperCertificationReportExporterResult =
  | {
      readonly ok: true;
      readonly value: PaperCertificationReportExporterReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperCertificationReportExporterFailure;
    };

/**
 * Exports InstitutionalPaperCertificationReport into operator/audit friendly
 * formats without changing certification semantics.
 *
 * Complexity:
 * - Time: O(r), where r is the number of institutional reasons.
 * - Space: O(r), for export lines and reason copy.
 *
 * This exporter is PAPER-only and never authorizes live money or automatic bet
 * execution.
 */
export class PaperCertificationReportExporter {
  public export(
    input: PaperCertificationReportExporterInput,
  ): PaperCertificationReportExporterResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const json = this.toJson(input);
    const lines = this.toTextLines(json);
    const text = lines.join('\n');

    return {
      ok: true,
      value: Object.freeze({
        exportId: input.exportId,
        format: input.format,
        certificationId: input.certification.certificationId,
        status: input.certification.status,
        text,
        json,
        lineCount: lines.length,
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    };
  }

  private validate(
    input: PaperCertificationReportExporterInput,
  ): PaperCertificationReportExporterFailure | null {
    if (input.exportId.trim().length === 0) {
      return this.validationFailure('exportId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.format !== 'TEXT' && input.format !== 'JSON') {
      return this.validationFailure('format must be TEXT or JSON');
    }

    const certification = input.certification;

    if (certification.certificationId.trim().length === 0) {
      return this.validationFailure('certificationId is required');
    }

    if (certification.paperOnly !== true) {
      return this.validationFailure('certification must be PAPER-only');
    }

    if (
      certification.productionMoneyAllowed !== false ||
      certification.liveMoneyAuthorization !== false ||
      certification.automaticExecutionAllowed !== false ||
      certification.automaticBetExecutionAllowed !== false ||
      certification.humanSupervisionRequired !== true
    ) {
      return this.validationFailure('certification violates institutional PAPER locks');
    }

    return null;
  }

  private toJson(input: PaperCertificationReportExporterInput): PaperCertificationJsonExport {
    const certification = input.certification;

    return Object.freeze({
      exportId: input.exportId,
      generatedAtEpochMs: input.generatedAtEpochMs,
      certificationId: certification.certificationId,
      status: certification.status,
      certificationScore: certification.certificationScore,
      campaignCount: certification.campaignCount,
      dryRunCount: certification.dryRunCount,
      averageReadinessRatio: certification.averageReadinessRatio,
      averageReviewRatio: certification.averageReviewRatio,
      averageBlockedRatio: certification.averageBlockedRatio,
      decisionCounts: certification.decisionCounts,
      reasons: Object.freeze([...certification.reasons]),
      operatorSummary: certification.operatorSummary,
      governance: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    });
  }

  private toTextLines(json: PaperCertificationJsonExport): readonly string[] {
    return Object.freeze([
      '========================================',
      'RL.SYS CORE — PAPER CERTIFICATION REPORT',
      '========================================',
      `ExportId: ${json.exportId}`,
      `CertificationId: ${json.certificationId}`,
      `Status: ${json.status}`,
      `CertificationScore: ${json.certificationScore}`,
      '',
      'Campaign Metrics:',
      `CampaignCount: ${json.campaignCount}`,
      `DryRunCount: ${json.dryRunCount}`,
      `AverageReadinessRatio: ${json.averageReadinessRatio}`,
      `AverageReviewRatio: ${json.averageReviewRatio}`,
      `AverageBlockedRatio: ${json.averageBlockedRatio}`,
      '',
      'Decision Distribution:',
      `PAPER_FAVORAVEL: ${json.decisionCounts.paperFavoravel}`,
      `OBSERVAR: ${json.decisionCounts.observar}`,
      `NAO_UTILIZAR: ${json.decisionCounts.naoUtilizar}`,
      '',
      'Institutional Reasons:',
      ...json.reasons.map((reason) => `- ${reason}`),
      '',
      'Governance:',
      `paperOnly=${json.governance.paperOnly}`,
      `productionMoneyAllowed=${json.governance.productionMoneyAllowed}`,
      `liveMoneyAuthorization=${json.governance.liveMoneyAuthorization}`,
      `automaticExecutionAllowed=${json.governance.automaticExecutionAllowed}`,
      `automaticSuggestionAllowed=${json.governance.automaticSuggestionAllowed}`,
      `automaticBetExecutionAllowed=${json.governance.automaticBetExecutionAllowed}`,
      `humanSupervisionRequired=${json.governance.humanSupervisionRequired}`,
      '',
      'Operator Summary:',
      json.operatorSummary,
      '========================================',
    ]);
  }

  private validationFailure(message: string): PaperCertificationReportExporterFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 256 test"

cat > test/domain/runtime/PaperCertificationReportExporter.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperCertificationReportExporter,
} = require('../../../dist/application/runtime/PaperCertificationReportExporter.js');

const now = 1760000000000;

function certification(overrides = {}) {
  return {
    certificationId: 'certification-256',
    status: 'PAPER_CERTIFIED',
    generatedAtEpochMs: now,
    campaignCount: 2,
    dryRunCount: 6,
    certifiedCampaignCount: 2,
    reviewCampaignCount: 0,
    blockedCampaignCount: 0,
    decisionCounts: {
      paperFavoravel: 5,
      observar: 1,
      naoUtilizar: 0,
    },
    averageReadinessRatio: 0.8333,
    averageReviewRatio: 0.1667,
    averageBlockedRatio: 0,
    certificationScore: 0.8421,
    reasons: [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
      'CAMPAIGN_CERTIFIED',
    ],
    operatorSummary: 'PAPER_CERTIFIED: certificação institucional PAPER aprovada.',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
    ...overrides,
  };
}

test('paper certification report exporter produces audit friendly TEXT report', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.exportId, 'export-256');
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.match(result.value.text, /RL\.SYS CORE — PAPER CERTIFICATION REPORT/);
  assert.match(result.value.text, /Status: PAPER_CERTIFIED/);
  assert.match(result.value.text, /automaticBetExecutionAllowed=false/);
});

test('paper certification report exporter produces deterministic JSON export', () => {
  const exporter = new PaperCertificationReportExporter();
  const payload = {
    exportId: 'export-json-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'JSON',
  };

  const first = exporter.export(payload);
  const second = exporter.export(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value.json, second.value.json);
  assert.deepEqual(first.value.text, second.value.text);
});

test('paper certification report exporter rejects empty export id', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: '',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT');
});

test('paper certification report exporter rejects certification with broken PAPER locks', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-broken-lock-256',
    generatedAtEpochMs: now,
    certification: certification({
      automaticBetExecutionAllowed: true,
    }),
    format: 'TEXT',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
});

test('paper certification report exporter preserves supervised PAPER-only semantics', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-flags-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});
JS

echo
echo "==> Syntax validation"

node --check test/domain/runtime/PaperCertificationReportExporter.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/runtime/PaperCertificationReportExporter.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous paper certification regression tests"

node --test test/domain/runtime/InstitutionalPaperCertificationEngine.test.js
node --test test/domain/runtime/PaperValidationCampaignEngine.test.js
node --test test/domain/runtime/PaperRuntimeDryRunHarness.test.js
node --test test/domain/runtime/PaperRuntimePipelineAdapter.test.js
node --test test/domain/pipeline/InstitutionalDecisionPipeline.test.js

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js
node --test test/domain/quality/DependencyGovernanceEngine.test.js
node --test test/domain/quality/ArchitectureGovernanceEngine.test.js
node --test test/domain/quality/TechnicalDebtEngine.test.js
node --test test/domain/quality/RepositoryCertificationEngine.test.js

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

{
  echo "RL.SYS CORE Paper Certification Report Exporter Report"
  echo "Status: PASS"
  echo "ExporterFile: src/application/runtime/PaperCertificationReportExporter.ts"
  echo "ExporterTest: test/domain/runtime/PaperCertificationReportExporter.test.js"
  echo "GlobalTestTotal: $GLOBAL_TEST_TOTAL"
  echo "GlobalTestPass: $GLOBAL_TEST_PASS"
  echo "GlobalTestFail: $GLOBAL_TEST_FAIL"
  echo "PaperOnly: true"
  echo "ProductionMoneyAllowed: false"
  echo "LiveMoneyAuthorization: false"
  echo "AutomaticExecutionAllowed: false"
  echo "AutomaticSuggestionAllowed: true"
  echo "AutomaticBetExecutionAllowed: false"
  echo "HumanSupervisionRequired: true"
} > "$EXPORTER_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/runtime/PaperCertificationReportExporter.ts \
  test/domain/runtime/PaperCertificationReportExporter.test.js \
  artifacts/paper-certification-report-exporter \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(runtime): add paper certification report exporter"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} paper certification report exporter"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_TS_COUNT="$(count_files src '*.ts')"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

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
  echo "PreviousPaperCertificationRegressionTests:"
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
  echo "SourceTsCount:"
  echo "$SOURCE_TS_COUNT"
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
  echo "PaperCertificationReportExporter:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Paper Certification Report Exporter to convert InstitutionalPaperCertificationReport into deterministic TEXT/JSON operator and audit exports without altering certification semantics or enabling automatic bet execution."
  echo
  echo "Complexity:"
  echo "Time: O(r)"
  echo "Space: O(r)"
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
  echo "src/application/runtime/PaperCertificationReportExporter.ts"
  echo "test/domain/runtime/PaperCertificationReportExporter.test.js"
  echo
  echo "Reports:"
  echo "$EXPORTER_REPORT"
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
