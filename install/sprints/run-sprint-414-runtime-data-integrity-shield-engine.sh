#!/data/data/com.termux/files/usr/bin/bash

echo "[SPRINT 414] RUNTIME DATA INTEGRITY SHIELD ENGINE START"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$ROOT_DIR/install/sprints/flags"

mkdir -p "$FLAGS_DIR"

LEDGER="$FLAGS_DIR/RUNTIME_TRUTH_LEDGER.json"
FLOW="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"
COHERENCE="$FLAGS_DIR/STRATEGY_RUNTIME_COHERENCE_REPORT.json"
SEMANTIC="$FLAGS_DIR/RUNTIME_SEMANTIC_NORMALIZATION_REPORT.json"
CAUSAL="$FLAGS_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"

# -----------------------------
# SAFE UTILITIES (CORE FIX)
# -----------------------------

sanitize_int() {
  echo "$1" | tr -cd '0-9'
}

safe_jq() {
  local file=$1
  local query=$2

  if command -v jq >/dev/null 2>&1 && [ -f "$file" ]; then
    jq -r "$query" "$file" 2>/dev/null | tr -d '\n'
  else
    echo "0"
  fi
}

safe_file_exists() {
  [ -f "$1" ] && echo 1 || echo 0
}

echo "[414] VALIDATING INPUT FILES..."

LEDGER_OK=$(safe_file_exists "$LEDGER")
FLOW_OK=$(safe_file_exists "$FLOW")
COHERENCE_OK=$(safe_file_exists "$COHERENCE")

# -----------------------------
# RAW EXTRACTION (SANITIZED)
# -----------------------------

echo "[414] EXTRACTING SANITIZED METRICS..."

HOOKED_RAW=$(safe_jq "$LEDGER" '.execution.hooked | length')
ORPHANS_RAW=$(safe_jq "$LEDGER" '.health.orphans | length')
BOTTLENECKS_RAW=$(safe_jq "$LEDGER" '.health.bottlenecks | length')
DEAD_RAW=$(safe_jq "$LEDGER" '.health.deadModules | length')

COHERENCE_RAW=$(safe_jq "$COHERENCE" '.coherenceScore')
FLOW_RAW=$(safe_jq "$FLOW" '.flowHealthScore')
SEMANTIC_RAW=$(safe_jq "$SEMANTIC" '.semantic.semanticScore')

# -----------------------------
# HARD SANITIZATION LAYER (CRITICAL FIX)
# -----------------------------

HOOKED=$(sanitize_int "$HOOKED_RAW")
ORPHANS=$(sanitize_int "$ORPHANS_RAW")
BOTTLENECKS=$(sanitize_int "$BOTTLENECKS_RAW")
DEAD=$(sanitize_int "$DEAD_RAW")

COHERENCE_SCORE=$(sanitize_int "$COHERENCE_RAW")
FLOW_SCORE=$(sanitize_int "$FLOW_RAW")
SEMANTIC_SCORE=$(sanitize_int "$SEMANTIC_RAW")

# fallback safety
[ -z "$HOOKED" ] && HOOKED=0
[ -z "$ORPHANS" ] && ORPHANS=0
[ -z "$BOTTLENECKS" ] && BOTTLENECKS=0
[ -z "$DEAD" ] && DEAD=0

[ -z "$COHERENCE_SCORE" ] && COHERENCE_SCORE=0
[ -z "$FLOW_SCORE" ] && FLOW_SCORE=0
[ -z "$SEMANTIC_SCORE" ] && SEMANTIC_SCORE=0

# -----------------------------
# INTEGRITY VALIDATION ENGINE
# -----------------------------

echo "[414] RUNNING INTEGRITY CHECK..."

CORRUPTION=0

# invalid state detection
if [ "$LEDGER_OK" -eq 0 ]; then
  CORRUPTION=$((CORRUPTION+2))
fi

if [ "$FLOW_OK" -eq 0 ]; then
  CORRUPTION=$((CORRUPTION+1))
fi

# numeric sanity checks
if [ "$HOOKED" -lt 0 ] || [ "$HOOKED" -gt 100 ]; then
  CORRUPTION=$((CORRUPTION+1))
fi

if [ "$ORPHANS" -gt "$HOOKED" ] && [ "$HOOKED" -gt 0 ]; then
  CORRUPTION=$((CORRUPTION+2))
fi

# -----------------------------
# GLOBAL INTEGRITY SCORE
# -----------------------------

BASE=100
PENALTY=$((CORRUPTION * 20))
INTEGRITY_SCORE=$((BASE - PENALTY))

if [ "$INTEGRITY_SCORE" -lt 0 ]; then
  INTEGRITY_SCORE=0
fi

# -----------------------------
# STATUS ENGINE
# -----------------------------

if [ "$INTEGRITY_SCORE" -ge 85 ]; then
  STATUS="DATA_INTEGRITY_STRONG"
elif [ "$INTEGRITY_SCORE" -ge 60 ]; then
  STATUS="DATA_INTEGRITY_STABLE"
else
  STATUS="DATA_INTEGRITY_DEGRADED"
fi

# -----------------------------
# OUTPUT REPORT
# -----------------------------

OUTPUT="$FLAGS_DIR/RUNTIME_DATA_INTEGRITY_SHIELD_REPORT.json"

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "inputs": {
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "bottlenecks": $BOTTLENECKS,
    "dead": $DEAD,
    "coherence": $COHERENCE_SCORE,
    "flow": $FLOW_SCORE,
    "semantic": $SEMANTIC_SCORE
  },
  "validation": {
    "ledgerExists": $LEDGER_OK,
    "flowExists": $FLOW_OK,
    "coherenceExists": $COHERENCE_OK,
    "corruptionSignals": $CORRUPTION
  },
  "integrity": {
    "score": $INTEGRITY_SCORE,
    "status": "$STATUS"
  }
}
EOF

echo "=============================="
echo "[SPRINT 414 RESULT]"
echo "INTEGRITY SCORE: $INTEGRITY_SCORE"
echo "STATUS: $STATUS"
echo "CORRUPTION SIGNALS: $CORRUPTION"
echo "=============================="

echo "[SPRINT 414] COMPLETE"
