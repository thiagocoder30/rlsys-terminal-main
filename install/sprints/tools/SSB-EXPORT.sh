#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB EXPORT V3.1
# =========================================================
# Objective:
# - Export current RL.SYS state
# - Generate continuity snapshot
# - Generate manifest
# - Generate bundle signature
# - Build import-ready bundle
# - Non-destructive export
# - Deterministic signature generation
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

BASE="/sdcard/Download/RL_SYS/ssb/export"
LOG_BASE="/sdcard/Download/RL_SYS/logs"

DATE_TAG="$(date +%F)"
TIME_TAG="$(date +%H%M%S)"
ISO_TIME="$(date -Iseconds)"

EXPORT_DIR="$BASE/$DATE_TAG"
BUNDLE_DIR="$EXPORT_DIR/FULL_SSB_BUNDLE"

EXPORT_FILE="$EXPORT_DIR/RL_SYS_SSB_EXPORT_$TIME_TAG.txt"
LOG_FILE="$LOG_BASE/SSB_EXPORT_$TIME_TAG.log"

mkdir -p "$EXPORT_DIR"
mkdir -p "$BUNDLE_DIR"
mkdir -p "$LOG_BASE"

log() {
    echo "[SSB-EXPORT] $1" | tee -a "$LOG_FILE"
}

log "START"
log "ROOT=$ROOT"
log "EXPORT_DIR=$EXPORT_DIR"

# =========================================================
# ARTIFACT REGISTRY
# =========================================================

ARTIFACTS=(
"install/sprints/flags/RL_SYS_PROJECT_STATE.json"
"install/sprints/flags/RUNTIME_SYSTEM_SNAPSHOT.json"
"install/sprints/flags/ARCHITECTURE_SNAPSHOT.json"
"install/sprints/flags/RUNTIME_CONVERGENCE_REPORT.json"
"install/sprints/flags/RUNTIME_EXECUTION_DECISION_REPORT.json"
"install/sprints/flags/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
"install/sprints/flags/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
"install/sprints/flags/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"
"install/sprints/flags/STRATEGY_TOPOLOGY_GRAPH.json"
"install/sprints/flags/REAL_STRATEGY_DEPENDENCY_GRAPH.json"
"install/sprints/flags/SYSTEM_INTEGRITY_REPORT.json"

"install/sprints/flags/RL_SYS_RUNTIME_STATE.json"
"install/sprints/flags/PROJECT_CONTINUITY_SNAPSHOT.json"

)

# =========================================================
# READ CURRENT PROJECT STATE
# =========================================================

PROJECT_STATE="$ROOT/install/sprints/flags/RL_SYS_PROJECT_STATE.json"

CURRENT_SPRINT="UNKNOWN"
CURRENT_PHASE="UNKNOWN"

if [ -f "$PROJECT_STATE" ]; then

    CURRENT_SPRINT=$(
        grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_STATE" \
        | head -1 \
        | cut -d'"' -f4 || true
    )

    CURRENT_PHASE=$(
        grep -o '"phase"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_STATE" \
        | head -1 \
        | cut -d'"' -f4 || true
    )

fi

[ -z "$CURRENT_SPRINT" ] && CURRENT_SPRINT="UNKNOWN"
[ -z "$CURRENT_PHASE" ] && CURRENT_PHASE="UNKNOWN"

# =========================================================
# CONTINUITY SNAPSHOT
# =========================================================

cat > "$BUNDLE_DIR/RL_SYS_CHAT_CONTINUITY.json" <<EOF
{
  "generatedAt":"$ISO_TIME",
  "currentSprint":"$CURRENT_SPRINT",
  "phase":"$CURRENT_PHASE",
  "status":"ACTIVE",
  "engine":"SSB_EXPORT_V3.1"
}
EOF

log "Continuity snapshot generated"

# =========================================================
# COPY ARTIFACTS
# =========================================================

FOUND=0
MISSING=0

for file in "${ARTIFACTS[@]}"
do

    SRC="$ROOT/$file"

    if [ -f "$SRC" ]; then
        cp "$SRC" "$BUNDLE_DIR/"
        FOUND=$((FOUND + 1))
    else
        log "WARN missing artifact: $file"
        MISSING=$((MISSING + 1))
    fi

done

log "Artifacts copied"

# =========================================================
# MANIFEST
# =========================================================

FILE_COUNT=$(find "$BUNDLE_DIR" -maxdepth 1 -type f | wc -l)

cat > "$BUNDLE_DIR/STATE_MANIFEST.json" <<EOF
{
  "generatedAt":"$ISO_TIME",
  "engine":"SSB_EXPORT_V3.1",
  "bundlePath":"$BUNDLE_DIR",
  "currentSprint":"$CURRENT_SPRINT",
  "phase":"$CURRENT_PHASE",
  "artifactCount":$FILE_COUNT,
  "copiedArtifacts":$FOUND,
  "missingArtifacts":$MISSING
}
EOF

log "Manifest generated"

# =========================================================
# SIGNATURE
# =========================================================

rm -f "$BUNDLE_DIR/.ssb_signature"

SIGNATURE=$(
find "$BUNDLE_DIR" \
    -maxdepth 1 \
    -type f \
    ! -name ".ssb_signature" \
    -exec md5sum {} \; \
    | sort \
    | md5sum \
    | awk '{print $1}'
)

echo "$SIGNATURE" > "$BUNDLE_DIR/.ssb_signature"

log "Bundle signature generated: $SIGNATURE"

# =========================================================
# HUMAN READABLE EXPORT
# =========================================================

echo "{ \"generatedAt\":\"$ISO_TIME\", \"engine\":\"SSB_EXPORT_V3.1\" }" > "$EXPORT_FILE"

for file in "${ARTIFACTS[@]}"
do

    SRC="$ROOT/$file"

    if [ -f "$SRC" ]; then
        echo "" >> "$EXPORT_FILE"
        echo "===== $file =====" >> "$EXPORT_FILE"
        cat "$SRC" >> "$EXPORT_FILE"
    fi

done

echo "" >> "$EXPORT_FILE"
echo "===== RL_SYS_CHAT_CONTINUITY.json =====" >> "$EXPORT_FILE"
cat "$BUNDLE_DIR/RL_SYS_CHAT_CONTINUITY.json" >> "$EXPORT_FILE"

echo "" >> "$EXPORT_FILE"
echo "===== STATE_MANIFEST.json =====" >> "$EXPORT_FILE"
cat "$BUNDLE_DIR/STATE_MANIFEST.json" >> "$EXPORT_FILE"

echo "" >> "$EXPORT_FILE"
echo "===== METADATA =====" >> "$EXPORT_FILE"
echo "DATE=$DATE_TAG" >> "$EXPORT_FILE"
echo "TIME=$TIME_TAG" >> "$EXPORT_FILE"
echo "SPRINT=$CURRENT_SPRINT" >> "$EXPORT_FILE"
echo "PHASE=$CURRENT_PHASE" >> "$EXPORT_FILE"

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "EXPORT_FILE=$EXPORT_FILE"
log "BUNDLE_DIR=$BUNDLE_DIR"
log "COMPLETE"

echo ""
echo "===================================="
echo "RL.SYS SSB EXPORT COMPLETE"
echo "SPRINT : $CURRENT_SPRINT"
echo "PHASE  : $CURRENT_PHASE"
echo "FILES  : $FILE_COUNT"
echo "===================================="
