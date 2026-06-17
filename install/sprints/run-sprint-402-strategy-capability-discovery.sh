#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"
LOGS_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOGS_DIR"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"

OUTPUT_JSON="$FLAGS_DIR/STRATEGY_CAPABILITY_MAP.json"

echo "[SPRINT 402] STRATEGY CAPABILITY DISCOVERY START"

TMP_SCRIPT="$LOGS_DIR/strategy_capability_discovery_${TIMESTAMP}.js"

cat > "$TMP_SCRIPT" <<'NODE'
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const OUTPUT = process.argv[3];

const strategyDir = path.join(ROOT, 'src/domain/strategy');

const report = {
  generatedAt: new Date().toISOString(),
  strategies: []
};

function classifyRisk(name) {
  const n = name.toLowerCase();

  if (
    n.includes('recovery') ||
    n.includes('runtime') ||
    n.includes('orchestrator')
  ) {
    return 'HIGH';
  }

  if (
    n.includes('recommendation') ||
    n.includes('ranking') ||
    n.includes('ensemble')
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function classifyDomain(name) {
  const n = name.toLowerCase();

  if (n.includes('cooldown')) return 'cooldown';
  if (n.includes('recommendation')) return 'recommendation';
  if (n.includes('ranking')) return 'ranking';
  if (n.includes('ensemble')) return 'ensemble';
  if (n.includes('compatibility')) return 'compatibility';
  if (n.includes('recovery')) return 'recovery';
  if (n.includes('runtime')) return 'runtime';

  return 'strategy';
}

for (const file of fs.readdirSync(strategyDir)) {

  const full = path.join(strategyDir, file);

  if (!fs.statSync(full).isFile()) {
    continue;
  }

  if (
    !file.endsWith('.ts') &&
    !file.endsWith('.js')
  ) {
    continue;
  }

  const name = file.replace(/\.(ts|js)$/,'');

  report.strategies.push({
    name,
    domain: classifyDomain(name),
    risk: classifyRisk(name),
    source: `src/domain/strategy/${file}`
  });
}

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log(
  `DISCOVERED=${report.strategies.length}`
);
NODE

node "$TMP_SCRIPT" "$ROOT" "$OUTPUT_JSON"

if [ ! -f "$OUTPUT_JSON" ]; then
  echo "[SPRINT 402][FAIL] OUTPUT NOT GENERATED"
  exit 1
fi

COUNT=$(grep -c '"name"' "$OUTPUT_JSON" || true)

echo "[SPRINT 402] STRATEGIES DISCOVERED: $COUNT"

cat > "$FLAGS_DIR/LAST_COMPLETED_SPRINT.json" <<EOF
{
  "sprint":"402-strategy-capability-discovery",
  "timestamp":"$TIMESTAMP",
  "status":"PASS"
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 402 RESULT]"
echo "STATUS: PASS"
echo "DISCOVERED: $COUNT"
echo "OUTPUT: $OUTPUT_JSON"
echo "=============================="
echo ""

echo "[SPRINT 402] COMPLETE"
