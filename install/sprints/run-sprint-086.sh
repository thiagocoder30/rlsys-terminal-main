#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-086-real-soak-runner-script"
COMMIT_MSG="feat(runtime): add real soak runner script"

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

echo "== Sprint 086: Real Soak Runner Script =="
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

mkdir -p scripts
mkdir -p tests
mkdir -p data/soak

cat > scripts/runtime-soak-runner.js <<'JS'
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
JS

cat > tests/runtime-soak-runner-script.test.js <<'JS'
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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
JS

node <<'NODE'
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

if (!pkg.scripts) {
  pkg.scripts = {};
}

pkg.scripts["soak:runtime"] = "node scripts/runtime-soak-runner.js";

fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
NODE

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  package.json \
  package-lock.json \
  scripts/runtime-soak-runner.js \
  tests/runtime-soak-runner-script.test.js \
  install/sprints/run-sprint-086.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 086 real soak runner script"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 086 completed, merged and pushed successfully =="
