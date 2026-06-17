#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 346-B"
echo " BUFFERED TELEMETRY SINK & TEST ISOLATION"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

ENGINE_FILE="src/application/runtime/AnalyticsDecisionEngine.ts"
OBS_DIR="src/application/observability"
BACKUP_FILE="$ENGINE_FILE.bak.sprint346b"

LOG_DIR="/sdcard/Download/rlsys/logs/sprint-346-b"
mkdir -p "$LOG_DIR"
mkdir -p "$OBS_DIR"

MAIN_LOG="$LOG_DIR/execution.log"
BUILD_LOG="$LOG_DIR/build.log"
TEST_LOG="$LOG_DIR/test.log"
exec > >(tee -a "$MAIN_LOG") 2>&1

echo "[1/3] Criando BufferedFileTelemetrySink..."
cat > "$OBS_DIR/BufferedFileTelemetrySink.ts" <<'EOF'
import * as fs from 'fs';
import * as path from 'path';
import type { AnalyticsShadowTelemetry, TelemetrySink } from './AnalyticsShadowTelemetry.js';

export class BufferedFileTelemetrySink implements TelemetrySink {
  private readonly filePath: string;
  private buffer: string[] = [];
  private readonly maxBufferSize: number;
  private isFlushing = false;

  public constructor(
    filePath: string = '/sdcard/Download/rlsys/telemetry/shadow-audit.jsonl',
    maxBufferSize: number = 5
  ) {
    this.filePath = filePath;
    this.maxBufferSize = maxBufferSize;
    this.ensureDirectoryExists();
  }

  public write(telemetry: AnalyticsShadowTelemetry): void {
    this.buffer.push(JSON.stringify(telemetry));
    if (this.buffer.length >= this.maxBufferSize && !this.isFlushing) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    this.isFlushing = true;
    const dataToFlush = this.buffer.join('\n') + '\n';
    this.buffer = [];

    fs.appendFile(this.filePath, dataToFlush, 'utf8', (error) => {
      this.isFlushing = false;
      if (error) console.warn('[TELEMETRY SINK ERROR] Falha de I/O:', error);
    });
  }

  private ensureDirectoryExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (error) { /* Silencia falha estrutural */ }
  }
}
EOF

echo "[2/3] Aplicando substituição atômica no AnalyticsDecisionEngine..."
cp "$ENGINE_FILE" "$BACKUP_FILE"

cat > "$ENGINE_FILE" <<'EOF'
import { TriplicacaoAdvancedProbabilityEngine } from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';
import { FusionHeatmapIntegrationEngine } from './FusionHeatmapIntegrationEngine.js';
import { AnalyticsShadowAuditor } from '../observability/AnalyticsShadowAuditor.js';
import { NullTelemetrySink } from '../observability/NullTelemetrySink.js';
import { BufferedFileTelemetrySink } from '../observability/BufferedFileTelemetrySink.js';
import type { TelemetrySink } from '../observability/AnalyticsShadowTelemetry.js';

export type AnalyticsDecisionRecommendation =
  | 'AGUARDAR'
  | 'PAPER_OBSERVAR'
  | 'PAPER_SINAL_FRACO'
  | 'PAPER_SINAL_FORTE';

export interface AnalyticsDecisionInput {
  readonly warmupRounds: readonly string[];
  readonly liveRounds: readonly string[];
  readonly minimumLiveRounds?: number;
}

export interface AnalyticsDecisionEngineResult {
  readonly recommendation: AnalyticsDecisionRecommendation;
  readonly confidence: number;
  readonly risk: number;
  readonly triplicacao: {
    readonly totalTrios: number;
    readonly tc: number;
    readonly ntc: number;
    readonly ta: number;
    readonly nta: number;
    readonly zeroTrios: number;
    readonly dominantPattern: 'TC' | 'NTC' | 'TA' | 'NTA' | 'NONE';
    readonly dominantRatio: number;
  };
  readonly heatmap: {
    readonly hotNumbers: readonly number[];
    readonly coldNumbers: readonly number[];
    readonly zeroFrequency: number;
  };
  readonly consensus: {
    readonly enginesAligned: number;
    readonly enginesTotal: number;
    readonly classification: 'NO_GO' | 'WEAK_CONTEXT' | 'WATCHLIST' | 'PAPER_ONLY';
  };
  readonly message: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticBetExecutionAllowed: false;
}

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, index) => index);

export class AnalyticsDecisionEngine {
  private readonly auditor = new AnalyticsShadowAuditor();
  private readonly telemetrySink: TelemetrySink;

  public constructor(telemetrySink?: TelemetrySink) {
    if (telemetrySink) {
      this.telemetrySink = telemetrySink;
    } else if (process.env.NODE_ENV === 'test') {
      this.telemetrySink = NullTelemetrySink.INSTANCE;
    } else {
      this.telemetrySink = new BufferedFileTelemetrySink();
    }
  }

  public evaluate(input: AnalyticsDecisionInput): AnalyticsDecisionEngineResult {
    const warmup = this.parseRounds(input.warmupRounds);
    const live = this.parseRounds(input.liveRounds);
    const minimumLiveRounds = input.minimumLiveRounds && input.minimumLiveRounds > 0 ? input.minimumLiveRounds : 6;
    const allRounds = Object.freeze([...warmup, ...live]);
    
    const triplicacao = this.computeTriplicacao(allRounds);
    const heatmap = this.computeHeatmap(allRounds);

    this.runShadowAuditing(allRounds, triplicacao, heatmap);

    if (warmup.length < 100) {
      return this.result({
        recommendation: 'AGUARDAR',
        confidence: 0,
        risk: 1,
        triplicacao,
        heatmap,
        consensus: { enginesAligned: 0, enginesTotal: 3, classification: 'NO_GO' },
        message: `Warmup insuficiente para decisão institucional. Warmup=${warmup.length}. Mínimo=100.`,
      });
    }

    if (live.length < minimumLiveRounds) {
      return this.result({
        recommendation: 'AGUARDAR',
        confidence: 0.18,
        risk: 0.82,
        triplicacao,
        heatmap,
        consensus: { enginesAligned: 1, enginesTotal: 3, classification: 'WEAK_CONTEXT' },
        message: [
          'AGUARDAR — contexto ao vivo insuficiente.',
          `Warmup=${warmup.length}`,
          `LiveRounds=${live.length}`,
          `MínimoLive=${minimumLiveRounds}`,
          'Triplicação/Heatmap calculados, mas sem autorização PAPER.',
        ].join(String.fromCharCode(10)),
      });
    }

    const triplicacaoSignal = triplicacao.dominantRatio >= 0.42 && triplicacao.totalTrios >= 35;
    const heatmapSignal = heatmap.hotNumbers.length >= 3 && heatmap.zeroFrequency <= 0.08;
    const liveSignal = live.length >= minimumLiveRounds;
    const enginesAligned = [triplicacaoSignal, heatmapSignal, liveSignal].filter(Boolean).length;

    const confidence = this.clamp(
      (triplicacao.dominantRatio * 0.45)
      + (Math.min(heatmap.hotNumbers.length, 5) / 5 * 0.25)
      + (Math.min(live.length, 20) / 20 * 0.30),
      0,
      0.99,
    );

    const risk = this.clamp(1 - confidence, 0.01, 1);

    if (enginesAligned >= 3 && confidence >= 0.68) {
      return this.result({
        recommendation: 'PAPER_SINAL_FORTE',
        confidence,
        risk,
        triplicacao,
        heatmap,
        consensus: { enginesAligned, enginesTotal: 3, classification: 'PAPER_ONLY' },
        message: [
          'PAPER_SINAL_FORTE — somente PAPER, supervisão humana obrigatória.',
          `Confiança=${confidence.toFixed(2)}`,
          `Risco=${risk.toFixed(2)}`,
          `Triplicação dominante=${triplicacao.dominantPattern}`,
        ].join(String.fromCharCode(10)),
      });
    }

    if (enginesAligned >= 2 && confidence >= 0.50) {
      return this.result({
        recommendation: 'PAPER_SINAL_FRACO',
        confidence,
        risk,
        triplicacao,
        heatmap,
        consensus: { enginesAligned, enginesTotal: 3, classification: 'WATCHLIST' },
        message: [
          'PAPER_SINAL_FRACO — watchlist. Não executar dinheiro real.',
          `Confiança=${confidence.toFixed(2)}`,
          `Risco=${risk.toFixed(2)}`,
          `Motores alinhados=${enginesAligned}/3`,
        ].join(String.fromCharCode(10)),
      });
    }

    return this.result({
      recommendation: 'PAPER_OBSERVAR',
      confidence,
      risk,
      triplicacao,
      heatmap,
      consensus: { enginesAligned, enginesTotal: 3, classification: 'WEAK_CONTEXT' },
      message: [
        'AGUARDAR — evidência insuficiente para sinal PAPER.',
        `Confiança=${confidence.toFixed(2)}`,
        `Risco=${risk.toFixed(2)}`,
        `Motores alinhados=${enginesAligned}/3`,
      ].join(String.fromCharCode(10)),
    });
  }

  private runShadowAuditing(
    allRounds: readonly number[],
    legacyTriplicacao: AnalyticsDecisionEngineResult['triplicacao'],
    legacyHeatmap: AnalyticsDecisionEngineResult['heatmap']
  ): void {
    try {
      const advancedTriplicacaoAnalysis = new TriplicacaoAdvancedProbabilityEngine().analyze(allRounds);
      const advancedPattern = advancedTriplicacaoAnalysis.selectedPatternKind ?? 'NONE';
      let advancedRatio = 0;
      if (advancedPattern !== 'NONE') {
        const metric = advancedTriplicacaoAnalysis.metrics.find((m) => m.patternKind === advancedPattern);
        if (metric && legacyTriplicacao.totalTrios > 0) advancedRatio = metric.occurrences / legacyTriplicacao.totalTrios;
      }

      const fusionReport = new FusionHeatmapIntegrationEngine().analyze(allRounds);
      const telemetry = this.auditor.capture({
        triplicacao: {
          legacyPattern: legacyTriplicacao.dominantPattern,
          legacyRatio: legacyTriplicacao.dominantRatio,
          advancedPattern: advancedPattern,
          advancedRatio: advancedRatio,
        },
        heatmap: {
          legacyHotNumbers: legacyHeatmap.hotNumbers,
          fusionHotNumbers: fusionReport.heatmap.hotNumbers.map((h) => h.number),
          fusionPressure: fusionReport.fusionPressureScore,
          recencyPressure: fusionReport.recencyPressureScore,
          dispersionScore: fusionReport.dispersionScore,
          mode: fusionReport.mode,
        }
      });
      this.telemetrySink.write(telemetry);
    } catch (error) {
      console.warn('[RL.SYS AUDITOR ERROR]', error);
    }
  }

  private computeTriplicacao(rounds: readonly number[]): AnalyticsDecisionEngineResult['triplicacao'] {
    let tc = 0; let ntc = 0; let ta = 0; let nta = 0; let zeroTrios = 0;
    for (let index = rounds.length - 1; index >= 2; index -= 3) {
      const trio = [rounds[index], rounds[index - 1], rounds[index - 2]];
      if (trio.includes(0)) { zeroTrios += 1; continue; }
      const colors = trio.map((value) => REDS.has(value) ? 'R' : 'B');
      if (colors[0] === colors[1] && colors[1] === colors[2]) tc += 1;
      else if (colors[0] === colors[1] && colors[1] !== colors[2]) ntc += 1;
      else if (colors[0] !== colors[1] && colors[1] !== colors[2] && colors[0] === colors[2]) ta += 1;
      else if (colors[0] !== colors[1] && colors[1] === colors[2]) nta += 1;
    }
    const pairs = [['TC', tc], ['NTC', ntc], ['TA', ta], ['NTA', nta]] as const;
    const totalTrios = tc + ntc + ta + nta;
    let dominantPattern: 'TC' | 'NTC' | 'TA' | 'NTA' | 'NONE' = 'NONE';
    let dominantCount = 0;
    for (const [pattern, count] of pairs) {
      if (count > dominantCount) { dominantPattern = pattern; dominantCount = count; }
    }
    return Object.freeze({
      totalTrios, tc, ntc, ta, nta, zeroTrios, dominantPattern,
      dominantRatio: totalTrios > 0 ? dominantCount / totalTrios : 0,
    });
  }

  private computeHeatmap(rounds: readonly number[]): AnalyticsDecisionEngineResult['heatmap'] {
    const counts = new Map<number, number>();
    for (const number of ROULETTE_NUMBERS) counts.set(number, 0);
    for (const round of rounds) counts.set(round, (counts.get(round) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0] - right[0];
    });
    return Object.freeze({
      hotNumbers: Object.freeze(ranked.filter(([, count]) => count > 0).slice(0, 5).map(([number]) => number)),
      coldNumbers: Object.freeze(ranked.slice().reverse().slice(0, 5).map(([number]) => number)),
      zeroFrequency: rounds.length > 0 ? (counts.get(0) ?? 0) / rounds.length : 0,
    });
  }

  private parseRounds(values: readonly string[]): readonly number[] {
    return Object.freeze(
      values.flatMap((value) => String(value).split(/[^0-9]+/u))
        .filter((part) => part.trim().length > 0)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 36),
    );
  }

  private result(input: Omit<AnalyticsDecisionEngineResult, 'paperOnly' | 'liveMoneyAuthorization' | 'automaticBetExecutionAllowed'>): AnalyticsDecisionEngineResult {
    return Object.freeze({ ...input, paperOnly: true, liveMoneyAuthorization: false, automaticBetExecutionAllowed: false });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
EOF

echo "[3/3] Executando CI/CD Gate..."
if ! npm run build > "$BUILD_LOG" 2>&1; then
  echo "[ERROR] Falha de compilação! Restaurando backup..."
  mv "$BACKUP_FILE" "$ENGINE_FILE"
  exit 1
fi
if ! npm test > "$TEST_LOG" 2>&1; then
  echo "[ERROR] Falha nos testes! Restaurando backup..."
  mv "$BACKUP_FILE" "$ENGINE_FILE"
  exit 1
fi

git add "$OBS_DIR"
git add "$ENGINE_FILE"
git commit -m "feat(observability): implement persistent telemetry sink with test isolation (Sprint 346-B)" > /dev/null
rm -f "$ENGINE_FILE.bak"*
echo "======================================"
echo " SPRINT 346-B FINALIZADA COM SUCESSO"
echo "======================================"

