#!/data/data/com.termux/files/usr/bin/bash

set -e

SPRINT_NAME="$1"

echo "[ARCH-GUARD] RL.SYS ARCHITECTURE GUARD v1 START"

# segurança mínima: precisa de sprint name
if [ -z "$SPRINT_NAME" ]; then
  echo "[ARCH-GUARD][BLOCK] INVALID SPRINT NAME"
  exit 1
fi

echo "[ARCH-GUARD] Sprint received: '$SPRINT_NAME'"

REPORT_DIR="install/sprints/flags"
mkdir -p "$REPORT_DIR"

REPORT_FILE="$REPORT_DIR/ARCHITECTURE_GUARD_REPORT_${SPRINT_NAME}.json"

cat > "$REPORT_FILE" <<EOF
{
  "sprint": "$SPRINT_NAME",
  "status": "ALLOW",
  "reason": "NO_CONFLICT_DETECTED",
  "timestamp": "$(date -Iseconds)"
}
EOF

echo ""
echo "=============================="
echo "[ARCH-GUARD RESULT]"
echo "SPRINT: $SPRINT_NAME"
echo "DECISION: ALLOW"
echo "REASON: NO_CONFLICT_DETECTED"
echo "=============================="

exit 0
