#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

BASE_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

STATE_FILE="$BASE_DIR/STATE_OF_RL_SYS.json"
ARCH_FILE="$BASE_DIR/ARCHITECTURE_SNAPSHOT.json"
REPORT="$BASE_DIR/SYSTEM_INTEGRITY_REPORT.json"

LOG="$LOG_DIR/sprint-000-c-integrity_$TS.log"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "SPRINT 000-C SYSTEM INTEGRITY GUARD START"

cd "$ROOT"

# -----------------------------
# LOAD FILES
# -----------------------------

if [ ! -f "$STATE_FILE" ]; then
  echo "STATE FILE MISSING" >&2
  exit 1
fi

if [ ! -f "$ARCH_FILE" ]; then
  echo "ARCH FILE MISSING" >&2
  exit 1
fi

STATE=$(cat "$STATE_FILE")
ARCH=$(cat "$ARCH_FILE")

# -----------------------------
# VALIDATION ENGINE (NODE)
# -----------------------------

node <<EOF
const fs = require('fs');

const state = JSON.parse(fs.readFileSync('$STATE_FILE','utf8'));
const arch = JSON.parse(fs.readFileSync('$ARCH_FILE','utf8'));

const report = {
  system: "RL.SYS CORE",
  timestamp: new Date().toISOString(),
  integrity: {
    status: "UNKNOWN",
    checks: []
  }
};

// CHECK 1 - CORE MODULES EXISTENCE
const requiredModules = [
  "RuntimeKernel",
  "RuntimeShutdownCoordinator",
  "JsonLinesReplayRepository"
];

const missingCore = requiredModules.filter(m =>
  !(arch.core_modules || []).includes(m)
);

if (missingCore.length === 0) {
  report.integrity.checks.push({
    name: "CORE_MODULES",
    status: "PASS"
  });
} else {
  report.integrity.checks.push({
    name: "CORE_MODULES",
    status: "FAIL",
    missing: missingCore
  });
}

// CHECK 2 - STRUCTURE CONSISTENCY
if (arch.structure && state.system) {
  report.integrity.checks.push({
    name: "STRUCTURE_BINDING",
    status: "PASS"
  });
} else {
  report.integrity.checks.push({
    name: "STRUCTURE_BINDING",
    status: "FAIL"
  });
}

// CHECK 3 - ARCH VS STATE ALIGNMENT
if (state.phase && arch.project) {
  report.integrity.checks.push({
    name: "STATE_ARCH_ALIGNMENT",
    status: "PASS"
  });
} else {
  report.integrity.checks.push({
    name: "STATE_ARCH_ALIGNMENT",
    status: "FAIL"
  });
}

// FINAL STATUS
const failed = report.integrity.checks.filter(c => c.status === "FAIL");

report.integrity.status = failed.length === 0 ? "PASS" : "DEGRADED";

fs.writeFileSync('$REPORT', JSON.stringify(report, null, 2));

console.log("INTEGRITY REPORT GENERATED");
console.log("STATUS:", report.integrity.status);
EOF

log "INTEGRITY CHECK COMPLETE"

echo ""
echo "=============================="
echo "PASS SYSTEM INTEGRITY GUARD EXECUTED"
echo "REPORT: $REPORT"
echo "=============================="
