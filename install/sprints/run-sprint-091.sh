#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-091-runtime-baseline-cli-certification-command"
COMMIT_MSG="feat(runtime): add baseline certification cli command"

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

echo "== Sprint 091: Runtime Baseline CLI Certification Command =="
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

cat > scripts/runtime-certify-baseline.js <<'JS'
const { readFileSync } = require("node:fs");
const {
  RuntimeBaselinePolicyFactory,
} = require("../dist/application/runtime/RuntimeBaselineCertificationProfile.js");
const {
  RuntimeEnduranceCertificationEngine,
} = require("../dist/application/runtime/RuntimeEnduranceCertificationEngine.js");
const {
  RuntimeEnduranceReportReader,
  RuntimeEnduranceTrendAnalyzer,
} = require("../dist/application/runtime/RuntimeEnduranceReportReader.js");
const {
  RuntimeEnduranceCliReporter,
} = require("../dist/application/runtime/RuntimeEnduranceCliReporter.js");

function parseArgs(argv) {
  const config = {
    profile: "MOBILE_CONSERVATIVE",
    inputs: [],
    compact: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];

    if (key === "--profile") {
      config.profile = String(argv[index + 1]);
      index += 1;
    } else if (key === "--input") {
      config.inputs.push(String(argv[index + 1]));
      index += 1;
    } else if (key === "--compact") {
      config.compact = true;
    }
  }

  return config;
}

function exitCode(status) {
  if (status === "READY") {
    return 0;
  }

  if (status === "WARNING") {
    return 2;
  }

  return 1;
}

function main() {
  const config = parseArgs(process.argv);

  if (config.inputs.length === 0) {
    console.error("[RL.SYS CERTIFY] At least one --input report is required.");
    process.exit(1);
  }

  const factory = new RuntimeBaselinePolicyFactory();
  const profile = factory.create(config.profile);
  const reader = new RuntimeEnduranceReportReader();
  const certificationEngine = new RuntimeEnduranceCertificationEngine();
  const analyzer = new RuntimeEnduranceTrendAnalyzer(certificationEngine);
  const reporter = new RuntimeEnduranceCliReporter();

  const sources = config.inputs.map((input) => ({
    name: input,
    content: readFileSync(input, "utf8"),
  }));

  const reports = reader.readMany(sources);
  const namedReports = reports.map((report, index) => ({
    name: config.inputs[index] ?? `report-${index}`,
    report,
  }));

  const summary = analyzer.analyze(namedReports, profile.policy);
  const rendered = reporter.render(summary, {
    compact: config.compact,
  });

  console.log(`Baseline: ${profile.label}`);
  console.log(`Hardware: ${profile.hardwareClass}`);
  console.log(rendered.text);

  process.exitCode = exitCode(rendered.status);
}

try {
  main();
} catch (error) {
  console.error("[RL.SYS CERTIFY] fatal error");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exit(1);
}
JS

cat > tests/runtime-baseline-cli-certification-command.test.js <<'JS'
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
JS

node <<'NODE'
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

if (!pkg.scripts) {
  pkg.scripts = {};
}

pkg.scripts["certify:runtime"] = "node scripts/runtime-certify-baseline.js";

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
  scripts/runtime-certify-baseline.js \
  tests/runtime-baseline-cli-certification-command.test.js \
  install/sprints/run-sprint-091.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 091 runtime baseline cli certification command"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 091 completed, merged and pushed successfully =="
