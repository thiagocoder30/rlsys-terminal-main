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
