const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

function makeReport(overrides = {}) {
  return {
    generatedAtEpochMs: 1000,
    durationMs: 120000,
    result: {
      stable: true,
      iterations: 100000,
      heapDriftBytes: 1024,
      peakEventLoopLagMs: 20,
      pressureViolations: 0,
      ...overrides,
    },
  };
}

test("certifies baseline reports with ready exit code", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-certify-"));
  const reportPath = join(dir, "report.json");

  try {
    writeFileSync(reportPath, JSON.stringify(makeReport()), "utf8");

    const output = execFileSync("node", [
      "scripts/runtime-certify-baseline.js",
      "--profile",
      "MOBILE_BALANCED",
      "--input",
      reportPath,
      "--compact",
    ], {
      encoding: "utf8",
    });

    assert.match(output, /Baseline:/);
    assert.match(output, /ENDURANCE READY/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("returns failure exit code when report fails certification", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-certify-fail-"));
  const reportPath = join(dir, "report.json");

  try {
    writeFileSync(reportPath, JSON.stringify(makeReport({
      stable: false,
      heapDriftBytes: 999999999,
    })), "utf8");

    const result = spawnSync("node", [
      "scripts/runtime-certify-baseline.js",
      "--profile",
      "MOBILE_BALANCED",
      "--input",
      reportPath,
      "--compact",
    ], {
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stdout, /ENDURANCE FAILED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("requires at least one input", () => {
  const result = spawnSync("node", [
    "scripts/runtime-certify-baseline.js",
    "--profile",
    "MOBILE_BALANCED",
  ], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /At least one --input/);
});
