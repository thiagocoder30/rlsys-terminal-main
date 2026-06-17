#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 406] RUNTIME EXECUTION MAP START"

ROOT="$(pwd)"
FLAGS_DIR="$ROOT/install/sprints/flags"
OUTPUT_FILE="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"

mkdir -p "$FLAGS_DIR"

STRATEGY_DIR="$ROOT/src/domain/strategy"
ORCHESTRATOR="$STRATEGY_DIR/StrategyRuntimeOrchestrator.js"
REGISTRY="$STRATEGY_DIR/StrategyRegistry.ts"

############################################
# DETECT STRATEGIES
############################################

STRATEGIES=()

while read -r file; do
  name="$(basename "$file")"
  name="${name%.ts}"
  name="${name%.js}"
  STRATEGIES+=("$name")
done < <(find "$STRATEGY_DIR" -maxdepth 2 -type f \( -name "*.ts" -o -name "*.js" \))

############################################
# DETECT EXECUTION PATHS
############################################

TMP_PATHS="$(mktemp)"
TMP_ORPHANS="$(mktemp)"
TMP_BOTTLENECKS="$(mktemp)"

for s in "${STRATEGIES[@]}"; do

  if [ -z "$s" ]; then
    continue
  fi

  # detect if referenced by orchestrator
  ORCH_REF=0
  REG_REF=0

  if [ -f "$ORCHESTRATOR" ]; then
    if grep -q "$s" "$ORCHESTRATOR"; then
      ORCH_REF=1
    fi
  fi

  if [ -f "$REGISTRY" ]; then
    if grep -q "$s" "$REGISTRY"; then
      REG_REF=1
    fi
  fi

  if [ $ORCH_REF -eq 1 ] && [ $REG_REF -eq 1 ]; then
    echo "{\"strategy\":\"$s\",\"path\":[\"Registry\",\"Orchestrator\",\"ExecutionEngine\"],\"status\":\"ACTIVE\"}" >> "$TMP_PATHS"
  elif [ $REG_REF -eq 1 ] && [ $ORCH_REF -eq 0 ]; then
    echo "$s" >> "$TMP_ORPHANS"
  elif [ $ORCH_REF -eq 1 ] && [ $REG_REF -eq 0 ]; then
    echo "$s" >> "$TMP_BOTTLENECKS"
  fi

done

############################################
# COUNT RESULTS
############################################

ACTIVE_COUNT=$(wc -l < "$TMP_PATHS" 2>/dev/null || echo 0)
ORPHAN_COUNT=$(wc -l < "$TMP_ORPHANS" 2>/dev/null || echo 0)
BOTTLENECK_COUNT=$(wc -l < "$TMP_BOTTLENECKS" 2>/dev/null || echo 0)

############################################
# BUILD JSON
############################################

{
echo "{"
echo "  \"generatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","

echo "  \"executionPaths\": ["

if [ -s "$TMP_PATHS" ]; then
  sed '$!s/$/,/' "$TMP_PATHS" | sed 's/^/    /'
fi

echo "  ],"

echo "  \"orphanStrategies\": ["

if [ -s "$TMP_ORPHANS" ]; then
  FIRST=1
  while read -r line; do
    [ -z "$line" ] && continue

    if [ $FIRST -eq 0 ]; then
      echo ","
    fi

    printf '    "%s"' "$line"
    FIRST=0
  done < "$TMP_ORPHANS"
fi

echo
echo "  ],"

echo "  \"bottlenecks\": ["

if [ -s "$TMP_BOTTLENECKS" ]; then
  FIRST=1
  while read -r line; do
    [ -z "$line" ] && continue

    if [ $FIRST -eq 0 ]; then
      echo ","
    fi

    printf '    "%s"' "$line"
    FIRST=0
  done < "$TMP_BOTTLENECKS"
fi

echo
echo "  ]"
echo "}"
} > "$OUTPUT_FILE"

############################################
# CLEANUP
############################################

rm -f "$TMP_PATHS" "$TMP_ORPHANS" "$TMP_BOTTLENECKS"

############################################
# REPORT
############################################

echo
echo "ACTIVE_PATHS=$ACTIVE_COUNT"
echo "ORPHANS=$ORPHAN_COUNT"
echo "BOTTLENECKS=$BOTTLENECK_COUNT"

echo
echo "=============================="
echo "[SPRINT 406 RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo
echo "[SPRINT 406] COMPLETE"
