const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname } = require("node:path");
const { RuntimeStabilitySoakHarness } = require("../dist/application/runtime/RuntimeStabilitySoakHarness.js");
const { RuntimeSoakPressureCalibration } = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");

function parseArgs(argv) {
  const config = {
    iterations: 10000,
    maxHeapDriftBytes: 8 * 1024 * 1024,
    maxPeakEventLoopLagMs: 50,
    forbiddenPressure: "HIGH",
    warmupIterations: 1000,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 3,
    output: "data/soak/runtime-soak-report.json",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (key === "--iterations") {
      config.iterations = Number(value);
      index += 1;
    } else if (key === "--max-heap-drift-bytes") {
      config.maxHeapDriftBytes = Number(value);
      index += 1;
    } else if (key === "--max-peak-lag-ms") {
      config.maxPeakEventLoopLagMs = Number(value);
      index += 1;
    } else if (key === "--forbidden-pressure") {
      config.forbiddenPressure = String(value);
      index += 1;
    } else if (key === "--warmup-iterations") {
      config.warmupIterations = Number(value);
      index += 1;
    } else if (key === "--allowed-transient-pressure-spikes") {
      config.allowedTransientPressureSpikes = Number(value);
      index += 1;
    } else if (key === "--sustained-pressure-window") {
      config.sustainedPressureWindow = Number(value);
      index += 1;
    } else if (key === "--output") {
      config.output = String(value);
      index += 1;
    }
  }

  return config;
}

function pressureFromHeap(heapUsedBytes, heapTotalBytes) {
  if (heapTotalBytes <= 0) {
    return "LOW";
  }

  const ratio = heapUsedBytes / heapTotalBytes;

  if (ratio >= 0.95) {
    return "CRITICAL";
  }

  if (ratio >= 0.85) {
    return "HIGH";
  }

  if (ratio >= 0.7) {
    return "ELEVATED";
  }

  return "LOW";
}

function createWorkload(pressureSamples) {
  let expectedAtEpochMs = Date.now();

  return {
    async execute(iteration) {
      const before = Date.now();

      // Small deterministic workload. It avoids unbounded allocation.
      let checksum = 2166136261;

      for (let index = 0; index < 64; index += 1) {
        checksum ^= iteration + index;
        checksum = Math.imul(checksum, 16777619);
      }

      if (checksum === 0) {
        process.stdout.write("");
      }

      const memory = process.memoryUsage();
      const observedAtEpochMs = Date.now();
      const eventLoopLagMs = Math.max(0, observedAtEpochMs - expectedAtEpochMs);

      expectedAtEpochMs = before + 1;

      const pressure = pressureFromHeap(memory.heapUsed, memory.heapTotal);

      pressureSamples.push({
        iteration,
        pressure,
      });

      return {
        iteration,
        heapUsedBytes: memory.heapUsed,
        eventLoopLagMs,
        pressure,
      };
    },
  };
}

async function main() {
  const config = parseArgs(process.argv);

  const pressureSamples = [];
  const harness = new RuntimeStabilitySoakHarness(createWorkload(pressureSamples));

  const startedAtEpochMs = Date.now();

  const result = await harness.run({
    iterations: config.iterations,
    maxHeapDriftBytes: config.maxHeapDriftBytes,
    maxPeakEventLoopLagMs: config.maxPeakEventLoopLagMs,
    forbiddenPressure: config.forbiddenPressure,
  });

  const pressureCalibration = new RuntimeSoakPressureCalibration().evaluate(pressureSamples, {
    warmupIterations: config.warmupIterations,
    allowedTransientPressureSpikes: config.allowedTransientPressureSpikes,
    sustainedPressureWindow: config.sustainedPressureWindow,
    forbiddenPressure: config.forbiddenPressure,
  });

  const calibratedResult = {
    ...result,
    stable: result.stable || (
      result.heapDriftBytes <= config.maxHeapDriftBytes
      && result.peakEventLoopLagMs <= config.maxPeakEventLoopLagMs
      && pressureCalibration.stable
    ),
    pressureViolations: pressureCalibration.sustainedPressureViolations,
    transientPressureSpikes: pressureCalibration.transientPressureSpikes,
    ignoredWarmupSamples: pressureCalibration.ignoredWarmupSamples,
  };

  const report = {
    generatedAtEpochMs: Date.now(),
    durationMs: Date.now() - startedAtEpochMs,
    configuration: config,
    pressureCalibration,
    result: calibratedResult,
  };

  mkdirSync(dirname(config.output), { recursive: true });
  writeFileSync(config.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));

  if (!calibratedResult.stable) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[RUNTIME SOAK RUNNER] fatal error");
  console.error(error);
  process.exit(1);
});
