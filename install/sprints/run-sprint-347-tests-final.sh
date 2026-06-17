#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 347-TESTS-FINAL"
echo " TOP-LEVEL GOVERNANCE COMPLIANCE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

# 1. Removendo a pasta aninhada que violou a governança do repositório
echo "[1/3] Removendo pasta proibida (Dívida de Governança)..."
rm -rf tests/observability

# 2. Criando os testes no Top-Level da pasta tests/ (Padrão Institucional)
echo "[2/3] Gerando Testes Nativos (Top-Level)..."

cat > tests/observability-analytics-shadow-auditor.test.js <<'EOF'
import test from 'node:test';
import assert from 'node:assert';
import { AnalyticsShadowAuditor } from '../src/application/observability/AnalyticsShadowAuditor.js';

test('AnalyticsShadowAuditor captures parity mismatch deterministically', () => {
  const auditor = new AnalyticsShadowAuditor();
  const telemetry = auditor.capture({
    triplicacao: { legacyPattern: 'TC', legacyRatio: 0.5, advancedPattern: 'NTC', advancedRatio: 0.4 },
    heatmap: { legacyHotNumbers: [1, 2], fusionHotNumbers: [1, 3], fusionPressure: 80, recencyPressure: 50, dispersionScore: 20, mode: 'FUSION_READY' }
  });
  assert.strictEqual(telemetry.triplicacao.parityMismatch, true);
  assert.strictEqual(telemetry.triplicacao.ratioDrift, 0.1);
});

test('AnalyticsShadowAuditor captures parity match safely', () => {
  const auditor = new AnalyticsShadowAuditor();
  const telemetryMatch = auditor.capture({
    triplicacao: { legacyPattern: 'TC', legacyRatio: 0.5, advancedPattern: 'TC', advancedRatio: 0.5 },
    heatmap: { legacyHotNumbers: [], fusionHotNumbers: [], fusionPressure: 0, recencyPressure: 0, dispersionScore: 0, mode: 'OBSERVE' }
  });
  assert.strictEqual(telemetryMatch.triplicacao.parityMismatch, false);
  assert.strictEqual(telemetryMatch.triplicacao.ratioDrift, 0);
});
EOF

cat > tests/observability-drift-stability-analyzer.test.js <<'EOF'
import test from 'node:test';
import assert from 'node:assert';
import { DriftStabilityAnalyzer } from '../src/application/observability/certification/DriftStabilityAnalyzer.js';

test('DriftStabilityAnalyzer returns zeroed report for empty telemetry', () => {
  const analyzer = new DriftStabilityAnalyzer();
  const emptyReport = analyzer.analyze([]);
  assert.strictEqual(emptyReport.totalExecutions, 0);
  assert.strictEqual(emptyReport.triplicacao.parityRate, 0);
});

test('DriftStabilityAnalyzer calculates parity rate and averages accurately', () => {
  const analyzer = new DriftStabilityAnalyzer();
  const mockTelemetry = [
    {
      timestamp: '2026-06-13T10:00:00Z',
      triplicacao: { parityMismatch: false, ratioDrift: 0.01, legacyPattern: 'TC', advancedPattern: 'TC' },
      heatmap: { legacyHotNumbers: [], fusionHotNumbers: [], fusionPressure: 80, recencyPressure: 60, dispersionScore: 20, mode: 'FUSION_READY' }
    },
    {
      timestamp: '2026-06-13T10:01:00Z',
      triplicacao: { parityMismatch: true, ratioDrift: 0.05, legacyPattern: 'TC', advancedPattern: 'NTC' },
      heatmap: { legacyHotNumbers: [], fusionHotNumbers: [], fusionPressure: 40, recencyPressure: 40, dispersionScore: 80, mode: 'BLOCKED' }
    }
  ];

  const report = analyzer.analyze(mockTelemetry);
  assert.strictEqual(report.totalExecutions, 2);
  assert.strictEqual(report.triplicacao.parityFailures, 1);
  assert.strictEqual(report.triplicacao.parityRate, 50);
  assert.strictEqual(report.triplicacao.averageRatioDrift, 0.03);
  assert.strictEqual(report.heatmap.averageFusionPressure, 60);
  assert.strictEqual(report.heatmap.readySignalsCount, 1);
  assert.strictEqual(report.heatmap.blockedSignalsCount, 1);
});
EOF

cat > tests/observability-drift-certification-engine.test.js <<'EOF'
import test from 'node:test';
import assert from 'node:assert';
import { DriftCertificationEngine } from '../src/application/observability/certification/DriftCertificationEngine.js';

const baseReport = {
  totalExecutions: 0,
  triplicacao: { parityFailures: 0, parityRate: 100, averageRatioDrift: 0, maxRatioDrift: 0 },
  heatmap: { averageFusionPressure: 50, averageRecencyPressure: 50, averageDispersion: 50, blockedSignalsCount: 0, readySignalsCount: 0 }
};

test('DriftCertificationEngine returns NEEDS_MORE_DATA for insufficient sample', () => {
  const engine = new DriftCertificationEngine({ minimumSampleRequired: 100, minimumParityRate: 99.0, maximumAverageRatioDrift: 0.05 });
  const needsDataReport = { ...baseReport, totalExecutions: 50 };
  const res = engine.certify(needsDataReport);
  assert.strictEqual(res.verdict, 'NEEDS_MORE_DATA');
});

test('DriftCertificationEngine returns BLOCKED_BY_DRIFT for parity rate failure', () => {
  const engine = new DriftCertificationEngine({ minimumSampleRequired: 100, minimumParityRate: 99.0, maximumAverageRatioDrift: 0.05 });
  const blockedReport = { ...baseReport, totalExecutions: 150, triplicacao: { ...baseReport.triplicacao, parityRate: 98.0 } };
  const res = engine.certify(blockedReport);
  assert.strictEqual(res.verdict, 'BLOCKED_BY_DRIFT');
});

test('DriftCertificationEngine returns READY_FOR_PROMOTION for stable compliant report', () => {
  const engine = new DriftCertificationEngine({ minimumSampleRequired: 100, minimumParityRate: 99.0, maximumAverageRatioDrift: 0.05 });
  const readyReport = { ...baseReport, totalExecutions: 200, triplicacao: { ...baseReport.triplicacao, parityRate: 99.5, averageRatioDrift: 0.02 } };
  const res = engine.certify(readyReport);
  assert.strictEqual(res.verdict, 'READY_FOR_PROMOTION');
});
EOF

echo "[3/3] Executando CI/CD Gate..."
TEST_LOG="/sdcard/Download/rlsys/logs/sprint-347-tests-final.log"
mkdir -p /sdcard/Download/rlsys/logs

if ! npm test > "$TEST_LOG" 2>&1; then
  echo -e "\033[1;31m[ERROR] Falha na execução da malha de testes!\033[0m"
  tail -n 30 "$TEST_LOG"
  exit 1
fi

git add tests/
git commit -m "test(observability): comply with institutional top-level testing governance (Sprint 347-Tests)

- remove forbidden nested tests/observability directory
- relocate observability tests to root tests/ matching project governance
- maintain rigorous node:test domain validation
- restore 100% CI/CD compliance" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 347-TESTS FINALIZADA COM SUCESSO \033[0m"
echo " GOVERNANÇA: TESTES TOP-LEVEL RECONHECIDOS"
echo "======================================"

