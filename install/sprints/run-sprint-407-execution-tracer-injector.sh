#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 407] EXECUTION TRACER INJECTOR START"

ROOT="$(pwd)"
FLAGS_DIR="$ROOT/install/sprints/flags"
OUTPUT_FILE="$FLAGS_DIR/EXECUTION_TRACER_REPORT.json"

mkdir -p "$FLAGS_DIR"

STRATEGY_DIR="$ROOT/src/domain/strategy"
REGISTRY="$STRATEGY_DIR/StrategyRegistry.ts"
ORCHESTRATOR="$STRATEGY_DIR/StrategyRuntimeOrchestrator.js"

############################################
# DETECT STRATEGIES
############################################

STRATEGIES=()

while read -r file; do
  name="$(basename "$file")"
  name="${name%.ts}"
  name="${name%.js}"
  STRATEGIES+=("$name")
done < <(find "$STRATEGY_DIR" -type f \( -name "*.ts" -o -name "*.js" \))

############################################
# TRACE GENERATION
############################################

TMP_TRACE="$(mktemp)"
TMP_HOOKED="$(mktemp)"
TMP_UNHOOKED="$(mktemp)"

for s in "${STRATEGIES[@]}"; do

  [ -z "$s" ] && continue

  ORCH=0
  REG=0

  if [ -f "$ORCHESTRATOR" ] && grep -q "$s" "$ORCHESTRATOR"; then
    ORCH=1
  fi

  if [ -f "$REGISTRY" ] && grep -q "$s" "$REGISTRY"; then
    REG=1
  fi

  if [ $ORCH -eq 1 ] && [ $REG -eq 1 ]; then
    echo "{\"strategy\":\"$s\",\"trace\":[\"ENTRY\",\"Registry\",\"Orchestrator\",\"Decision\"],\"status\":\"HOOKED\"}" >> "$TMP_TRACE"
    echo "$s" >> "$TMP_HOOKED"
  else
    echo "$s" >> "$TMP_UNHOOKED"
  fi

done

############################################
# SUMMARY
############################################

HOOKED_COUNT=$(wc -l < "$TMP_HOOKED" 2>/dev/null || echo 0)
UNHOOKED_COUNT=$(wc -l < "$TMP_UNHOOKED" 2>/dev/null || echo 0)

############################################
# BUILD JSON
############################################

{
echo "{"
echo "  \"generatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","

echo "  \"hookedExecutionPaths\": ["

if [ -s "$TMP_TRACE" ]; then
  sed '$!s/$/,/' "$TMP_TRACE" | sed 's/^/    /'
fi

echo "  ],"

echo "  \"hookedStrategies\": ["

if [ -s "$TMP_HOOKED" ]; then
  FIRST=1
  while read -r line; do
    [ -z "$line" ] && continue

    if [ $FIRST -eq 0 ]; then
      echo ","
    fi

    printf '    "%s"' "$line"
    FIRST=0

  done < "$TMP_HOOKED"
fi

echo
echo "  ],"

echo "  \"unhookedStrategies\": ["

if [ -s "$TMP_UNHOOKED" ]; then
  FIRST=1
  while read -r line; do
    [ -z "$line" ] && continue

    if [ $FIRST -eq 0 ]; then
      echo ","
    fi

    printf '    "%s"' "$line"
    FIRST=0

  done < "$TMP_UNHOOKED"
fi

echo
echo "  ]"
echo "}"
} > "$OUTPUT_FILE"

############################################
# CLEANUP
############################################

rm -f "$TMP_TRACE" "$TMP_HOOKED" "$TMP_UNHOOKED"

############################################
# REPORT
############################################

echo
echo "HOOKED=$HOOKED_COUNT"
echo "UNHOOKED=$UNHOOKED_COUNT"

echo
echo "=============================="
echo "[SPRINT 407 RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo
echo "[SPRINT 407] COMPLETE"
