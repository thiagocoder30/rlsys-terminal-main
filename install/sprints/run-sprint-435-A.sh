#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — RESTORE ARTIFACT LOADER
# Sprint 435-A
# =========================================================
# Objective:
# - Validate existence of export bundle
# - Validate critical artifacts
# - Prepare active restore layer
# - Generate restore artifact report
# - Non-destructive operation
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
DATE_TAG="$(date +%F)"

BUNDLE_DIR="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

REPORT="$ROOT/install/sprints/flags/RESTORE_ARTIFACT_LOADER_REPORT.json"

echo "[435-A] STARTING RESTORE ARTIFACT LOADER"

if [ ! -d "$BUNDLE_DIR" ]; then

    echo "[435-A] Bundle not found"
    echo "435-A RESULT: FAIL (NO_BUNDLE)"
    exit 1

fi

REQUIRED=(
"RL_SYS_PROJECT_STATE.json"
"RL_SYS_RUNTIME_STATE.json"
"PROJECT_CONTINUITY_SNAPSHOT.json"
"STATE_MANIFEST.json"
".ssb_signature"
)

FOUND=0
MISSING=0

for FILE in "${REQUIRED[@]}"
do

    if [ -f "$BUNDLE_DIR/$FILE" ]; then

        echo "[435-A] FOUND $FILE"
        FOUND=$((FOUND + 1))

    else

        echo "[435-A] MISSING $FILE"
        MISSING=$((MISSING + 1))

    fi

done

if [ "$MISSING" -eq 0 ]; then
    STATUS="READY_FOR_RESTORE"
else
    STATUS="DEGRADED"
fi

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"RESTORE_ARTIFACT_LOADER_V1",
  "bundle":"$BUNDLE_DIR",
  "requiredArtifacts":${#REQUIRED[@]},
  "foundArtifacts":$FOUND,
  "missingArtifacts":$MISSING,
  "status":"$STATUS"
}
EOF

echo "[435-A] REPORT GENERATED"
echo "[435-A] STATUS=$STATUS"

echo ""
echo "===================================="
echo "RESTORE ARTIFACT LOADER"
echo "===================================="
echo "FOUND    : $FOUND"
echo "MISSING  : $MISSING"
echo "STATUS   : $STATUS"
echo "===================================="

echo "435-A RESULT: $STATUS"
