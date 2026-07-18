#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-BOOT-MASTER"
echo "UNIFIED CONTEXT RECONSTRUCTOR"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"
BOOT_DIR="/sdcard/Download/RL_SYS/bootstrap"
LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"

mkdir -p "$BOOT_DIR"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-BOOT-MASTER.log"
OUTPUT_FILE="$BOOT_DIR/RL_SYS_MASTER_RECONSTRUCTED_CONTEXT.md"

echo "[1/12] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/12] Scanning architecture state..."

STATE_FILE="$ARCH_DIR/RL_SYS_STATE.json"
TOPOLOGY="$ARCH_DIR/RUNTIME_TOPOLOGY.md"
DOMAIN="$ARCH_DIR/DOMAIN_MAP.md"
DECISION="$ARCH_DIR/RL_SYS_DECISION_CONTINUITY_REPORT.md"
BASELINE="$ARCH_DIR/ARCHITECTURE_BASELINE_V4_5.md"

BOOTSTRAP="$BOOT_DIR/RL_SYS_BOOTSTRAP_CONTEXT_PACKAGE.md"

LATEST_SPRINT=$(ls -t "$ARCH_DIR" | grep -E "R0|SPRINT|REPORT" | head -n 1 || echo "UNKNOWN")

echo "[3/12] Detecting last known sprint..."

echo "LATEST_SPRINT=$LATEST_SPRINT" >> "$LOG_FILE"

echo "[4/12] Loading core files..."

extract() {
  [ -f "$1" ] && cat "$1" || echo "MISSING: $1"
}

echo "[5/12] Building unified system context..."

cat > "$OUTPUT_FILE" << EOF
# RL.SYS CORE - MASTER CONTEXT RECONSTRUCTION

---

## 1. LAST KNOWN SPRINT

$LATEST_SPRINT

---

## 2. SYSTEM STATE

\`\`\`
$(extract "$STATE_FILE")
\`\`\`

---

## 3. ARCHITECTURE TOPOLOGY

\`\`\`
$(extract "$TOPOLOGY")
\`\`\`

---

## 4. DOMAIN MAP

\`\`\`
$(extract "$DOMAIN")
\`\`\`

---

## 5. DECISION CONTINUITY

\`\`\`
$(extract "$DECISION")
\`\`\`

---

## 6. BOOTSTRAP PACKAGE (if exists)

\`\`\`
$(extract "$BOOTSTRAP")
\`\`\`

---

## 7. SYSTEM INTERPRETATION

The RL.SYS CORE is reconstructed from all available state sources.

This enables:

- full session recovery
- sprint continuity restoration
- architecture resumption
- observability chain continuity

---

## 8. CURRENT POSITION

System is assumed to be at:

$LATEST_SPRINT

---

## 9. NEXT ACTION

Ask:

> "Reinstate execution from last sprint and generate next logical sprint."

EOF

echo "[6/12] Calculating completeness score..."

FILES_COUNT=$(ls "$ARCH_DIR" | wc -l)

echo "ARCH_FILES=$FILES_COUNT" >> "$LOG_FILE"

echo "[7/12] Validating bootstrap presence..."

if [ -f "$BOOTSTRAP" ]; then
  echo "BOOTSTRAP_STATUS=FOUND" >> "$LOG_FILE"
else
  echo "BOOTSTRAP_STATUS=MISSING" >> "$LOG_FILE"
fi

echo "[8/12] Syncing state..."

sync

echo "[9/12] Finalizing reconstruction..."

echo "RECONSTRUCTION_DONE=true" >> "$LOG_FILE"

echo "[10/12] Generating summary..."

echo "FILES=$FILES_COUNT" >> "$LOG_FILE"

echo "[11/12] Closing system..."

echo "[12/12] Done."

echo "====================================================="
echo "SPRINT R0-BOOT-MASTER COMPLETED"
echo "OUTPUT:"
echo "$OUTPUT_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
