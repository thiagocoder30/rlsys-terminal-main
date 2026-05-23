const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

test("runtime soak runner writes stable json report", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-soak-runner-"));
  const output = join(dir, "report.json");

  try {
    execFileSync("node", [
      "scripts/runtime-soak-runner.js",
      "--iterations",
      "5",
      "--max-heap-drift-bytes",
      String(64 * 1024 * 1024),
      "--max-peak-lag-ms",
      "1000",
      "--forbidden-pressure",
      "CRITICAL",
      "--warmup-iterations",
      "1",
      "--allowed-transient-pressure-spikes",
      "1",
      "--sustained-pressure-window",
      "2",
      "--output",
      output,
    ], {
      encoding: "utf8",
    });

    const report = JSON.parse(readFileSync(output, "utf8"));

    assert.equal(report.result.iterations, 5);
    assert.equal(typeof report.result.heapDriftBytes, "number");
    assert.equal(typeof report.result.peakEventLoopLagMs, "number");
    assert.equal(Array.isArray(report.result.violationMessages), true);
    assert.equal(typeof report.result.transientPressureSpikes, "number");
    assert.equal(typeof report.result.ignoredWarmupSamples, "number");
    assert.equal(typeof report.pressureCalibration.stable, "boolean");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
