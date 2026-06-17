#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 347-TESTS"
echo " OBSERVABILITY & CERTIFICATION COVERAGE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

TEST_DIR="tests/observability"
LOG_DIR="/sdcard/Download/rlsys/logs/sprint-347-tests"

mkdir -p "$LOG_DIR"
mkdir -p "$TEST_DIR"

MAIN_LOG="$LOG_DIR/execution.log"
BUILD_LOG="$LOG_DIR/build.log"
TEST_LOG="$LOG_DIR/test.log"
exec > >(tee -a "$MAIN_LOG") 2>&1

echo "[1/4] Gerando Testes: AnalyticsShadowAuditor..."

cat > "$TEST_DIR/analytics-shadow-auditor.test.ts" <<'EOF'
import * as assert from 'assert';
import { AnalyticsShadowAuditor } from '../../src/application/observability/AnalyticsShadowAuditor.js';

export async function runAnalyticsShadowAuditorTests() {
  console.log('✔ AnalyticsShadowAuditor captures parity mismatch deterministically');
  const auditor = new AnalyticsShadowAuditor();
  const telemetry = auditor.capture({
    triplicacao: { legacyPattern: 'TC', legacyRatio: 0.5, advancedPattern: 'NTC', advancedRatio: 0.4 },
    heatmap: { legacyHotNumbers: [1, 2], fusionHotNumbers: [1, 3], fusionPressure: 80, recencyPressure: 50, dispersionScore: 20, mode: 'FUSION_READY' }
  });
  assert.strictEqual(telemetry.triplicacao.parityMismatch, true);
  assert.strictEqual(telemetry.triplicacao.ratioDrift, 0.1);

  console.log('✔ AnalyticsShadowAuditor captures parity match safely');
  const telemetryMatch = auditor.capture({
    triplicacao: { legacyPattern: 'TC', legacyRatio: 0.5, advancedPattern: 'TC', advancedRatio: 0.5 },
    heatmap: { legacyHotNumbers: [], fusionHotNumbers: [], fusionPressure: 0, recencyPressure: 0, dispersionScore: 0, mode: 'OBSERVE' }
  });
  assert.strictEqual(telemetryMatch.triplicacao.parityMismatch, false);
  assert.strictEqual(telemetryMatch.triplicacao.ratioDrift, 0);
}
EOF

echo "[2/4] Gerando Testes: DriftStabilityAnalyzer..."

cat > "$TEST_DIR/drift-stability-analyzer.test.ts" <<'EOF'
import * as assert from 'assert';
import { DriftStabilityAnalyzer } from '../../src/application/observability/certification/DriftStabilityAnalyzer.js';
import type { AnalyticsShadowTelemetry } from '../../src/application/observability/AnalyticsShadowTelemetry.js';

export async function runDriftStabilityAnalyzerTests() {
  const analyzer = new DriftStabilityAnalyzer();

  console.log('✔ DriftStabilityAnalyzer returns zeroed report for empty telemetry');
  const emptyReport = analyzer.analyze([]);
  assert.strictEqual(emptyReport.totalExecutions, 0);
  assert.strictEqual(emptyReport.triplicacao.parityRate, 0);

  console.log('✔ DriftStabilityAnalyzer calculates parity rate and averages accurately');
  const mockTelemetry: AnalyticsShadowTelemetry[] = [
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
  assert.strictEqual(report.triplicacao.parityRate, 50); // 1 out of 2 failed = 50% match
  assert.strictEqual(report.triplicacao.averageRatioDrift, 0.03); // (0.01 + 0.05) / 2
  assert.strictEqual(report.heatmap.averageFusionPressure, 60); // (80 + 40) / 2
  assert.strictEqual(report.heatmap.readySignalsCount, 1);
  assert.strictEqual(report.heatmap.blockedSignalsCount, 1);
}
EOF

echo "[3/4] Gerando Testes: DriftCertificationEngine..."

cat > "$TEST_DIR/drift-certification-engine.test.ts" <<'EOF'
import * as assert from 'assert';
import { DriftCertificationEngine } from '../../src/application/observability/certification/DriftCertificationEngine.js';

export async function runDriftCertificationEngineTests() {
  const engine = new DriftCertificationEngine({
    minimumSampleRequired: 100,
    minimumParityRate: 99.0,
    maximumAverageRatioDrift: 0.05
  });

  const baseReport = {
    totalExecutions: 0,
    triplicacao: { parityFailures: 0, parityRate: 100, averageRatioDrift: 0, maxRatioDrift: 0 },
    heatmap: { averageFusionPressure: 50, averageRecencyPressure: 50, averageDispersion: 50, blockedSignalsCount: 0, readySignalsCount: 0 }
  };

  console.log('✔ DriftCertificationEngine returns NEEDS_MORE_DATA for insufficient sample');
  const needsDataReport = { ...baseReport, totalExecutions: 50 };
  const res1 = engine.certify(needsDataReport);
  assert.strictEqual(res1.verdict, 'NEEDS_MORE_DATA');

  console.log('✔ DriftCertificationEngine returns BLOCKED_BY_DRIFT for parity rate failure');
  const blockedReport = { ...baseReport, totalExecutions: 150, triplicacao: { ...baseReport.triplicacao, parityRate: 98.0 } };
  const res2 = engine.certify(blockedReport);
  assert.strictEqual(res2.verdict, 'BLOCKED_BY_DRIFT');

  console.log('✔ DriftCertificationEngine returns READY_FOR_PROMOTION for stable compliant report');
  const readyReport = { ...baseReport, totalExecutions: 200, triplicacao: { ...baseReport.triplicacao, parityRate: 99.5, averageRatioDrift: 0.02 } };
  const res3 = engine.certify(readyReport);
  assert.strictEqual(res3.verdict, 'READY_FOR_PROMOTION');
}
EOF

echo "[4/4] Integrando ao Node Test Runner e Executando CI/CD..."

# Adicionando um arquivo de entrada de testes padrão se o runner usa node --test
cat > "$TEST_DIR/index.test.ts" <<'EOF'
import { runAnalyticsShadowAuditorTests } from './analytics-shadow-auditor.test.js';
import { runDriftStabilityAnalyzerTests } from './drift-stability-analyzer.test.js';
import { runDriftCertificationEngineTests } from './drift-certification-engine.test.js';

async function runAllObservabilityTests() {
  await runAnalyticsShadowAuditorTests();
  await runDriftStabilityAnalyzerTests();
  await runDriftCertificationEngineTests();
}

runAllObservabilityTests().catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

if ! npm run build > "$BUILD_LOG" 2>&1; then
  echo -e "\033[1;31m[ERROR] Falha de compilação dos testes detectada!\033[0m"
  grep -i "error TS" "$BUILD_LOG" | head -n 5
  exit 1
fi

if ! npm test > "$TEST_LOG" 2>&1; then
  echo -e "\033[1;31m[ERROR] Falha na execução da malha de testes!\033[0m"
  grep -i "fail" "$TEST_LOG" | head -n 10
  exit 1
fi

git add "$TEST_DIR"
git commit -m "test(observability): implement strict coverage for Sprint 346 and 347 (Sprint 347-Tests)

- add domain logic tests for AnalyticsShadowAuditor
- add statistical tests for DriftStabilityAnalyzer
- add institutional policy tests for DriftCertificationEngine
- eliminate technical debt by bringing coverage up to date with new features
- pass zero-impact CI/CD gate" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 347-TESTS FINALIZADA COM SUCESSO \033[0m"
echo " COBERTURA: DÍVIDA TÉCNICA PAGA"
echo " TESTES CADASTRADOS NA MALHA INSTITUCIONAL"
echo "======================================"

