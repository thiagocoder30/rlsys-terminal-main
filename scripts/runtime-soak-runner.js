const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname } = require("node:path");
const { RuntimeStabilitySoakHarness } = require("../dist/application/runtime/RuntimeStabilitySoakHarness.js");

function parseArgs(argv) {
  const config = {
    iterations: 10000,
    maxHeapDriftBytes: 8 * 1024 * 1024,
    maxPeakEventLoopLagMs: 50,
    forbiddenPressure: "HIGH",
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

function createWorkload() {
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

      return {
        iteration,
        heapUsedBytes: memory.heapUsed,
        eventLoopLagMs,
        pressure: pressureFromHeap(memory.heapUsed, memory.heapTotal),
      };
    },
  };
}

async function main() {
  const config = parseArgs(process.argv);

  const harness = new RuntimeStabilitySoakHarness(createWorkload());

  const startedAtEpochMs = Date.now();

  const result = await harness.run({
    iterations: config.iterations,
    maxHeapDriftBytes: config.maxHeapDriftBytes,
    maxPeakEventLoopLagMs: config.maxPeakEventLoopLagMs,
    forbiddenPressure: config.forbiddenPressure,
  });

  const report = {
    generatedAtEpochMs: Date.now(),
    durationMs: Date.now() - startedAtEpochMs,
    configuration: config,
    result,
  };

  mkdirSync(dirname(config.output), { recursive: true });
  writeFileSync(config.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));

  if (!result.stable) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[RUNTIME SOAK RUNNER] fatal error");
  console.error(error);
  process.exit(1);
});
