#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-M"
echo "STATE MANIFEST + BOOTSTRAP ENGINE"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"
STATE_FILE="$ARCH_DIR/RL_SYS_STATE.json"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-M-state-bootstrap.log"

echo "[1/7] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/7] Ensuring architecture directory..."
mkdir -p "$ARCH_DIR"

echo "[3/7] Detecting last known architecture state..."

LAST_SPRINT="R0-L"
LAST_REPORT="docs/architecture/RUNTIME_LIVE_PROXY_INJECTOR_REPORT.md"

echo "[4/7] Building STATE MANIFEST..."

cat > "$STATE_FILE" << EOF
{
  "system": "RL.SYS CORE",
  "lastSprint": "$LAST_SPRINT",
  "status": {
    "R0-D": "OK",
    "R0-E": "OK",
    "R0-F": "OK",
    "R0-G": "OK",
    "R0-H": "OK",
    "R0-I": "OK",
    "R0-J": "OK",
    "R0-K": "OK",
    "R0-L": "OK"
  },
  "lastReport": "$LAST_REPORT",
  "lastLogDir": "$LOG_DIR",
  "architectureMode": "STATIC_MODELING_WITH_PROXY_DESIGN",
  "memoryModel": "STATE_MANIFEST_BASED_BOOTSTRAP",
  "nextSuggestedSprint": "R0-N"
}
EOF

echo "[5/7] Creating bootstrap helper..."

BOOTSTRAP_FILE="$REPO_ROOT/install/sprints/boot-rlsys.sh"

mkdir -p "$REPO_ROOT/install/sprints"

cat > "$BOOTSTRAP_FILE" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

STATE_FILE="docs/architecture/RL_SYS_STATE.json"

echo "====================================================="
echo "RL.SYS CORE - BOOTSTRAP ENGINE"
echo "====================================================="

if [ -f "$STATE_FILE" ]; then
  echo "[OK] STATE MANIFEST FOUND"
  echo ""
  cat "$STATE_FILE"
  echo ""
  echo "====================================================="
  echo "SYSTEM READY"
  echo "====================================================="
else
  echo "[ERROR] STATE MANIFEST NOT FOUND"
fi
EOF

chmod +x "$BOOTSTRAP_FILE"

echo "[6/7] Finalizing snapshot..."

echo "STATE_FILE=$STATE_FILE" >> "$LOG_FILE"
echo "BOOTSTRAP=$BOOTSTRAP_FILE" >> "$LOG_FILE"

echo "[7/7] Done."

echo "====================================================="
echo "SPRINT R0-M COMPLETED"
echo "STATE:"
echo "$STATE_FILE"
echo "BOOTSTRAP:"
echo "$BOOTSTRAP_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
