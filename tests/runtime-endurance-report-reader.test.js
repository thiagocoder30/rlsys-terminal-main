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
