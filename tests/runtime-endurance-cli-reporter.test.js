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
