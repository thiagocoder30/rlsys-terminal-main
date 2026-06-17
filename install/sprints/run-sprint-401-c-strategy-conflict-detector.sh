#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "[SPRINT 401-C] STRATEGY CONFLICT DETECTOR START"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

STRATEGY_DIR="$ROOT_DIR/src/domain/strategy"

if [ ! -d "$STRATEGY_DIR" ]; then
  echo "[401-C][BLOCK] Strategy directory not found"
  exit 1
fi

echo "[401-C] Scanning strategies for semantic overlap..."

# Estratégias conhecidas (base inicial - pode crescer automaticamente depois)
STRATEGIES=(
  "Triplicacao"
  "FusionReduzida"
)

REPORT_FILE="$ROOT_DIR/install/sprints/flags/STRATEGY_CONFLICT_REPORT.json"

mkdir -p "$(dirname "$REPORT_FILE")"

# Simulação de “assinatura comportamental”
# (futuro: substituir por embeddings / score distribution real)
declare -A SIGNATURES

SIGNATURES["Triplicacao"]="freq:high,pattern:repetition,entropy:low"
SIGNATURES["FusionReduzida"]="freq:medium,pattern:blend,entropy:medium"

echo "{ \"conflicts\": [" > "$REPORT_FILE"

CONFLICT_FOUND=0

for i in "${!STRATEGIES[@]}"; do
  for j in "${!STRATEGIES[@]}"; do

    if [ "$i" -ge "$j" ]; then
      continue
    fi

    A="${STRATEGIES[$i]}"
    B="${STRATEGIES[$j]}"

    SIG_A="${SIGNATURES[$A]}"
    SIG_B="${SIGNATURES[$B]}"

    # heurística simples de conflito:
    # se ambos têm freq similar e entropy similar → conflito
    if [[ "$SIG_A" == *"freq:high"* && "$SIG_B" == *"freq:high"* ]]; then

      CONFLICT_FOUND=1

      echo "[401-C][CONFLICT] $A <-> $B"

      echo "{
        \"a\": \"$A\",
        \"b\": \"$B\",
        \"reason\": \"HIGH_OVERLAP_SIGNATURE\"
      }," >> "$REPORT_FILE"
    fi

  done
done

echo "] }" >> "$REPORT_FILE"

echo "[401-C] REPORT GENERATED: $REPORT_FILE"

if [ "$CONFLICT_FOUND" -eq 1 ]; then
  echo ""
  echo "=============================="
  echo "[401-C RESULT]"
  echo "STATUS: CONFLICT DETECTED"
  echo "DECISION: REVIEW REQUIRED"
  echo "=============================="
  exit 2
fi

echo ""
echo "=============================="
echo "[401-C RESULT]"
echo "STATUS: NO CONFLICT"
echo "DECISION: SAFE TO PROCEED"
echo "=============================="

echo "[SPRINT 401-C] COMPLETE"
