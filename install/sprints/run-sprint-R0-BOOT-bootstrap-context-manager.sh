#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-BOOT"
echo "BOOTSTRAP CONTEXT MANAGER"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"

BOOT_DIR="/sdcard/Download/RL_SYS/bootstrap"
LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"

mkdir -p "$BOOT_DIR"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-BOOT-bootstrap-context.log"

BOOTSTRAP_FILE="$BOOT_DIR/RL_SYS_BOOTSTRAP_CONTEXT_PACKAGE.md"
STATE_FILE="$ARCH_DIR/RL_SYS_STATE.json"

TOPOLOGY="$ARCH_DIR/RUNTIME_TOPOLOGY.md"
DOMAIN="$ARCH_DIR/DOMAIN_MAP.md"
DECISION="$ARCH_DIR/RL_SYS_DECISION_CONTINUITY_REPORT.md"
BASELINE="$ARCH_DIR/ARCHITECTURE_BASELINE_V4_5.md"

echo "[1/10] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/10] Checking core architecture files..."

FILES_MISSING=0

for f in "$STATE_FILE" "$TOPOLOGY" "$DOMAIN" "$DECISION" "$BASELINE"; do
  if [ ! -f "$f" ]; then
    echo "MISSING: $f" | tee -a "$LOG_FILE"
    FILES_MISSING=$((FILES_MISSING + 1))
  fi
done

echo "[3/10] Aggregating system state..."

TIMESTAMP=$(date)

echo "[4/10] Building bootstrap context package..."

cat > "$BOOTSTRAP_FILE" << EOF
# RL.SYS CORE - BOOTSTRAP CONTEXT PACKAGE

Generated: $TIMESTAMP

---

## 1. SYSTEM STATE

\`\`\`
$(cat "$STATE_FILE" 2>/dev/null || echo "STATE NOT FOUND")
\`\`\`

---

## 2. ARCHITECTURE TOPOLOGY

\`\`\`
$(cat "$TOPOLOGY" 2>/dev/null || echo "TOPOLOGY NOT FOUND")
\`\`\`

---

## 3. DOMAIN MAP

\`\`\`
$(cat "$DOMAIN" 2>/dev/null || echo "DOMAIN NOT FOUND")
\`\`\`

---

## 4. DECISION CONTINUITY

\`\`\`
$(cat "$DECISION" 2>/dev/null || echo "DECISION REPORT NOT FOUND")
\`\`\`

---

## 5. ARCHITECTURE BASELINE

\`\`\`
$(cat "$BASELINE" 2>/dev/null || echo "BASELINE NOT FOUND")
\`\`\`

---

## 6. SYSTEM INTERPRETATION

This package represents a **complete rehydration state** of RL.SYS CORE.

It allows:

- reconstruction of system context in a new session
- continuation of sprint evolution
- restoration of architecture understanding
- resumption of observability chain

---

## 7. CURRENT LIMITATIONS

- No persistent memory across sessions
- Requires manual reloading in new chat
- Depends on file-based state consistency

---

## 8. BOOT PROTOCOL (HOW TO USE)

In a new chat:

1. Load this entire file
2. Ask:
   > "Reconstruct RL.SYS CORE state from bootstrap package"
3. Continue from last sprint

---

## 9. NEXT EVOLUTION

R0-BOOT-EXT → AUTOMATED CONTEXT RECONSTRUCTOR ENGINE

EOF

echo "[5/10] Validating package integrity..."

SIZE=$(wc -c < "$BOOTSTRAP_FILE")

echo "BOOTSTRAP_SIZE=$SIZE bytes" >> "$LOG_FILE"
echo "MISSING_FILES=$FILES_MISSING" >> "$LOG_FILE"

echo "[6/10] Creating quick loader script..."

cat > "$BOOT_DIR/load-bootstrap.sh" << 'EOF'
#!/bin/bash
echo "Loading RL.SYS CORE Bootstrap Context..."
cat RL_SYS_BOOTSTRAP_CONTEXT_PACKAGE.md
EOF

chmod +x "$BOOT_DIR/load-bootstrap.sh"

echo "[7/10] Snapshot finalization..."

echo "TIMESTAMP=$TIMESTAMP" >> "$LOG_FILE"

echo "[8/10] Syncing..."

sync

echo "[9/10] Final check..."

if [ "$FILES_MISSING" -gt 0 ]; then
  echo "WARNING: Missing architecture files detected" | tee -a "$LOG_FILE"
fi

echo "[10/10] Done."

echo "====================================================="
echo "SPRINT R0-BOOT COMPLETED"
echo "BOOTSTRAP PACKAGE:"
echo "$BOOTSTRAP_FILE"
echo "LOADER:"
echo "$BOOT_DIR/load-bootstrap.sh"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
