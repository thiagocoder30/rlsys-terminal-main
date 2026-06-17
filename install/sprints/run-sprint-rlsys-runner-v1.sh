#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

FLAGS_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")
LOG="$LOG_DIR/sprint-runner-v1_$TS.log"

SPRINT="${1:-unknown-sprint}"

log() {
  echo "[$(date +"%H:%M:%S")] [RUNNER] $1" | tee -a "$LOG"
}

log "RL.SYS RUNNER v1 START"
log "SPRINT: $SPRINT"

# ---------------------------------------------------
# FIX PRINCIPAL: respeitar padrão real do repositório
# ---------------------------------------------------

SPRINT_FILE="$ROOT/install/sprints/run-sprint-$SPRINT.sh"

if [ ! -f "$SPRINT_FILE" ]; then
  log "SPRINT NOT FOUND: $SPRINT_FILE"
  exit 1
fi

log "EXECUTING SPRINT FILE: run-sprint-$SPRINT.sh"

bash "$SPRINT_FILE"

# ----------------------------
# LEDGER UPDATE
# ----------------------------

STATE_FILE="$FLAGS_DIR/STATE_OF_RL_SYS.json"

if [ -f "$STATE_FILE" ]; then
  node -e "
  const fs = require('fs');
  const statePath = '$STATE_FILE';
  const state = JSON.parse(fs.readFileSync(statePath,'utf8'));

  state.completed_sprints = state.completed_sprints || [];

  if(!state.completed_sprints.includes('$SPRINT')){
    state.completed_sprints.push('$SPRINT');
  }

  fs.writeFileSync(statePath, JSON.stringify(state,null,2));
  console.log('LEDGER UPDATED');
  "
fi

# ----------------------------
# SNAPSHOT SYNC
# ----------------------------

ARCH_FILE="$FLAGS_DIR/ARCHITECTURE_SNAPSHOT.json"

if [ -f "$ARCH_FILE" ]; then
  node -e "
  const fs = require('fs');
  const p = '$ARCH_FILE';
  const a = JSON.parse(fs.readFileSync(p,'utf8'));
  a.last_updated = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(a,null,2));
  console.log('SNAPSHOT SYNCED');
  "
fi

# ----------------------------
# INTEGRITY CHECK
# ----------------------------

if [ -f "$STATE_FILE" ] && [ -f "$ARCH_FILE" ]; then
  node -e "
  const fs = require('fs');

  const state = JSON.parse(fs.readFileSync('$STATE_FILE','utf8'));
  const arch = JSON.parse(fs.readFileSync('$ARCH_FILE','utf8'));

  const report = {
    system: 'RL.SYS CORE',
    sprint: '$SPRINT',
    timestamp: new Date().toISOString(),
    status: 'UNKNOWN',
    checks: []
  };

  if(state.completed_sprints && arch.core_modules){
    report.checks.push({name:'CORE_LINK', status:'PASS'});
  } else {
    report.checks.push({name:'CORE_LINK', status:'FAIL'});
  }

  report.status = report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'DEGRADED';

  fs.writeFileSync('$FLAGS_DIR/SYSTEM_INTEGRITY_REPORT.json', JSON.stringify(report,null,2));

  console.log('INTEGRITY:', report.status);
  "
fi

log "RL.SYS RUNNER COMPLETE"

echo ""
echo "=============================="
echo "PASS RL.SYS RUNNER v1"
echo "SPRINT: $SPRINT"
echo "=============================="
