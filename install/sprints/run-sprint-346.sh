#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 346"
echo " OBSERVABILITY PREPARATION LAYER"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

ENGINE_FILE="src/application/runtime/AnalyticsDecisionEngine.ts"
OBS_DIR="src/application/observability"

LOG_DIR="/sdcard/Download/rlsys/logs/sprint-346"
mkdir -p "$LOG_DIR"
mkdir -p "$OBS_DIR"

MAIN_LOG="$LOG_DIR/execution.log"
BUILD_LOG="$LOG_DIR/build.log"
TEST_LOG="$LOG_DIR/test.log"

exec > >(tee -a "$MAIN_LOG") 2>&1

echo "[1/6] Validando ambiente..."

test -f "$ENGINE_FILE" || {
  echo "[ERROR] Engine não encontrado: $ENGINE_FILE"
  exit 1
}

cp "$ENGINE_FILE" "$ENGINE_FILE.bak.sprint346"

echo "[2/6] Criando camada de observabilidade..."

cat > "$OBS_DIR/AnalyticsShadowTelemetry.ts" <<'EOF'
export interface AnalyticsShadowTelemetry {
  readonly timestamp: string;

  readonly triplicacao: {
    readonly parityMismatch: boolean;
    readonly ratioDrift: number;
    readonly legacyPattern: string;
    readonly advancedPattern: string;
  };
}

export interface TelemetrySink {
  write(telemetry: AnalyticsShadowTelemetry): void;
}
EOF

cat > "$OBS_DIR/NullTelemetrySink.ts" <<'EOF'
import type {
  AnalyticsShadowTelemetry,
  TelemetrySink,
} from './AnalyticsShadowTelemetry.js';

export class NullTelemetrySink implements TelemetrySink {
  public static readonly INSTANCE = new NullTelemetrySink();

  public write(_telemetry: AnalyticsShadowTelemetry): void {
    // no-op
  }
}
EOF

cat > "$OBS_DIR/AnalyticsShadowAuditor.ts" <<'EOF'
import type { AnalyticsShadowTelemetry } from './AnalyticsShadowTelemetry.js';

export interface AnalyticsShadowAuditorInput {
  readonly legacyPattern: string;
  readonly advancedPattern: string;
  readonly legacyRatio: number;
  readonly advancedRatio: number;
}

export class AnalyticsShadowAuditor {
  public capture(
    input: AnalyticsShadowAuditorInput,
  ): AnalyticsShadowTelemetry {
    return Object.freeze({
      timestamp: new Date().toISOString(),

      triplicacao: Object.freeze({
        parityMismatch:
          input.legacyPattern !== input.advancedPattern,

        ratioDrift: Math.abs(
          input.legacyRatio - input.advancedRatio,
        ),

        legacyPattern: input.legacyPattern,
        advancedPattern: input.advancedPattern,
      }),
    });
  }
}
EOF

echo "[3/6] Refatorando AnalyticsDecisionEngine..."

node <<'EOF'
const fs = require('fs');

const file =
  'src/application/runtime/AnalyticsDecisionEngine.ts';

let source = fs.readFileSync(file, 'utf8');

if (!source.includes('AnalyticsShadowAuditor')) {
  source =
    `import { AnalyticsShadowAuditor } from '../observability/AnalyticsShadowAuditor.js';
import { NullTelemetrySink } from '../observability/NullTelemetrySink.js';
import type { TelemetrySink } from '../observability/AnalyticsShadowTelemetry.js';
` + source;
}

if (!source.includes('private readonly telemetrySink')) {
  source = source.replace(
    'export class AnalyticsDecisionEngine {',
`export class AnalyticsDecisionEngine {
  private readonly auditor = new AnalyticsShadowAuditor();
  private readonly telemetrySink: TelemetrySink;

  public constructor(
    telemetrySink: TelemetrySink = NullTelemetrySink.INSTANCE,
  ) {
    this.telemetrySink = telemetrySink;
  }`
  );
}

if (!source.includes('private runShadowAuditing(')) {

  const oldBlock = `    // --------------------------------------------------------------
    // SHADOW RUN 1: TRIPLICAÇÃO (Com Parity Gate Determinístico)
    // --------------------------------------------------------------
`;

  const start = source.indexOf(oldBlock);

  if (start >= 0) {

    const decisionMarker =
`    // --------------------------------------------------------------
    // DECISÃO INSTITUCIONAL (Baseada exclusivamente no Legado)
    // --------------------------------------------------------------`;

    const end = source.indexOf(decisionMarker);

    const replacement =
`    this.runShadowAuditing(
      allRounds,
      triplicacao,
      heatmap,
    );

`;

    source =
      source.slice(0, start) +
      replacement +
      source.slice(end);
  }

  const method =
`
  private runShadowAuditing(
    allRounds: readonly number[],
    triplicacao: AnalyticsDecisionEngineResult['triplicacao'],
    heatmap: AnalyticsDecisionEngineResult['heatmap'],
  ): void {
    try {
      const advancedEngine =
        new TriplicacaoAdvancedProbabilityEngine();

      const advancedAnalysis =
        advancedEngine.analyze(allRounds);

      const advancedPattern =
        advancedAnalysis.selectedPatternKind ?? 'NONE';

      let advancedRatio = 0;

      if (advancedPattern !== 'NONE') {
        const metric =
          advancedAnalysis.metrics.find(
            (m) => m.patternKind === advancedPattern,
          );

        if (metric && triplicacao.totalTrios > 0) {
          advancedRatio =
            metric.occurrences /
            triplicacao.totalTrios;
        }
      }

      const telemetry =
        this.auditor.capture({
          legacyPattern:
            triplicacao.dominantPattern,
          advancedPattern,
          legacyRatio:
            triplicacao.dominantRatio,
          advancedRatio,
        });

      this.telemetrySink.write(telemetry);

      const fusionEngine =
        new FusionHeatmapIntegrationEngine();

      const fusionReport =
        fusionEngine.analyze(allRounds);

      console.warn(
        '[RL.SYS FUSION SHADOW]',
        {
          legacyHot: heatmap.hotNumbers,
          fusionHot:
            fusionReport.heatmap.hotNumbers.map(
              h => h.number,
            ),

          legacyCold: heatmap.coldNumbers,
          fusionCold:
            fusionReport.heatmap.coldNumbers.map(
              h => h.number,
            ),

          fusionPressure:
            fusionReport.fusionPressureScore,

          recencyPressure:
            fusionReport.recencyPressureScore,

          dispersion:
            fusionReport.dispersionScore,

          mode: fusionReport.mode,
          signal:
            fusionReport.signalStrength,
        },
      );
    } catch (error) {
      console.warn(
        '[RL.SYS AUDITOR ERROR]',
        error,
      );
    }
  }

`;

  source = source.replace(
    '  private computeTriplicacao(',
    method + '  private computeTriplicacao(',
  );
}

fs.writeFileSync(file, source);
EOF

echo "[4/6] Build..."

if ! npm run build > "$BUILD_LOG" 2>&1; then
  echo "[ERROR] BUILD FAILURE"
  mv "$ENGINE_FILE.bak.sprint346" "$ENGINE_FILE"
  tail -n 50 "$BUILD_LOG"
  exit 1
fi

echo "[5/6] Testes..."

if ! npm test > "$TEST_LOG" 2>&1; then
  echo "[ERROR] TEST FAILURE"
  mv "$ENGINE_FILE.bak.sprint346" "$ENGINE_FILE"
  tail -n 50 "$TEST_LOG"
  exit 1
fi

echo "[6/6] Commit..."

git add "$ENGINE_FILE"
git add "$OBS_DIR"

git commit -m "feat(observability): prepare telemetry abstraction layer (Sprint 346)

- add AnalyticsShadowTelemetry contract
- add AnalyticsShadowAuditor
- add NullTelemetrySink
- introduce DIP in AnalyticsDecisionEngine
- encapsulate shadow execution into runShadowAuditing
- preserve paper-only institutional behavior
- keep shadow mode observational only"

echo "[OK] Sprint 346 concluída"
echo "Logs: $LOG_DIR"
