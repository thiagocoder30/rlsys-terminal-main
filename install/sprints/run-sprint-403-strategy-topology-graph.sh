#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS="$ROOT/install/sprints/flags"

MAP="$FLAGS/STRATEGY_CAPABILITY_MAP.json"

OUTPUT="$FLAGS/STRATEGY_TOPOLOGY_GRAPH.json"

echo "[SPRINT 403] STRATEGY TOPOLOGY GRAPH START"

if [ ! -f "$MAP" ]; then
  echo "[SPRINT 403][ERROR] Capability map not found"
  exit 1
fi

TMP="$FLAGS/topology_tmp.js"

cat > "$TMP" <<'NODE'
const fs = require('fs');

const map = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);

const strategies = map.strategies || [];

const graph = {
  generatedAt: new Date().toISOString(),
  nodes: [],
  edges: []
};

for (const strategy of strategies) {

  graph.nodes.push({
    id: strategy.name,
    domain: strategy.domain,
    risk: strategy.risk
  });

  for (const other of strategies) {

    if (strategy.name === other.name) {
      continue;
    }

    if (strategy.domain === other.domain) {

      graph.edges.push({
        from: strategy.name,
        to: other.name,
        relation: 'SAME_DOMAIN'
      });

    } else if (strategy.risk === other.risk) {

      graph.edges.push({
        from: strategy.name,
        to: other.name,
        relation: 'SAME_RISK'
      });

    }

  }

}

fs.writeFileSync(
  process.argv[3],
  JSON.stringify(graph, null, 2)
);

console.log(
  `NODES=${graph.nodes.length}`
);

console.log(
  `EDGES=${graph.edges.length}`
);
NODE

RESULT=$(node "$TMP" "$MAP" "$OUTPUT")

rm -f "$TMP"

echo "$RESULT"

echo
echo "=============================="
echo "[SPRINT 403 RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT"
echo "=============================="
echo

echo "[SPRINT 403] COMPLETE"
