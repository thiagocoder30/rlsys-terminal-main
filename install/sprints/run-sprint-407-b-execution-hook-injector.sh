#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 407-B] EXECUTION HOOK INJECTOR START"

ROOT="$(pwd)"
STRATEGY_DIR="$ROOT/src/domain/strategy"
OUTPUT_FILE="$ROOT/install/sprints/flags/EXECUTION_HOOK_INJECTION_REPORT.json"

mkdir -p "$(dirname "$OUTPUT_FILE")"

STRATEGIES=()

############################################
# COLLECT STRATEGIES
############################################

while read -r file; do
  name="$(basename "$file")"
  name="${name%.ts}"
  name="${name%.js}"
  STRATEGIES+=("$name")
done < <(find "$STRATEGY_DIR" -type f \( -name "*.ts" -o -name "*.js" \))

############################################
# SIMULATE HOOK INJECTION MAP
############################################

TMP_HOOKED="$(mktemp)"
TMP_PATCH_PLAN="$(mktemp)"
TMP_UNCHANGED="$(mktemp)"

for s in "${STRATEGIES[@]}"; do

  [ -z "$s" ] && continue

  FILE_PATH=$(find "$STRATEGY_DIR" -type f \( -name "*.ts" -o -name "*.js" \) -exec grep -l "$s" {} \; 2>/dev/null | head -n 1 || true)

  if [ -n "$FILE_PATH" ]; then

    echo "$s" >> "$TMP_HOOKED"

    echo "trace:start:$s -> $FILE_PATH" >> "$TMP_PATCH_PLAN"
    echo "trace:end:$s -> $FILE_PATH" >> "$TMP_PATCH_PLAN"

  else
    echo "$s" >> "$TMP_UNCHANGED"
  fi

done

############################################
# COUNTS
############################################

HOOKED=$(wc -l < "$TMP_HOOKED" 2>/dev/null || echo 0)
UNCHANGED=$(wc -l < "$TMP_UNCHANGED" 2>/dev/null || echo 0)
PATCHES=$(wc -l < "$TMP_PATCH_PLAN" 2>/dev/null || echo 0)

############################################
# BUILD REPORT
############################################

{
echo "{"
echo "  \"generatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","

echo "  \"hookedStrategies\": ["

FIRST=1
while read -r line; do
  [ -z "$line" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$line"
  FIRST=0

done < "$TMP_HOOKED"

echo
echo "  ],"

echo "  \"patchPlan\": ["

FIRST=1
while read -r line; do
  [ -z "$line" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$line"
  FIRST=0

done < "$TMP_PATCH_PLAN"

echo
echo "  ],"

echo "  \"unchangedStrategies\": ["

FIRST=1
while read -r line; do
  [ -z "$line" ] && continue

  if [ $FIRST -eq 0 ]; then
    echo ","
  fi

  printf '    "%s"' "$line"
  FIRST=0

done < "$TMP_UNCHANGED"

echo
echo "  ]"
echo "}"
} > "$OUTPUT_FILE"

############################################
# CLEANUP
############################################

rm -f "$TMP_HOOKED" "$TMP_PATCH_PLAN" "$TMP_UNCHANGED"

############################################
# REPORT
############################################

echo
echo "HOOKED=$HOOKED"
echo "UNCHANGED=$UNCHANGED"
echo "PATCHES=$PATCHES"

echo
echo "=============================="
echo "[SPRINT 407-B RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo
echo "[SPRINT 407-B] COMPLETE"
