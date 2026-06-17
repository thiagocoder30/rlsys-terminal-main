#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

OUTPUT_FILE="$FLAGS_DIR/REAL_STRATEGY_DEPENDENCY_GRAPH.json"

TMP_NODE="$FLAGS_DIR/real_dependency_analyzer.js"

mkdir -p "$FLAGS_DIR"

echo "[SPRINT 404] REAL DEPENDENCY ANALYZER START"

cat > "$TMP_NODE" <<'NODE'
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const OUTPUT = process.argv[3];

const strategyRoot = path.join(
  ROOT,
  'src',
  'domain',
  'strategy'
);

function walk(dir) {
  let results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir)) {

    const full = path.join(dir, entry);

    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results.push(...walk(full));
      continue;
    }

    if (
      full.endsWith('.ts') ||
      full.endsWith('.js')
    ) {
      results.push(full);
    }
  }

  return results;
}

const files = walk(strategyRoot);

const graph = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  nodes: [],
  edges: []
};

const nodeSet = new Set();
const edgeSet = new Set();

for (const file of files) {

  const name = path.basename(
    file,
    path.extname(file)
  );

  nodeSet.add(name);

  const content = fs.readFileSync(
    file,
    'utf8'
  );

  const importMatches = [
    ...content.matchAll(
      /import\s+.*?from\s+['"](.*?)['"]/g
    )
  ];

  const requireMatches = [
    ...content.matchAll(
      /require\(['"](.*?)['"]\)/g
    )
  ];

  const newMatches = [
    ...content.matchAll(
      /new\s+([A-Za-z0-9_]+)/g
    )
  ];

  for (const match of importMatches) {

    const target = match[1];

    const edge =
      `${name}|IMPORT|${target}`;

    if (!edgeSet.has(edge)) {
      edgeSet.add(edge);

      graph.edges.push({
        from: name,
        to: target,
        relation: 'IMPORT'
      });
    }
  }

  for (const match of requireMatches) {

    const target = match[1];

    const edge =
      `${name}|REQUIRE|${target}`;

    if (!edgeSet.has(edge)) {
      edgeSet.add(edge);

      graph.edges.push({
        from: name,
        to: target,
        relation: 'REQUIRE'
      });
    }
  }

  for (const match of newMatches) {

    const target = match[1];

    const edge =
      `${name}|INSTANTIATES|${target}`;

    if (!edgeSet.has(edge)) {
      edgeSet.add(edge);

      graph.edges.push({
        from: name,
        to: target,
        relation: 'INSTANTIATES'
      });
    }
  }
}

graph.nodes = [...nodeSet]
  .sort()
  .map(name => ({
    id: name
  }));

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(
    graph,
    null,
    2
  )
);

console.log(
  `FILES=${graph.scannedFiles}`
);

console.log(
  `NODES=${graph.nodes.length}`
);

console.log(
  `EDGES=${graph.edges.length}`
);
NODE

RESULT=$(
  node "$TMP_NODE" \
  "$ROOT" \
  "$OUTPUT_FILE"
)

rm -f "$TMP_NODE"

echo "$RESULT"

echo
echo "=============================="
echo "[SPRINT 404 RESULT]"
echo "STATUS: PASS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="
echo

echo "[SPRINT 404] COMPLETE"
