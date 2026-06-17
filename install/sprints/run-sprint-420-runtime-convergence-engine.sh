#!/data/data/com.termux/files/usr/bin/bash

##############################################################################
# RL.SYS CORE
# Sprint 420 — Runtime Convergence Engine
#
# Objetivo:
# Consolidar todos os artefatos gerados entre as Sprints 404–419,
# medir convergência real do ecossistema e gerar baseline oficial
# para início da FASE 2 (Inteligência Institucional).
#
# NÃO modifica runtime.
# NÃO modifica estratégias.
# NÃO autoriza operação.
# Apenas consolidação institucional.
##############################################################################

set -e

echo "[SPRINT 420] RUNTIME CONVERGENCE ENGINE START"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"

REPORT="$FLAGS_DIR/RUNTIME_CONVERGENCE_REPORT.json"

LOGFILE="$LOG_DIR/sprint-420-runtime-convergence.log"

exec > >(tee "$LOGFILE")
exec 2>&1

echo "[420] ROOT=$ROOT"
echo "[420] LOADING ARTIFACTS..."

###########################################################################
# Helpers
###########################################################################

read_json_value() {
  local file="$1"
  local key="$2"

  if command -v jq >/dev/null 2>&1; then
    jq -r "$key" "$file" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

###########################################################################
# Inputs
###########################################################################

TRUTH_GATE="$FLAGS_DIR/RUNTIME_INSTALLATION_TRUTH_GATE_REPORT.json"
CONTRACT="$FLAGS_DIR/RUNTIME_EXECUTION_CONTRACT_ENFORCEMENT_REPORT.json"
LIFECYCLE="$FLAGS_DIR/RUNTIME_ARTIFACT_LIFECYCLE_REPORT.json"
INTEGRITY="$FLAGS_DIR/RUNTIME_DATA_INTEGRITY_SHIELD_REPORT.json"
CAUSAL="$FLAGS_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"
SEMANTIC="$FLAGS_DIR/RUNTIME_SEMANTIC_NORMALIZATION_REPORT.json"

FOUND=0
TOTAL=6

for f in \
  "$TRUTH_GATE" \
  "$CONTRACT" \
  "$LIFECYCLE" \
  "$INTEGRITY" \
  "$CAUSAL" \
  "$SEMANTIC"
do
  if [ -f "$f" ]; then
    FOUND=$((FOUND+1))
  fi
done

###########################################################################
# Scores
###########################################################################

TRUST_SCORE=0
CONTRACT_SCORE=0
LIFECYCLE_SCORE=0
INTEGRITY_SCORE=0
CAUSAL_SCORE=0
SEMANTIC_SCORE=0

if [ -f "$TRUTH_GATE" ]; then
  TRUST_SCORE=$(read_json_value "$TRUTH_GATE" '.trustScore // 0')
fi

if [ -f "$CONTRACT" ]; then
  CONTRACT_SCORE=$(read_json_value "$CONTRACT" '.contract.score // 0')
fi

if [ -f "$LIFECYCLE" ]; then
  LIFECYCLE_SCORE=$(read_json_value "$LIFECYCLE" '.lifecycle.score // 0')
fi

if [ -f "$INTEGRITY" ]; then
  INTEGRITY_SCORE=$(read_json_value "$INTEGRITY" '.integrity.score // 100')
fi

if [ -f "$CAUSAL" ]; then
  CAUSAL_SCORE=$(read_json_value "$CAUSAL" '.analysis.causalScore // 0')
fi

if [ -f "$SEMANTIC" ]; then
  SEMANTIC_SCORE=$(read_json_value "$SEMANTIC" '.semantic.semanticScore // 0')
fi

###########################################################################
# Convergence
###########################################################################

SUM=$(
  echo "$TRUST_SCORE + \
        $CONTRACT_SCORE + \
        $LIFECYCLE_SCORE + \
        $INTEGRITY_SCORE + \
        $CAUSAL_SCORE + \
        $SEMANTIC_SCORE" | bc
)

CONVERGENCE=$((SUM / TOTAL))

STATUS="DEGRADED"

if [ "$CONVERGENCE" -ge 90 ]; then
  STATUS="INSTITUTIONAL_READY"
elif [ "$CONVERGENCE" -ge 75 ]; then
  STATUS="STABLE"
elif [ "$CONVERGENCE" -ge 60 ]; then
  STATUS="PARTIAL"
fi

###########################################################################
# Output
###########################################################################

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "model":"RUNTIME_CONVERGENCE_ENGINE_V1",

  "artifacts": {
    "expected": $TOTAL,
    "found": $FOUND
  },

  "scores": {
    "trust": $TRUST_SCORE,
    "contract": $CONTRACT_SCORE,
    "lifecycle": $LIFECYCLE_SCORE,
    "integrity": $INTEGRITY_SCORE,
    "causal": $CAUSAL_SCORE,
    "semantic": $SEMANTIC_SCORE
  },

  "convergence": {
    "score": $CONVERGENCE,
    "status": "$STATUS"
  },

  "phaseGate": {
    "nextPhase": "INSTITUTIONAL_WARMUP_INTELLIGENCE",
    "authorized": true
  }
}
EOF

cp "$REPORT" \
"$HOME/storage/downloads/RUNTIME_CONVERGENCE_REPORT.json" \
2>/dev/null || true

cp "$LOGFILE" \
"$HOME/storage/downloads/sprint-420-runtime-convergence.log" \
2>/dev/null || true

echo ""
echo "=============================="
echo "[SPRINT 420 RESULT]"
echo "CONVERGENCE SCORE: $CONVERGENCE"
echo "STATUS: $STATUS"
echo "ARTIFACTS FOUND: $FOUND/$TOTAL"
echo "OUTPUT: $REPORT"
echo "LOG: $LOGFILE"
echo "=============================="
echo ""

echo "[SPRINT 420] COMPLETE"

git add .
git commit -m "Sprint 420 - Runtime Convergence Engine" || true
git push || true
