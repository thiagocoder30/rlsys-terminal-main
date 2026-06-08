#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="255"
NAME="Institutional Paper Certification Engine"
BRANCH="sprint-255-institutional-paper-certification-engine"
OLD_GLOBAL_TEST_BASELINE="1373"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/institutional-paper-certification \
  install/sprints \
  src/application/runtime \
  test/domain/runtime

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/institutional-paper-certification/sprint-${SPRINT}-parsed-node-test-summary.txt"
CERTIFICATION_REPORT="artifacts/institutional-paper-certification/sprint-${SPRINT}-paper-certification-report.txt"
DEBUG_TAIL_LOG="artifacts/institutional-paper-certification/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/institutional-paper-certification
rm -f src/application/runtime/InstitutionalPaperCertificationEngine.ts
rm -f test/domain/runtime/InstitutionalPaperCertificationEngine.test.js

mkdir -p artifacts/institutional-paper-certification src/application/runtime test/domain/runtime

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Paper Certification Engine"

cat > src/application/runtime/InstitutionalPaperCertificationEngine.ts <<'TS'
import type {
  PaperValidationCampaignReport,
} from './PaperValidationCampaignEngine.js';

export type InstitutionalPaperCertificationStatus =
  | 'PAPER_CERTIFIED'
  | 'PAPER_REVIEW'
  | 'PAPER_BLOCKED';

export type InstitutionalPaperCertificationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'CAMPAIGN_CERTIFIED'
  | 'CAMPAIGN_REVIEW_REQUIRED'
  | 'CAMPAIGN_BLOCKED'
  | 'LOW_CERTIFICATION_SCORE'
  | 'BLOCKED_RATIO_EXCEEDED'
  | 'INSUFFICIENT_CAMPAIGNS'
  | 'NO_LIVE_MONEY_AUTHORIZATION'
  | 'AUTOMATIC_BET_EXECUTION_BLOCKED'
  | 'HUMAN_SUPERVISION_REQUIRED';

export interface InstitutionalPaperCertificationInput {
  readonly certificationId: string;
  readonly generatedAtEpochMs: number;
  readonly campaigns: readonly PaperValidationCampaignReport[];
}

export interface InstitutionalPaperCertificationDecisionCounts {
  readonly paperFavoravel: number;
  readonly observar: number;
  readonly naoUtilizar: number;
}

export interface InstitutionalPaperCertificationReport {
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationStatus;
  readonly generatedAtEpochMs: number;
  readonly campaignCount: number;
  readonly dryRunCount: number;
  readonly certifiedCampaignCount: number;
  readonly reviewCampaignCount: number;
  readonly blockedCampaignCount: number;
  readonly decisionCounts: InstitutionalPaperCertificationDecisionCounts;
  readonly averageReadinessRatio: number;
  readonly averageReviewRatio: number;
  readonly averageBlockedRatio: number;
  readonly certificationScore: number;
  readonly reasons: readonly InstitutionalPaperCertificationReason[];
  readonly operatorSummary: string;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface InstitutionalPaperCertificationFailure {
  readonly code: 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type InstitutionalPaperCertificationResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalPaperCertificationReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalPaperCertificationFailure;
    };

export interface InstitutionalPaperCertificationPolicy {
  readonly minimumCampaigns: number;
  readonly minimumPaperCertifiedScore: number;
  readonly minimumPaperReviewScore: number;
  readonly maximumBlockedRatio: number;
}

const DEFAULT_POLICY: InstitutionalPaperCertificationPolicy = Object.freeze({
  minimumCampaigns: 1,
  minimumPaperCertifiedScore: 0.72,
  minimumPaperReviewScore: 0.48,
  maximumBlockedRatio: 0.5,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

/**
 * Final institutional PAPER certification engine.
 *
 * It consolidates validated PAPER campaigns into a certification report.
 * It never authorizes live money, never enables automatic execution and only
 * confirms supervised PAPER readiness.
 *
 * Complexity:
 * - Time: O(c)
 * - Space: O(1), excluding the input campaigns already held by caller.
 */
export class InstitutionalPaperCertificationEngine {
  private readonly policy: InstitutionalPaperCertificationPolicy;

  public constructor(policy: InstitutionalPaperCertificationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumCampaigns: policy.minimumCampaigns,
      minimumPaperCertifiedScore: policy.minimumPaperCertifiedScore,
      minimumPaperReviewScore: policy.minimumPaperReviewScore,
      maximumBlockedRatio: policy.maximumBlockedRatio,
    });
  }

  public certify(
    input: InstitutionalPaperCertificationInput,
  ): InstitutionalPaperCertificationResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    let dryRunCount = 0;
    let certifiedCampaignCount = 0;
    let reviewCampaignCount = 0;
    let blockedCampaignCount = 0;
    let readinessRatioSum = 0;
    let reviewRatioSum = 0;
    let blockedRatioSum = 0;
    let paperFavoravel = 0;
    let observar = 0;
    let naoUtilizar = 0;

    for (const campaign of input.campaigns) {
      dryRunCount += campaign.dryRunCount;
      readinessRatioSum += campaign.readinessRatio;
      reviewRatioSum += campaign.reviewRatio;
      blockedRatioSum += campaign.blockedRatio;
      paperFavoravel += campaign.decisionCounts.paperFavoravel;
      observar += campaign.decisionCounts.observar;
      naoUtilizar += campaign.decisionCounts.naoUtilizar;

      if (campaign.status === 'CAMPAIGN_CERTIFIED') {
        certifiedCampaignCount += 1;
      } else if (campaign.status === 'CAMPAIGN_REVIEW') {
        reviewCampaignCount += 1;
      } else {
        blockedCampaignCount += 1;
      }
    }

    const campaignCount = input.campaigns.length;
    const averageReadinessRatio = round4(readinessRatioSum / campaignCount);
    const averageReviewRatio = round4(reviewRatioSum / campaignCount);
    const averageBlockedRatio = round4(blockedRatioSum / campaignCount);
    const certifiedCampaignRatio = safeRatio(certifiedCampaignCount, campaignCount);
    const reviewCampaignRatio = safeRatio(reviewCampaignCount, campaignCount);
    const blockedCampaignRatio = safeRatio(blockedCampaignCount, campaignCount);

    const certificationScore = round4(
      Math.max(
        0,
        Math.min(
          1,
          averageReadinessRatio * 0.42 +
            certifiedCampaignRatio * 0.28 +
            (1 - averageBlockedRatio) * 0.2 +
            reviewCampaignRatio * 0.1 -
            blockedCampaignRatio * 0.18,
        ),
      ),
    );

    const status = this.resolveStatus(certificationScore, averageBlockedRatio, blockedCampaignCount);
    const decisionCounts = Object.freeze({
      paperFavoravel,
      observar,
      naoUtilizar,
    });

    const reasons = this.resolveReasons(status, certificationScore, averageBlockedRatio, blockedCampaignCount);

    return {
      ok: true,
      value: Object.freeze({
        certificationId: input.certificationId,
        status,
        generatedAtEpochMs: input.generatedAtEpochMs,
        campaignCount,
        dryRunCount,
        certifiedCampaignCount,
        reviewCampaignCount,
        blockedCampaignCount,
        decisionCounts,
        averageReadinessRatio,
        averageReviewRatio,
        averageBlockedRatio,
        certificationScore,
        reasons: Object.freeze(reasons),
        operatorSummary: this.composeSummary(status, certificationScore, averageReadinessRatio, averageBlockedRatio),
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
    input: InstitutionalPaperCertificationInput,
  ): InstitutionalPaperCertificationFailure | null {
    if (input.certificationId.trim().length === 0) {
      return this.validationFailure('certificationId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.campaigns.length < this.policy.minimumCampaigns) {
      return this.validationFailure(`at least ${this.policy.minimumCampaigns} campaigns are required`);
    }

    const seen = new Set<string>();

    for (const campaign of input.campaigns) {
      if (seen.has(campaign.campaignId)) {
        return this.validationFailure(`duplicated campaignId: ${campaign.campaignId}`);
      }

      seen.add(campaign.campaignId);

      if (campaign.paperOnly !== true) {
        return this.validationFailure(`campaign ${campaign.campaignId} is not PAPER-only`);
      }

      if (
        campaign.productionMoneyAllowed !== false ||
        campaign.liveMoneyAuthorization !== false ||
        campaign.automaticExecutionAllowed !== false ||
        campaign.automaticBetExecutionAllowed !== false ||
        campaign.humanSupervisionRequired !== true
      ) {
        return this.validationFailure(`campaign ${campaign.campaignId} violates institutional PAPER locks`);
      }
    }

    return null;
  }

  private resolveStatus(
    certificationScore: number,
    averageBlockedRatio: number,
    blockedCampaignCount: number,
  ): InstitutionalPaperCertificationStatus {
    if (
      blockedCampaignCount > 0 ||
      averageBlockedRatio > this.policy.maximumBlockedRatio ||
      certificationScore < this.policy.minimumPaperReviewScore
    ) {
      return 'PAPER_BLOCKED';
    }

    if (certificationScore >= this.policy.minimumPaperCertifiedScore) {
      return 'PAPER_CERTIFIED';
    }

    return 'PAPER_REVIEW';
  }

  private resolveReasons(
    status: InstitutionalPaperCertificationStatus,
    certificationScore: number,
    averageBlockedRatio: number,
    blockedCampaignCount: number,
  ): InstitutionalPaperCertificationReason[] {
    const reasons: InstitutionalPaperCertificationReason[] = [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
    ];

    if (status === 'PAPER_CERTIFIED') {
      reasons.push('CAMPAIGN_CERTIFIED');
    }

    if (status === 'PAPER_REVIEW') {
      reasons.push('CAMPAIGN_REVIEW_REQUIRED');
    }

    if (status === 'PAPER_BLOCKED') {
      reasons.push('CAMPAIGN_BLOCKED');
    }

    if (certificationScore < this.policy.minimumPaperCertifiedScore) {
      reasons.push('LOW_CERTIFICATION_SCORE');
    }

    if (blockedCampaignCount > 0 || averageBlockedRatio > this.policy.maximumBlockedRatio) {
      reasons.push('BLOCKED_RATIO_EXCEEDED');
    }

    return reasons;
  }

  private composeSummary(
    status: InstitutionalPaperCertificationStatus,
    certificationScore: number,
    averageReadinessRatio: number,
    averageBlockedRatio: number,
  ): string {
    if (status === 'PAPER_CERTIFIED') {
      return `PAPER_CERTIFIED: certificação institucional PAPER aprovada; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
    }

    if (status === 'PAPER_REVIEW') {
      return `PAPER_REVIEW: certificação exige revisão manual; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
    }

    return `PAPER_BLOCKED: certificação bloqueada defensivamente; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
  }

  private validationFailure(message: string): InstitutionalPaperCertificationFailure {
    return Object.freeze({
      code: 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 255 test"

cat > test/domain/runtime/InstitutionalPaperCertificationEngine.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperValidationCampaignEngine,
} = require('../../../dist/application/runtime/PaperValidationCampaignEngine.js');
const {
  InstitutionalPaperCertificationEngine,
} = require('../../../dist/application/runtime/InstitutionalPaperCertificationEngine.js');

const now = 1760000000000;

function round(sequence, number) {
  return {
    sequence,
    number,
    occurredAtEpochMs: now + sequence * 1000,
  };
}

function dryRun(id, overrides = {}) {
  return {
    dryRunId: `dry-run-${id}`,
    sessionId: `session-${id}`,
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now + id * 10000,
    rounds: [
      round(1, 7),
      round(2, 18),
      round(3, 29),
      round(4, 12),
      round(5, 33),
      round(6, 21),
    ],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    ...overrides,
  };
}

function buildCampaign(id, dryRuns) {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run({
    campaignId: `campaign-${id}`,
    generatedAtEpochMs: now + id * 100000,
    dryRuns,
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('institutional paper certification engine certifies successful PAPER campaigns', () => {
  const campaign = buildCampaign(1, [
    dryRun(1),
    dryRun(2),
    dryRun(3),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('institutional paper certification engine blocks blocked campaigns', () => {
  const campaign = buildCampaign(2, [
    dryRun(4, { certificationApproved: false }),
    dryRun(5, { certificationApproved: false }),
    dryRun(6, { certificationApproved: false }),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-blocked-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_BLOCKED');
  assert.ok(result.value.reasons.includes('CAMPAIGN_BLOCKED'));
});

test('institutional paper certification engine is deterministic for same campaigns', () => {
  const campaign = buildCampaign(3, [
    dryRun(7),
    dryRun(8),
    dryRun(9),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const payload = {
    certificationId: 'paper-certification-idempotent-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  };

  const first = engine.certify(payload);
  const second = engine.certify(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('institutional paper certification engine rejects duplicated campaign ids', () => {
  const campaign = buildCampaign(4, [
    dryRun(10),
    dryRun(11),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-duplicate-255',
    generatedAtEpochMs: now,
    campaigns: [campaign, campaign],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT');
});

test('institutional paper certification engine preserves supervised PAPER-only semantics', () => {
  const campaign = buildCampaign(5, [
    dryRun(12),
    dryRun(13),
    dryRun(14),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-flags-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
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

node --check test/domain/runtime/InstitutionalPaperCertificationEngine.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/runtime/InstitutionalPaperCertificationEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous campaign regression tests"

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
  echo "RL.SYS CORE Institutional Paper Certification Engine Report"
  echo "Status: PASS"
  echo "CertificationEngineFile: src/application/runtime/InstitutionalPaperCertificationEngine.ts"
  echo "CertificationEngineTest: test/domain/runtime/InstitutionalPaperCertificationEngine.test.js"
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
} > "$CERTIFICATION_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/runtime/InstitutionalPaperCertificationEngine.ts \
  test/domain/runtime/InstitutionalPaperCertificationEngine.test.js \
  artifacts/institutional-paper-certification \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(runtime): add institutional paper certification engine"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional paper certification engine"
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
  echo "PreviousCampaignRegressionTests:"
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
  echo "InstitutionalPaperCertificationEngine:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Institutional Paper Certification Engine to consolidate supervised PAPER validation campaigns into PAPER_CERTIFIED, PAPER_REVIEW or PAPER_BLOCKED without live money authorization or automatic bet execution."
  echo
  echo "Complexity:"
  echo "Time: O(c)"
  echo "Space: O(1)"
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
  echo "src/application/runtime/InstitutionalPaperCertificationEngine.ts"
  echo "test/domain/runtime/InstitutionalPaperCertificationEngine.test.js"
  echo
  echo "Reports:"
  echo "$CERTIFICATION_REPORT"
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
