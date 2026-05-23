#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-088-runtime-endurance-report-reader"
COMMIT_MSG="feat(runtime): add endurance report reader and trend analyzer"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 088: Runtime Endurance Report Reader =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/runtime
mkdir -p tests

cat > src/application/runtime/RuntimeEnduranceReportReader.ts <<'TS'
import type {
  RuntimeEnduranceCertification,
  RuntimeEnduranceCertificationEngine,
  RuntimeEnduranceCertificationPolicy,
  RuntimeEnduranceSoakReport,
} from "./RuntimeEnduranceCertificationEngine.js";

export interface RuntimeEnduranceReportSource {
  readonly name: string;
  readonly content: string;
}

export interface RuntimeEnduranceCertifiedReport {
  readonly name: string;
  readonly report: RuntimeEnduranceSoakReport;
  readonly certification: RuntimeEnduranceCertification;
}

export interface RuntimeEnduranceTrendSummary {
  readonly reports: readonly RuntimeEnduranceCertifiedReport[];
  readonly totalReports: number;
  readonly certifiedReports: number;
  readonly failedReports: number;
  readonly warnings: number;
  readonly heapDriftRegression: boolean;
  readonly lagRegression: boolean;
  readonly regressionMessages: readonly string[];
}

/**
 * Parses and validates persisted endurance soak reports.
 *
 * Complexity:
 * - O(n log n), where n is report count, due to chronological sorting.
 * - Memory O(n), because reports are returned for audit/history.
 */
export class RuntimeEnduranceReportReader {
  public readMany(sources: readonly RuntimeEnduranceReportSource[]): RuntimeEnduranceSoakReport[] {
    const reports = sources.map((source) => this.readOne(source));

    return reports.sort((left, right) => left.generatedAtEpochMs - right.generatedAtEpochMs);
  }

  public readOne(source: RuntimeEnduranceReportSource): RuntimeEnduranceSoakReport {
    if (source.name.trim().length === 0) {
      throw new Error("Invalid endurance report source: name cannot be empty.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(source.content);
    } catch (error: unknown) {
      throw new Error(`Invalid endurance report ${source.name}: JSON parsing failed.`);
    }

    return this.validateReport(source.name, parsed);
  }

  private validateReport(name: string, value: unknown): RuntimeEnduranceSoakReport {
    if (typeof value !== "object" || value === null) {
      throw new Error(`Invalid endurance report ${name}: expected object.`);
    }

    const record = value as Record<string, unknown>;
    const result = record.result;

    if (typeof result !== "object" || result === null) {
      throw new Error(`Invalid endurance report ${name}: result must be object.`);
    }

    const resultRecord = result as Record<string, unknown>;

    const report: RuntimeEnduranceSoakReport = {
      generatedAtEpochMs: this.number(name, record.generatedAtEpochMs, "generatedAtEpochMs"),
      durationMs: this.number(name, record.durationMs, "durationMs"),
      result: {
        stable: this.boolean(name, resultRecord.stable, "result.stable"),
        iterations: this.number(name, resultRecord.iterations, "result.iterations"),
        heapDriftBytes: this.number(name, resultRecord.heapDriftBytes, "result.heapDriftBytes"),
        peakEventLoopLagMs: this.number(name, resultRecord.peakEventLoopLagMs, "result.peakEventLoopLagMs"),
        pressureViolations: this.number(name, resultRecord.pressureViolations, "result.pressureViolations"),
      },
    };

    return report;
  }

  private number(name: string, value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid endurance report ${name}: ${field} must be finite and non-negative.`);
    }

    return value;
  }

  private boolean(name: string, value: unknown, field: string): boolean {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid endurance report ${name}: ${field} must be boolean.`);
    }

    return value;
  }
}

/**
 * Certifies historical endurance reports and detects basic regressions.
 *
 * Complexity:
 * - O(n), where n is report count.
 * - Memory O(n), preserving certified reports for audit output.
 */
export class RuntimeEnduranceTrendAnalyzer {
  public constructor(
    private readonly certificationEngine: RuntimeEnduranceCertificationEngine,
  ) {}

  public analyze(
    namedReports: readonly { readonly name: string; readonly report: RuntimeEnduranceSoakReport }[],
    policy: RuntimeEnduranceCertificationPolicy,
  ): RuntimeEnduranceTrendSummary {
    const certifiedReports = namedReports.map((entry): RuntimeEnduranceCertifiedReport => ({
      name: entry.name,
      report: entry.report,
      certification: this.certificationEngine.certify(entry.report, policy),
    }));

    const regressionMessages: string[] = [];
    const heapDriftRegression = this.hasIncreasingTrend(
      certifiedReports.map((entry) => entry.report.result.heapDriftBytes),
    );

    const lagRegression = this.hasIncreasingTrend(
      certifiedReports.map((entry) => entry.report.result.peakEventLoopLagMs),
    );

    if (heapDriftRegression) {
      regressionMessages.push("Heap drift increased monotonically across endurance reports.");
    }

    if (lagRegression) {
      regressionMessages.push("Peak event loop lag increased monotonically across endurance reports.");
    }

    return {
      reports: certifiedReports,
      totalReports: certifiedReports.length,
      certifiedReports: certifiedReports.filter((entry) => entry.certification.status === "CERTIFIED").length,
      failedReports: certifiedReports.filter((entry) => entry.certification.status === "FAILED").length,
      warnings: certifiedReports.filter((entry) => entry.certification.status === "WARNING").length,
      heapDriftRegression,
      lagRegression,
      regressionMessages,
    };
  }

  private hasIncreasingTrend(values: readonly number[]): boolean {
    if (values.length < 3) {
      return false;
    }

    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) {
        return false;
      }
    }

    return true;
  }
}
TS

cat > tests/runtime-endurance-report-reader.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeEnduranceReportReader,
  RuntimeEnduranceTrendAnalyzer,
} = require("../dist/application/runtime/RuntimeEnduranceReportReader.js");
const {
  RuntimeEnduranceCertificationEngine,
} = require("../dist/application/runtime/RuntimeEnduranceCertificationEngine.js");

function report(generatedAtEpochMs, overrides = {}) {
  return {
    generatedAtEpochMs,
    durationMs: 2000,
    result: {
      stable: true,
      iterations: 2000,
      heapDriftBytes: 1000,
      peakEventLoopLagMs: 10,
      pressureViolations: 0,
      ...overrides,
    },
  };
}

function source(name, value) {
  return {
    name,
    content: JSON.stringify(value),
  };
}

function policy() {
  return {
    minimumIterations: 1000,
    minimumDurationMs: 1000,
    maxHeapDriftBytes: 10_000,
    maxPeakEventLoopLagMs: 100,
    maxPressureViolations: 0,
    warningHeapDriftRatio: 0.8,
    warningLagRatio: 0.8,
  };
}

test("reads and sorts endurance reports chronologically", () => {
  const reader = new RuntimeEnduranceReportReader();

  const reports = reader.readMany([
    source("late", report(3000)),
    source("early", report(1000)),
    source("middle", report(2000)),
  ]);

  assert.deepEqual(
    reports.map((entry) => entry.generatedAtEpochMs),
    [1000, 2000, 3000],
  );
});

test("rejects malformed json report", () => {
  const reader = new RuntimeEnduranceReportReader();

  assert.throws(
    () => reader.readOne({ name: "bad", content: "{broken" }),
    /JSON parsing failed/,
  );
});

test("rejects invalid report shape", () => {
  const reader = new RuntimeEnduranceReportReader();

  assert.throws(
    () => reader.readOne(source("invalid", { generatedAtEpochMs: 1 })),
    /result must be object/,
  );
});

test("certifies historical reports", () => {
  const analyzer = new RuntimeEnduranceTrendAnalyzer(
    new RuntimeEnduranceCertificationEngine(),
  );

  const summary = analyzer.analyze([
    { name: "a", report: report(1000) },
    { name: "b", report: report(2000) },
  ], policy());

  assert.equal(summary.totalReports, 2);
  assert.equal(summary.certifiedReports, 2);
  assert.equal(summary.failedReports, 0);
});

test("detects failed historical report", () => {
  const analyzer = new RuntimeEnduranceTrendAnalyzer(
    new RuntimeEnduranceCertificationEngine(),
  );

  const summary = analyzer.analyze([
    { name: "a", report: report(1000) },
    { name: "b", report: report(2000, { stable: false }) },
  ], policy());

  assert.equal(summary.totalReports, 2);
  assert.equal(summary.failedReports, 1);
});

test("detects heap drift monotonic regression", () => {
  const analyzer = new RuntimeEnduranceTrendAnalyzer(
    new RuntimeEnduranceCertificationEngine(),
  );

  const summary = analyzer.analyze([
    { name: "a", report: report(1000, { heapDriftBytes: 100 }) },
    { name: "b", report: report(2000, { heapDriftBytes: 200 }) },
    { name: "c", report: report(3000, { heapDriftBytes: 300 }) },
  ], policy());

  assert.equal(summary.heapDriftRegression, true);
  assert.match(summary.regressionMessages.join(" "), /Heap drift/);
});

test("detects lag monotonic regression", () => {
  const analyzer = new RuntimeEnduranceTrendAnalyzer(
    new RuntimeEnduranceCertificationEngine(),
  );

  const summary = analyzer.analyze([
    { name: "a", report: report(1000, { peakEventLoopLagMs: 10 }) },
    { name: "b", report: report(2000, { peakEventLoopLagMs: 20 }) },
    { name: "c", report: report(3000, { peakEventLoopLagMs: 30 }) },
  ], policy());

  assert.equal(summary.lagRegression, true);
  assert.match(summary.regressionMessages.join(" "), /Peak event loop lag/);
});

test("does not flag trend with fewer than three reports", () => {
  const analyzer = new RuntimeEnduranceTrendAnalyzer(
    new RuntimeEnduranceCertificationEngine(),
  );

  const summary = analyzer.analyze([
    { name: "a", report: report(1000, { heapDriftBytes: 100 }) },
    { name: "b", report: report(2000, { heapDriftBytes: 200 }) },
  ], policy());

  assert.equal(summary.heapDriftRegression, false);
  assert.equal(summary.lagRegression, false);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeEnduranceReportReader.ts \
  tests/runtime-endurance-report-reader.test.js \
  install/sprints/run-sprint-088.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 088 runtime endurance report reader"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 088 completed, merged and pushed successfully =="
