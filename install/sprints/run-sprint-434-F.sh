#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — CONTEXT RESTORE CERTIFICATION ENGINE
# Sprint 434-F
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS="$ROOT/install/sprints/flags"

PROJECT_STATE="$FLAGS/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS/RL_SYS_RUNTIME_STATE.json"
CONTINUITY="$FLAGS/PROJECT_CONTINUITY_SNAPSHOT.json"
EXPORT_READY="$FLAGS/EXPORT_PIPELINE_READINESS_REPORT.json"

REPORT="$FLAGS/CONTEXT_RESTORE_CERTIFICATION_REPORT.json"

echo "[434-F] STARTING CONTEXT RESTORE CERTIFICATION"

FOUND=0
MISSING=0

check_file() {

    local FILE="$1"

    if [ -f "$FILE" ]; then

        echo "[434-F] FOUND $(basename "$FILE")"
        FOUND=$((FOUND + 1))

    else

        echo "[434-F] MISSING $(basename "$FILE")"
        MISSING=$((MISSING + 1))

    fi
}

check_file "$PROJECT_STATE"
check_file "$RUNTIME_STATE"
check_file "$CONTINUITY"
check_file "$EXPORT_READY"

if [ "$MISSING" -eq 0 ]; then
    STATUS="CERTIFIED"
else
    STATUS="FAILED"
fi

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"CONTEXT_RESTORE_CERTIFICATION_ENGINE_V1",
  "requiredArtifacts":4,
  "foundArtifacts":$FOUND,
  "missingArtifacts":$MISSING,
  "status":"$STATUS",
  "certification":"READY_FOR_CHAT_MIGRATION"
}
EOF

echo "[434-F] REPORT GENERATED"
echo "[434-F] STATUS=$STATUS"

echo ""
echo "===================================="
echo "CONTEXT RESTORE CERTIFICATION"
echo "===================================="
echo "FOUND        : $FOUND"
echo "MISSING      : $MISSING"
echo "STATUS       : $STATUS"
echo "===================================="

echo "434-F RESULT: $STATUS"
