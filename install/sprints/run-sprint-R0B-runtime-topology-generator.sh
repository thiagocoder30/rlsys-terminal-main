#!/data/data/com.termux/files/usr/bin/bash

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

ROOT=$(git rev-parse --show-toplevel)

DOCS_DIR="$ROOT/docs/architecture"

EXPORT_DIR="/sdcard/Download/RL_SYS/architecture"
LOG_DIR="$EXPORT_DIR/logs"

mkdir -p "$DOCS_DIR"
mkdir -p "$EXPORT_DIR"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0B-$TIMESTAMP.log"

exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "====================================================="
echo "RL.SYS CORE"
echo "SPRINT R0-B"
echo "RUNTIME TOPOLOGY GENERATOR"
echo "====================================================="

TOPOLOGY_FILE="$DOCS_DIR/RUNTIME_TOPOLOGY.md"
GRAPH_FILE="$DOCS_DIR/RUNTIME_DEPENDENCY_GRAPH.md"

echo "[1/5] Building topology..."

{
echo "# RUNTIME TOPOLOGY"
echo
echo "Generated: $(date)"
echo
echo "## Critical Components"
echo
echo "- PaperTestOperatorConsole"
echo "- LivePaperOrchestrator"
echo "- paper-operational-cli-mode-engine"
echo "- StrategyDecisionEngine"
echo
echo "## Runtime Flow"
echo
echo "PaperTestOperatorConsole"
echo "  -> LivePaperOrchestrator"
echo "     -> Analytics Engines"
echo "     -> Ledger"
echo "     -> Runtime Enforcement"
echo
echo "paper-operational-cli-mode-engine"
echo "  -> Session Engines"
echo "  -> Risk Engines"
echo "  -> Bankroll Engines"
echo
echo "StrategyDecisionEngine"
echo "  -> Decision Logic"
} > "$TOPOLOGY_FILE"

echo "[2/5] Building dependency graph..."

{
echo "# RUNTIME DEPENDENCY GRAPH"
echo
grep "^import" \
src/application/runtime/PaperTestOperatorConsole.ts \
2>/dev/null || true

echo
grep "^import" \
src/presentation/cli/LivePaperOrchestrator.ts \
2>/dev/null || true

echo
grep "^import" \
src/domain/bankroll/paper-operational-cli-mode-engine.ts \
2>/dev/null || true

echo
grep "^import" \
src/domain/decision/StrategyDecisionEngine.ts \
2>/dev/null || true

} > "$GRAPH_FILE"

echo "[3/5] Exporting..."

cp -f "$TOPOLOGY_FILE" "$EXPORT_DIR/"
cp -f "$GRAPH_FILE" "$EXPORT_DIR/"

echo "[4/5] Verifying..."

ls -lah "$TOPOLOGY_FILE"
ls -lah "$GRAPH_FILE"

echo "[5/5] Completed"

echo "Log: $LOG_FILE"
