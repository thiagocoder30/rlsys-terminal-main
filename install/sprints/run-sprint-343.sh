#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

ARTIFACT_DIR="artifacts/runtime-promotion"
mkdir -p "$ARTIFACT_DIR"

DOWNLOAD_DIR="/sdcard/Download"
mkdir -p "$DOWNLOAD_DIR"

echo "====================================================="
echo " RL.SYS CORE - SPRINT 343"
echo " Runtime Promotion Simulation"
echo "====================================================="

cat > "$ARTIFACT_DIR/runtime-call-graph.json" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "engines": {}
}
EOF

node <<'NODE'
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const ENGINES = [
  'AnalyticsDecisionEngine',
  'FusionHeatmapIntegrationEngine',
  'InstitutionalMultiStrategyConsensusRuntime',
  'AdaptiveConsensusConfidenceEngine',
  'WheelHeatmapAnalyticsEngine',
  'TriplicacaoPatternEngine',
  'TriplicacaoAdvancedProbabilityEngine'
];

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walk(full, result);
    } else {
      result.push(full);
    }
  }

  return result;
}

const sourceFiles = walk(path.join(ROOT, 'src'));
const graph = {};

for (const engine of ENGINES) {
  graph[engine] = {
    sourceFile: null,
    referencedBy: [],
    dependencies: []
  };

  const source = sourceFiles.find(f => path.basename(f).startsWith(engine));

  if (source) {
    graph[engine].sourceFile = source.replace(ROOT + '/', '');
    const content = fs.readFileSync(source, 'utf8');

    for (const other of ENGINES) {
      if (other === engine) continue;
      if (content.includes(other)) {
        graph[engine].dependencies.push(other);
      }
    }
  }

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');

    if (
      content.includes(engine) &&
      !file.endsWith(`${engine}.ts`) &&
      !file.endsWith(`${engine}.js`)
    ) {
      graph[engine].referencedBy.push(file.replace(ROOT + '/', ''));
    }
  }
}

fs.writeFileSync(
  path.join(ROOT, 'artifacts/runtime-promotion/runtime-call-graph.json'),
  JSON.stringify(graph, null, 2)
);

const analytics = graph.AnalyticsDecisionEngine;

fs.writeFileSync(
  path.join(ROOT, 'artifacts/runtime-promotion/analytics-decision-dependencies.json'),
  JSON.stringify(analytics, null, 2)
);

const candidates = [];

for (const [name, info] of Object.entries(graph)) {
  if (name !== 'AnalyticsDecisionEngine' && info.referencedBy.length === 0) {
    candidates.push(name);
  }
}

const promotionOrder = [];
if (candidates.includes('TriplicacaoAdvancedProbabilityEngine')) promotionOrder.push('TriplicacaoAdvancedProbabilityEngine');
if (candidates.includes('FusionHeatmapIntegrationEngine')) promotionOrder.push('FusionHeatmapIntegrationEngine');
if (candidates.includes('InstitutionalMultiStrategyConsensusRuntime')) promotionOrder.push('InstitutionalMultiStrategyConsensusRuntime');
if (candidates.includes('AdaptiveConsensusConfidenceEngine')) promotionOrder.push('AdaptiveConsensusConfidenceEngine');

fs.writeFileSync(
  path.join(ROOT, 'artifacts/runtime-promotion/promotion-order.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), promotionOrder }, null, 2)
);

const report = [];
report.push('RL.SYS CORE - Runtime Promotion Report');
report.push('');
report.push('AnalyticsDecisionEngine');
report.push(JSON.stringify(analytics, null, 2));
report.push('');
report.push('Promotion Candidates');
report.push(JSON.stringify(promotionOrder, null, 2));

fs.writeFileSync(
  path.join(ROOT, 'artifacts/runtime-promotion/promotion-impact-report.txt'),
  report.join('\n')
);
NODE

cp -f artifacts/runtime-promotion/runtime-call-graph.json "$DOWNLOAD_DIR/runtime-call-graph.json"
cp -f artifacts/runtime-promotion/analytics-decision-dependencies.json "$DOWNLOAD_DIR/analytics-decision-dependencies.json"
cp -f artifacts/runtime-promotion/promotion-order.json "$DOWNLOAD_DIR/promotion-order.json"
cp -f artifacts/runtime-promotion/promotion-impact-report.txt "$DOWNLOAD_DIR/promotion-impact-report.txt"

echo
echo "Artifacts generated:"
ls -1 artifacts/runtime-promotion
echo "====================================================="
echo " SPRINT 343 COMPLETED"
echo "====================================================="
