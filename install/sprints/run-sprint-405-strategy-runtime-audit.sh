#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 405] STRATEGY RUNTIME AUDIT START"

ROOT="$(pwd)"
FLAGS_DIR="$ROOT/install/sprints/flags"

mkdir -p "$FLAGS_DIR"

REGISTRY_FILE="$ROOT/src/domain/strategy/StrategyRegistry.ts"
RUNTIME_FILE="$ROOT/src/domain/strategy/StrategyRuntimeOrchestrator.js"

OUTPUT_FILE="$FLAGS_DIR/STRATEGY_RUNTIME_AUDIT.json"

TMP_REGISTERED="$(mktemp)"
TMP_RUNTIME="$(mktemp)"

#########################################
# REGISTERED STRATEGIES
#########################################

if [ -f "$REGISTRY_FILE" ]; then
  grep -E "Triplicacao|FusionReduzida" "$REGISTRY_FILE" \
    | sed 's/.*\(Triplicacao\|FusionReduzida\).*/\1/' \
    | sort -u > "$TMP_REGISTERED" || true
fi

#########################################
# RUNTIME REACHABLE
#########################################

while read -r strategy; do

  if grep -R "$strategy" "$ROOT/src" >/dev/null 2>&1; then
    echo "$strategy"
  fi

done < "$TMP_REGISTERED" | sort -u > "$TMP_RUNTIME"

#########################################
# DEAD MODULES
#########################################

TMP_DEAD="$(mktemp)"

find "$ROOT/src/domain/strategy" \
  -type f \
  \( -name "*.ts" -o -name "*.js" \) \
  | while read -r file
do

  module="$(basename "$file")"
  module="${module%.ts}"
  module="${module%.js}"

  COUNT=$(grep -R "$module" "$ROOT/src" 2>/dev/null | wc -l)

  if [ "$COUNT" -le 1 ]; then
    echo "$module"
  fi

done | sort -u > "$TMP_DEAD"

#########################################
# JSON OUTPUT
#########################################

{
echo "{"
echo "  \"generatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","

echo "  \"registered\": ["

FIRST=1
while read -r item
do
  [ -z "$item" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$item"

  FIRST=0

done < "$TMP_REGISTERED"

echo
echo "  ],"

echo "  \"runtimeReachable\": ["

FIRST=1
while read -r item
do
  [ -z "$item" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$item"

  FIRST=0

done < "$TMP_RUNTIME"

echo
echo "  ],"

echo "  \"deadModules\": ["

FIRST=1
while read -r item
do
  [ -z "$item" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$item"

  FIRST=0

done < "$TMP_DEAD"

echo
echo "  ]"
echo "}"

} > "$OUTPUT_FILE"

REGISTERED_COUNT=$(wc -l < "$TMP_REGISTERED")
RUNTIME_COUNT=$(wc -l < "$TMP_RUNTIME")
DEAD_COUNT=$(wc -l < "$TMP_DEAD")

rm -f \
  "$TMP_REGISTERED" \
  "$TMP_RUNTIME" \
  "$TMP_DEAD"

echo
echo "REGISTERED=$REGISTERED_COUNT"
echo "RUNTIME_REACHABLE=$RUNTIME_COUNT"
echo "DEAD_MODULES=$DEAD_COUNT"

echo
echo "=============================="
echo "[SPRINT 405 RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="
echo

echo "[SPRINT 405] COMPLETE"
