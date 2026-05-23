#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-089-runtime-endurance-cli-reporter"
COMMIT_MSG="feat(runtime): add endurance cli reporter"

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

echo "== Sprint 089: Runtime Endurance CLI Reporter =="
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

cat > src/application/runtime/RuntimeEnduranceCliReporter.ts <<'TS'
import type {
  RuntimeEnduranceTrendSummary,
} from "./RuntimeEnduranceReportReader.js";

export interface RuntimeEnduranceCliReportOptions {
  readonly width?: number;
  readonly compact?: boolean;
}

export interface RuntimeEnduranceCliReport {
  readonly text: string;
  readonly lineCount: number;
  readonly status: "READY" | "WARNING" | "FAILED" | "NO_DATA";
}

/**
 * Renders human-readable endurance trend summaries for terminal operation.
 *
 * This renderer is pure and side-effect free. It is suitable for tmux panes,
 * CLI output and future cockpit dashboards.
 *
 * Complexity:
 * - O(n), where n is the number of certified reports rendered in detail.
 * - Memory O(n) for output lines.
 */
export class RuntimeEnduranceCliReporter {
  public render(
    summary: RuntimeEnduranceTrendSummary,
    options: RuntimeEnduranceCliReportOptions = {},
  ): RuntimeEnduranceCliReport {
    const status = this.status(summary);

    if (options.compact === true) {
      const text = [
        `ENDURANCE ${status}`,
        `reports=${summary.totalReports} certified=${summary.certifiedReports} warnings=${summary.warnings} failed=${summary.failedReports}`,
        `heapRegression=${summary.heapDriftRegression ? "YES" : "NO"} lagRegression=${summary.lagRegression ? "YES" : "NO"}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
        status,
      };
    }

    const width = Math.max(56, Math.min(options.width ?? 76, 100));
    const border = "─".repeat(width - 2);
    const lines: string[] = [];

    lines.push(`┌${border}┐`);
    lines.push(this.row("RL.SYS CORE — ENDURANCE CERTIFICATION REPORT", width));
    lines.push(`├${border}┤`);
    lines.push(this.row(`Status            : ${status}`, width));
    lines.push(this.row(`Total Reports     : ${summary.totalReports}`, width));
    lines.push(this.row(`Certified Reports : ${summary.certifiedReports}`, width));
    lines.push(this.row(`Warnings          : ${summary.warnings}`, width));
    lines.push(this.row(`Failed Reports    : ${summary.failedReports}`, width));
    lines.push(this.row(`Heap Regression   : ${summary.heapDriftRegression ? "YES" : "NO"}`, width));
    lines.push(this.row(`Lag Regression    : ${summary.lagRegression ? "YES" : "NO"}`, width));

    if (summary.regressionMessages.length > 0) {
      lines.push(`├${border}┤`);
      for (const message of summary.regressionMessages) {
        lines.push(this.row(`Regression: ${message}`, width));
      }
    }

    if (summary.reports.length > 0) {
      lines.push(`├${border}┤`);

      for (const report of summary.reports) {
        lines.push(this.row(
          `${report.name}: ${report.certification.status} score=${report.certification.score}`,
          width,
        ));
      }
    }

    lines.push(`└${border}┘`);

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
      status,
    };
  }

  private status(summary: RuntimeEnduranceTrendSummary): "READY" | "WARNING" | "FAILED" | "NO_DATA" {
    if (summary.totalReports === 0) {
      return "NO_DATA";
    }

    if (summary.failedReports > 0 || summary.heapDriftRegression || summary.lagRegression) {
      return "FAILED";
    }

    if (summary.warnings > 0) {
      return "WARNING";
    }

    return "READY";
  }

  private row(content: string, width: number): string {
    const maxContentLength = width - 4;
    const visible = content.length > maxContentLength
      ? content.slice(0, maxContentLength - 1)
      : content;

    return `│ ${visible.padEnd(maxContentLength, " ")} │`;
  }
}
TS

cat > tests/runtime-endurance-cli-reporter.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeEnduranceCliReporter,
} = require("../dist/application/runtime/RuntimeEnduranceCliReporter.js");

function summary(overrides = {}) {
  return {
    reports: [
      {
        name: "soak-a.json",
        report: {
          generatedAtEpochMs: 1000,
          durationMs: 2000,
          result: {
            stable: true,
            iterations: 1000,
            heapDriftBytes: 100,
            peakEventLoopLagMs: 10,
            pressureViolations: 0,
          },
        },
        certification: {
          status: "CERTIFIED",
          certified: true,
          score: 100,
          reasons: ["ok"],
        },
      },
    ],
    totalReports: 1,
    certifiedReports: 1,
    failedReports: 0,
    warnings: 0,
    heapDriftRegression: false,
    lagRegression: false,
    regressionMessages: [],
    ...overrides,
  };
}

test("renders ready endurance report", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary(), { width: 72 });

  assert.equal(report.status, "READY");
  assert.match(report.text, /ENDURANCE CERTIFICATION REPORT/);
  assert.match(report.text, /Certified Reports/);
  assert.match(report.text, /soak-a\.json: CERTIFIED score=100/);
});

test("renders compact endurance report", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary(), { compact: true });

  assert.equal(report.lineCount, 3);
  assert.match(report.text, /ENDURANCE READY/);
  assert.match(report.text, /reports=1/);
});

test("returns no data status when no reports exist", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary({
    reports: [],
    totalReports: 0,
    certifiedReports: 0,
  }));

  assert.equal(report.status, "NO_DATA");
});

test("returns warning status when warnings exist", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary({
    warnings: 1,
  }));

  assert.equal(report.status, "WARNING");
});

test("returns failed status when failed reports exist", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary({
    failedReports: 1,
  }));

  assert.equal(report.status, "FAILED");
});

test("returns failed status when regression exists", () => {
  const reporter = new RuntimeEnduranceCliReporter();

  const report = reporter.render(summary({
    heapDriftRegression: true,
    regressionMessages: ["Heap drift increased monotonically across endurance reports."],
  }));

  assert.equal(report.status, "FAILED");
  assert.match(report.text, /Regression/);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeEnduranceCliReporter.ts \
  tests/runtime-endurance-cli-reporter.test.js \
  install/sprints/run-sprint-089.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 089 runtime endurance cli reporter"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 089 completed, merged and pushed successfully =="
