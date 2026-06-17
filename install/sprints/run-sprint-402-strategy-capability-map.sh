#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"
LOGS_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOGS_DIR"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"

CAPABILITY_FILE="$ROOT/src/domain/strategy/StrategyCapabilityMap.ts"
JSON_FILE="$FLAGS_DIR/STRATEGY_CAPABILITY_MAP.json"

echo "[SPRINT 402] STRATEGY CAPABILITY MAP START"

mkdir -p "$ROOT/src/domain/strategy"

cat > "$CAPABILITY_FILE" <<'EOF'
export type StrategyRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

export interface StrategyCapability {
  readonly name: string;
  readonly domain: string;
  readonly risk: StrategyRiskLevel;
  readonly signals: readonly string[];
  readonly sourceFile: string;
}

export class StrategyCapabilityMap {
  private readonly capabilities = new Map<string, StrategyCapability>();

  public register(capability: StrategyCapability): void {
    this.capabilities.set(capability.name, capability);
  }

  public get(name: string): StrategyCapability | undefined {
    return this.capabilities.get(name);
  }

  public getAll(): readonly StrategyCapability[] {
    return Array.from(this.capabilities.values());
  }
}
EOF

echo "[SPRINT 402] Scanning strategy repository..."

node <<EOF
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[1];

const strategyDir = path.join(ROOT, 'src');

const output = {};

function scan(dir) {
  if (!fs.existsSync(dir)) return;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);

    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      scan(full);
      continue;
    }

    if (!item.endsWith('.ts')) continue;

    if (
      item.includes('Strategy') ||
      item.includes('Engine')
    ) {
      const name = item.replace('.ts', '');

      output[name] = {
        domain: inferDomain(full),
        risk: inferRisk(name),
        signals: inferSignals(name),
        sourceFile: full.replace(ROOT + '/', '')
      };
    }
  }
}

function inferDomain(file) {
  const normalized = file.toLowerCase();

  if (normalized.includes('warmup')) return 'warmup';
  if (normalized.includes('context')) return 'context';
  if (normalized.includes('decision')) return 'decision';
  if (normalized.includes('risk')) return 'risk';
  if (normalized.includes('confidence')) return 'confidence';
  if (normalized.includes('volatility')) return 'volatility';
  if (normalized.includes('momentum')) return 'momentum';

  return 'general';
}

function inferRisk(name) {
  const n = name.toLowerCase();

  if (
    n.includes('risk') ||
    n.includes('execution')
  ) return 'HIGH';

  if (
    n.includes('strategy') ||
    n.includes('decision')
  ) return 'MEDIUM';

  return 'LOW';
}

function inferSignals(name) {
  const n = name.toLowerCase();

  const signals = [];

  if (n.includes('momentum')) signals.push('momentum');
  if (n.includes('sector')) signals.push('sector');
  if (n.includes('volatility')) signals.push('volatility');
  if (n.includes('confidence')) signals.push('confidence');
  if (n.includes('context')) signals.push('context');
  if (n.includes('warmup')) signals.push('warmup');

  if (signals.length === 0) {
    signals.push('generic');
  }

  return signals;
}

scan(strategyDir);

fs.writeFileSync(
  process.argv[2],
  JSON.stringify(output, null, 2)
);

console.log(
  '[SPRINT 402] Capability map generated with',
  Object.keys(output).length,
  'entries'
);

EOF "$ROOT" "$JSON_FILE"

echo "[SPRINT 402] VALIDATION"

if [ ! -f "$JSON_FILE" ]; then
  echo "[SPRINT 402][FAIL] Capability map not generated"
  exit 1
fi

COUNT=$(grep -o "\"domain\"" "$JSON_FILE" | wc -l || true)

echo "[SPRINT 402] Strategies mapped: $COUNT"

cat > "$FLAGS_DIR/LAST_COMPLETED_SPRINT.json" <<EOF
{
  "sprint":"402-strategy-capability-map",
  "timestamp":"$TIMESTAMP",
  "status":"PASS"
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 402 RESULT]"
echo "STATUS: PASS"
echo "CAPABILITY MAP GENERATED"
echo "FILE: $JSON_FILE"
echo "=============================="
echo ""
echo "[SPRINT 402] COMPLETE"
