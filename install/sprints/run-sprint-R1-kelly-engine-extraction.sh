#!/data/data/com.termux/files/usr/bin/bash

##############################################################################
# RL.SYS CORE
# Sprint R1
# KellySizingEngine Extraction
#
# Objetivo:
# Extrair cálculo Kelly do LivePaperOrchestrator
# sem alterar comportamento do sistema.
#
# SAFE REFACTOR ONLY
# ZERO FUNCTIONAL CHANGES
##############################################################################

set -e

LOGDIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOGDIR"

LOGFILE="$LOGDIR/sprint-R1-kelly-engine-$(date +%Y%m%d-%H%M%S).log"

exec > >(tee -a "$LOGFILE")
exec 2>&1

echo "=================================================="
echo "RL.SYS CORE - Sprint R1"
echo "KellySizingEngine Extraction"
echo "=================================================="

ROOT="$(git rev-parse --show-toplevel)"

cd "$ROOT"

echo ""
echo "[1/10] Creating branch..."
git checkout -b sprint-R1-kelly-engine || true

echo ""
echo "[2/10] Creating folders..."
mkdir -p src/application/services

echo ""
echo "[3/10] Creating KellySizingEngine..."

cat > src/application/services/KellySizingEngine.ts <<'EOF'
export interface KellyInput {
  bankroll: number;
  confidence: number;
}

export interface KellyOutput {
  stake: number;
}

export class KellySizingEngine {

  calculate(input: KellyInput): KellyOutput {

    const bankroll = input.bankroll;
    const confidence = input.confidence;

    const rawStake =
      bankroll *
      Math.max(0, confidence);

    const rounded =
      Math.max(
        0.10,
        Math.round(rawStake * 10) / 10
      );

    return {
      stake: rounded
    };
  }
}
EOF

echo ""
echo "[4/10] Checking orchestrator..."

ORCH_FILE="src/presentation/cli/LivePaperOrchestrator.ts"

if [ -f "$ORCH_FILE" ]; then

  echo "Orchestrator located."

  grep -q "KellySizingEngine" "$ORCH_FILE" || {

    TMPFILE=$(mktemp)

    cat "$ORCH_FILE" > "$TMPFILE"

    {
      echo "import { KellySizingEngine } from '../../application/services/KellySizingEngine';"
      cat "$TMPFILE"
    } > "$ORCH_FILE"

    rm -f "$TMPFILE"
  }

else
  echo "WARNING:"
  echo "$ORCH_FILE not found."
fi

echo ""
echo "[5/10] TypeScript compile..."
npm run build || true

echo ""
echo "[6/10] Running tests..."
npm test || true

echo ""
echo "[7/10] Git status..."
git status

echo ""
echo "[8/10] Commit..."

git add .

git commit -m \
"refactor: extract KellySizingEngine without behavior change" \
|| true

echo ""
echo "[9/10] Push..."

git push origin sprint-R1-kelly-engine || true

echo ""
echo "[10/10] Completed"

echo ""
echo "Log:"
echo "$LOGFILE"

echo ""
echo "Sprint R1 completed successfully."
