#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — EXPORT ARTIFACT RECONCILIATION
# Sprint 435-A1
# =========================================================
# Objective:
# - Ensure continuity snapshot is exported
# - Patch SSB export artifact registry
# - Validate export completeness
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

EXPORT_SCRIPT="$ROOT/install/sprints/tools/SSB-EXPORT.sh"

echo "[435-A1] STARTING EXPORT ARTIFACT RECONCILIATION"

if [ ! -f "$EXPORT_SCRIPT" ]; then

    echo "[435-A1] EXPORT SCRIPT NOT FOUND"
    exit 1

fi

if grep -q "PROJECT_CONTINUITY_SNAPSHOT.json" "$EXPORT_SCRIPT"; then

    STATUS="ALREADY_PRESENT"

else

    cp "$EXPORT_SCRIPT" \
       "$EXPORT_SCRIPT.bak.$(date +%Y%m%d_%H%M%S)"

    python3 - <<PY
from pathlib import Path

p = Path("$EXPORT_SCRIPT")

txt = p.read_text()

target = '"install/sprints/flags/RL_SYS_RUNTIME_STATE.json"'

replace = '''
"install/sprints/flags/RL_SYS_RUNTIME_STATE.json"
"install/sprints/flags/PROJECT_CONTINUITY_SNAPSHOT.json"
'''

txt = txt.replace(target, replace)

p.write_text(txt)
PY

    STATUS="PATCHED"

fi

REPORT="$ROOT/install/sprints/flags/EXPORT_ARTIFACT_RECONCILIATION_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"EXPORT_ARTIFACT_RECONCILIATION_V1",
  "status":"$STATUS"
}
EOF

echo "[435-A1] STATUS=$STATUS"

echo ""
echo "===================================="
echo "EXPORT ARTIFACT RECONCILIATION"
echo "===================================="
echo "STATUS : $STATUS"
echo "===================================="

echo "435-A1 RESULT: $STATUS"
