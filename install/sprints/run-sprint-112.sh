#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-112-warmup-qualification-runtime-pipeline"
COMMIT_MSG="feat(warmup): add qualification runtime pipeline"

SPRINT_ID="112"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

mkdir -p logs /sdcard/Download 2>/dev/null || true

LOG_FILE="logs/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_LOG_FILE="/sdcard/Download/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"

exec > >(tee -a "$LOG_FILE" "$DOWNLOAD_LOG_FILE" 2>/dev/null || tee -a "$LOG_FILE") 2>&1

finish() {
  code="$?"

  echo ""
  echo "============================================================"

  if [ "$code" -eq 0 ]; then
    echo "Sprint ${SPRINT_ID} SUCESSO"
  else
    echo "Sprint ${SPRINT_ID} FALHOU"
  fi

  echo "Status: $code"
  echo "Log local: $LOG_FILE"
  echo "Log Download: $DOWNLOAD_LOG_FILE"
  echo "============================================================"

  exit "$code"
}

trap finish EXIT

echo "== RL.SYS CORE :: Sprint 112 =="
echo "== Warmup Qualification Runtime Pipeline =="
echo "== Correção institucional limpa, sem stubs falsos =="

[ -d .git ] || {
  echo "Execute na raiz do repositório"
  exit 1
}

echo "== Sincronizando main =="

git fetch origin main
git checkout main
git reset --hard origin/main

echo "== Limpando resíduos de tentativas anteriores =="

rm -rf src/warmup
rm -rf dist/warmup
rm -f scripts/warmup-qualification-runtime.js
rm -f tests/warmup-qualification-runtime-pipeline.test.js
rm -f src/application/warmup/WarmupQualificationRuntimePipeline.ts

echo "== Validando dependências reais =="

REQUIRED_FILES=(
  "src/domain/vision/VisionWarmupNormalizer.ts"
  "src/domain/vision/VisionReliabilityInspector.ts"
  "src/domain/session/WarmupSessionAnalyzer.ts"
  "src/domain/shared/Result.ts"
  "package.json"
  "tsconfig.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERRO: dependência real ausente -> $file"
    exit 1
  fi
done

git branch -D "$BRANCH" 2>/dev/null || true
git push origin --delete "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p src/application/warmup scripts tests data/paper-runtime

cat > src/application/warmup/WarmupQualificationRuntimePipeline.ts <<'EOF'
import { WarmupSessionAnalyzer, WarmupSessionReport, WarmupTableGate } from '../../domain/session/WarmupSessionAnalyzer';
import { VisionReliabilityInspector, VisionReliabilityReport } from '../../domain/vision/VisionReliabilityInspector';
import { VisionWarmupExtraction, VisionWarmupNormalizer } from '../../domain/vision/VisionWarmupNormalizer';

export type WarmupQualificationSource = 'manual' | 'vision';
export type WarmupQualificationStatus = 'BLOCKED' | 'OBSERVE' | 'QUALIFIED';

export type WarmupQualificationReason =
  | 'EMPTY_INPUT'
  | 'VISION_REJECTED'
  | 'OCR_RELIABILITY_REJECTED'
  | 'WARMUP_TABLE_NO_GO'
  | 'WARMUP_TABLE_OBSERVE'
  | 'WARMUP_TABLE_QUALIFIED'
  | 'INTERNAL_ERROR';

export interface WarmupQualificationRuntimeInput {
  readonly source?: WarmupQualificationSource;
  readonly values?: readonly unknown[];
  readonly visionRaw?: unknown;
  readonly requiredWarmupSize?: number;
}

export interface WarmupCanonicalExtraction {
  readonly values: readonly number[];
  readonly accepted: number;
  readonly rejected: number;
  readonly declaredTotal?: number;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly reliability: VisionReliabilityReport;
}

export interface WarmupQualificationDecision {
  readonly tableQualified: boolean;
  readonly supervisedObservationAllowed: boolean;
  readonly supervisedOperationAllowed: boolean;
  readonly liveMoneyAllowed: false;
  readonly productionMoneyAllowed: false;
  readonly requiresHumanReview: true;
}

export interface WarmupQualificationReport {
  readonly service: 'WarmupQualificationRuntimePipeline';
  readonly schemaVersion: '1.0.0';
  readonly generatedAt: string;
  readonly source: WarmupQualificationSource;
  readonly status: WarmupQualificationStatus;
  readonly reason: WarmupQualificationReason;
  readonly operationalGate: 'BLOCKED';
  readonly extraction: WarmupCanonicalExtraction;
  readonly warmup?: WarmupSessionReport;
  readonly confidenceScore: number;
  readonly decision: WarmupQualificationDecision;
  readonly humanExplanation: readonly string[];
}

/**
 * Orquestra o warm-up institucional antes da operação paper/live.
 *
 * Esta aplicação não tenta prever número e não abre gate financeiro.
 * Ela transforma as últimas rodadas em qualificação contextual:
 * OCR/manual -> confiabilidade -> análise estatística -> decisão supervisionada.
 *
 * Complexidade:
 * - Tempo: O(n), onde n é o número de rodadas informadas.
 * - Espaço: O(37), reaproveitando os motores estatísticos de domínio.
 */
export class WarmupQualificationRuntimePipeline {
  private readonly normalizer = new VisionWarmupNormalizer();

  public qualify(input: WarmupQualificationRuntimeInput | unknown): WarmupQualificationReport {
    const normalizedInput = this.normalizeInput(input);
    const requiredWarmupSize = this.resolveRequiredWarmupSize(normalizedInput.requiredWarmupSize);
    const source = normalizedInput.source ?? (normalizedInput.visionRaw !== undefined ? 'vision' : 'manual');

    try {
      const extraction = source === 'vision'
        ? this.extractVision(normalizedInput, requiredWarmupSize)
        : this.extractManual(normalizedInput, requiredWarmupSize);

      if (extraction.values.length === 0) {
        return this.buildReport({
          source,
          status: 'BLOCKED',
          reason: 'EMPTY_INPUT',
          extraction,
          confidenceScore: 0,
          explanation: [
            'Nenhuma rodada válida foi encontrada no warm-up.',
            'Gate operacional permanece bloqueado.'
          ]
        });
      }

      if (extraction.reliability.status === 'REJECTED') {
        return this.buildReport({
          source,
          status: 'BLOCKED',
          reason: 'OCR_RELIABILITY_REJECTED',
          extraction,
          confidenceScore: extraction.reliability.score,
          explanation: [
            'A confiabilidade da extração ficou abaixo do mínimo institucional.',
            'O sistema bloqueou a operação para proteger a banca.'
          ]
        });
      }

      const analyzer = new WarmupSessionAnalyzer({ warmupSize: requiredWarmupSize });
      const warmup = analyzer.analyze(extraction.values);

      return this.reportFromWarmup(source, extraction, warmup);
    } catch (error: unknown) {
      const fallbackExtraction = this.emptyExtraction(requiredWarmupSize);

      return this.buildReport({
        source,
        status: 'BLOCKED',
        reason: 'INTERNAL_ERROR',
        extraction: fallbackExtraction,
        confidenceScore: 0,
        explanation: [
          `Falha controlada no pipeline de warm-up: ${this.describeError(error)}`,
          'Gate operacional permanece bloqueado por segurança.'
        ]
      });
    }
  }

  private normalizeInput(input: WarmupQualificationRuntimeInput | unknown): WarmupQualificationRuntimeInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    const record = input as Record<string, unknown>;
    const source = this.toSource(record.source);
    const values = Array.isArray(record.values) ? record.values : undefined;
    const requiredWarmupSize = this.toPositiveInteger(record.requiredWarmupSize);

    return {
      source,
      values,
      visionRaw: record.visionRaw ?? record.dataset ?? record.raw,
      requiredWarmupSize
    };
  }

  private extractVision(input: WarmupQualificationRuntimeInput, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const payload = input.visionRaw ?? {
      total: Array.isArray(input.values) ? input.values.length : 0,
      sequencia: input.values ?? []
    };

    const result = this.normalizer.normalize(payload);

    if (!result.success) {
      const extraction = this.emptyExtraction(requiredWarmupSize);

      return {
        ...extraction,
        warnings: [`${result.error.code}:${result.error.message}`]
      };
    }

    return this.fromVisionExtraction(result.value, requiredWarmupSize);
  }

  private extractManual(input: WarmupQualificationRuntimeInput, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const rawValues = input.values ?? [];
    const values: number[] = [];
    let rejected = 0;

    for (const item of rawValues) {
      const value = this.toRouletteValue(item);

      if (value === undefined) {
        rejected += 1;
        continue;
      }

      values.push(value);
    }

    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values,
      rejected,
      declaredTotal: rawValues.length
    });

    return {
      values,
      accepted: values.length,
      rejected,
      declaredTotal: rawValues.length,
      confidence: reliability.score,
      warnings: reliability.issues.map((issue) => issue.code),
      reliability
    };
  }

  private fromVisionExtraction(extraction: VisionWarmupExtraction, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values: extraction.values,
      rejected: extraction.rejected,
      declaredTotal: extraction.declaredTotal
    });

    return {
      values: extraction.values,
      accepted: extraction.accepted,
      rejected: extraction.rejected,
      declaredTotal: extraction.declaredTotal,
      confidence: reliability.score,
      warnings: [
        ...extraction.warnings,
        ...reliability.issues.map((issue) => issue.code)
      ],
      reliability
    };
  }

  private reportFromWarmup(
    source: WarmupQualificationSource,
    extraction: WarmupCanonicalExtraction,
    warmup: WarmupSessionReport
  ): WarmupQualificationReport {
    const status = this.statusFromGate(warmup.tableGate, extraction.reliability.status);
    const reason = this.reasonFromGate(warmup.tableGate);
    const confidenceScore = this.computeConfidenceScore(extraction.reliability.score, warmup.tableGate);

    return this.buildReport({
      source,
      status,
      reason,
      extraction,
      warmup,
      confidenceScore,
      explanation: this.explain(status, extraction, warmup)
    });
  }

  private buildReport(input: {
    readonly source: WarmupQualificationSource;
    readonly status: WarmupQualificationStatus;
    readonly reason: WarmupQualificationReason;
    readonly extraction: WarmupCanonicalExtraction;
    readonly warmup?: WarmupSessionReport;
    readonly confidenceScore: number;
    readonly explanation: readonly string[];
  }): WarmupQualificationReport {
    return {
      service: 'WarmupQualificationRuntimePipeline',
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: input.source,
      status: input.status,
      reason: input.reason,
      operationalGate: 'BLOCKED',
      extraction: input.extraction,
      warmup: input.warmup,
      confidenceScore: Number(input.confidenceScore.toFixed(6)),
      decision: {
        tableQualified: input.status === 'QUALIFIED',
        supervisedObservationAllowed: input.status !== 'BLOCKED',
        supervisedOperationAllowed: input.status === 'QUALIFIED',
        liveMoneyAllowed: false,
        productionMoneyAllowed: false,
        requiresHumanReview: true
      },
      humanExplanation: [
        ...input.explanation,
        'O RL.SYS classifica contexto; ele não promete ganho e não libera dinheiro real.'
      ]
    };
  }

  private statusFromGate(
    tableGate: WarmupTableGate,
    reliabilityStatus: VisionReliabilityReport['status']
  ): WarmupQualificationStatus {
    if (reliabilityStatus === 'REJECTED' || tableGate === 'NO_GO') {
      return 'BLOCKED';
    }

    if (reliabilityStatus === 'REVIEW' || tableGate === 'OBSERVE') {
      return 'OBSERVE';
    }

    return 'QUALIFIED';
  }

  private reasonFromGate(tableGate: WarmupTableGate): WarmupQualificationReason {
    if (tableGate === 'NO_GO') {
      return 'WARMUP_TABLE_NO_GO';
    }

    if (tableGate === 'OBSERVE') {
      return 'WARMUP_TABLE_OBSERVE';
    }

    return 'WARMUP_TABLE_QUALIFIED';
  }

  private explain(
    status: WarmupQualificationStatus,
    extraction: WarmupCanonicalExtraction,
    warmup: WarmupSessionReport
  ): readonly string[] {
    const lines: string[] = [
      `Warm-up processou ${extraction.accepted} rodadas válidas com confiança ${extraction.reliability.score}.`,
      `Gate estatístico da mesa: ${warmup.tableGate}.`,
      `Risco contextual: ${warmup.riskLabel}.`
    ];

    if (status === 'QUALIFIED') {
      lines.push('Mesa qualificada apenas para operação supervisionada em paper.');
    } else if (status === 'OBSERVE') {
      lines.push('Mesa exige observação adicional antes de qualquer oportunidade supervisionada.');
    } else {
      lines.push('Mesa bloqueada por baixa evidência ou risco contextual elevado.');
    }

    return lines;
  }

  private computeConfidenceScore(reliabilityScore: number, tableGate: WarmupTableGate): number {
    const gateFactor = tableGate === 'GO_RESEARCH' ? 1 : tableGate === 'OBSERVE' ? 0.72 : 0.35;
    const score = reliabilityScore * gateFactor;

    if (!Number.isFinite(score) || score < 0) {
      return 0;
    }

    if (score > 1) {
      return 1;
    }

    return score;
  }

  private emptyExtraction(requiredWarmupSize: number): WarmupCanonicalExtraction {
    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values: [],
      rejected: 0,
      declaredTotal: 0
    });

    return {
      values: [],
      accepted: 0,
      rejected: 0,
      declaredTotal: 0,
      confidence: 0,
      warnings: ['EMPTY_EXTRACTION'],
      reliability
    };
  }

  private resolveRequiredWarmupSize(value: number | undefined): number {
    if (value === undefined || !Number.isInteger(value) || value < 80 || value > 500) {
      return 200;
    }

    return value;
  }

  private toSource(value: unknown): WarmupQualificationSource | undefined {
    if (value === 'manual' || value === 'vision') {
      return value;
    }

    return undefined;
  }

  private toRouletteValue(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 36) {
      return undefined;
    }

    return numeric;
  }

  private toPositiveInteger(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isInteger(numeric) || numeric <= 0) {
      return undefined;
    }

    return numeric;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'Unknown warmup qualification failure';
  }
}
EOF

cat > scripts/warmup-qualification-runtime.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  WarmupQualificationRuntimePipeline,
} = require('../dist/application/warmup/WarmupQualificationRuntimePipeline');

function resolveInputPath() {
  return process.env.RLSYS_WARMUP_QUALIFICATION_INPUT_PATH || '';
}

function resolveOutputPath() {
  return process.env.RLSYS_WARMUP_QUALIFICATION_REPORT_PATH ||
    path.join(process.cwd(), 'data', 'paper-runtime', 'warmup-qualification-report.json');
}

function defaultInput() {
  return {
    source: 'manual',
    requiredWarmupSize: 200,
    values: Array.from({ length: 200 }, (_, index) => index % 37),
  };
}

function readInput() {
  const inputPath = resolveInputPath();

  if (!inputPath) {
    return defaultInput();
  }

  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function writeReport(report) {
  const outputPath = resolveOutputPath();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return outputPath;
}

function formatReport(report, outputPath) {
  return [
    'RL.SYS CORE WARMUP QUALIFICATION RUNTIME',
    '============================================================',
    `generatedAt: ${report.generatedAt}`,
    `source: ${report.source}`,
    `status: ${report.status}`,
    `reason: ${report.reason}`,
    `confidenceScore: ${report.confidenceScore}`,
    `operationalGate: ${report.operationalGate}`,
    '',
    'DECISION',
    `tableQualified: ${report.decision.tableQualified}`,
    `supervisedObservationAllowed: ${report.decision.supervisedObservationAllowed}`,
    `supervisedOperationAllowed: ${report.decision.supervisedOperationAllowed}`,
    `liveMoneyAllowed: ${report.decision.liveMoneyAllowed}`,
    `productionMoneyAllowed: ${report.decision.productionMoneyAllowed}`,
    `requiresHumanReview: ${report.decision.requiresHumanReview}`,
    '',
    'EXPLANATION',
    ...report.humanExplanation.map((line) => `- ${line}`),
    '',
    `warmup qualification report: ${outputPath}`,
  ].join('\n');
}

function main() {
  const pipeline = new WarmupQualificationRuntimePipeline();
  const report = pipeline.qualify(readInput());
  const outputPath = writeReport(report);

  console.log(formatReport(report, outputPath));
}

main();
EOF

cat > tests/warmup-qualification-runtime-pipeline.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  WarmupQualificationRuntimePipeline,
} = require('../dist/application/warmup/WarmupQualificationRuntimePipeline');

function balancedWarmup(size) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

test('WarmupQualificationRuntimePipeline qualifies complete manual 200-round warmup without opening money gates', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'manual',
    requiredWarmupSize: 200,
    values: balancedWarmup(200),
  });

  assert.equal(report.service, 'WarmupQualificationRuntimePipeline');
  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.status, 'QUALIFIED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.liveMoneyAllowed, false);
  assert.equal(report.decision.productionMoneyAllowed, false);
  assert.equal(report.decision.requiresHumanReview, true);
  assert.equal(report.extraction.accepted, 200);
  assert.equal(report.warmup.sample.used, 200);
});

test('WarmupQualificationRuntimePipeline blocks incomplete warmup defensively', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'manual',
    requiredWarmupSize: 200,
    values: balancedWarmup(70),
  });

  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.supervisedOperationAllowed, false);
  assert.equal(report.decision.productionMoneyAllowed, false);
});

test('WarmupQualificationRuntimePipeline supports vision raw payload using real normalizer', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'vision',
    requiredWarmupSize: 200,
    visionRaw: JSON.stringify({
      total: 200,
      sequencia: balancedWarmup(200),
    }),
  });

  assert.equal(report.source, 'vision');
  assert.equal(report.extraction.accepted, 200);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.productionMoneyAllowed, false);
});

test('warmup qualification cli writes report and keeps live money blocked', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-warmup-qualification-'));
  const outputPath = path.join(dir, 'warmup-qualification-report.json');

  const result = spawnSync(process.execPath, ['scripts/warmup-qualification-runtime.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_WARMUP_QUALIFICATION_REPORT_PATH: outputPath,
    },
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /RL\.SYS CORE WARMUP QUALIFICATION RUNTIME/);
  assert.match(output, /productionMoneyAllowed: false/);
  assert.equal(fs.existsSync(outputPath), true);

  const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(report.decision.liveMoneyAllowed, false);
});
EOF

echo "== Atualizando package.json =="

node <<'EOF'
const fs = require('node:fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['warmup:qualify'] = 'node scripts/warmup-qualification-runtime.js';

fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
EOF

echo "== Syntax check JS =="

node --check scripts/warmup-qualification-runtime.js

echo "== Instalação limpa =="

npm ci

echo "== Build =="

npm run build

echo "== Smoke test usando JS compilado =="

TMP_DIR="$(mktemp -d)"
TMP_REPORT="$TMP_DIR/warmup-qualification-report.json"

RLSYS_WARMUP_QUALIFICATION_REPORT_PATH="$TMP_REPORT" \
node scripts/warmup-qualification-runtime.js \
| tee /tmp/rlsys-s112-smoke.log

grep "RL.SYS CORE WARMUP QUALIFICATION RUNTIME" /tmp/rlsys-s112-smoke.log
grep "productionMoneyAllowed: false" /tmp/rlsys-s112-smoke.log
test -f "$TMP_REPORT"

echo "== Testes direcionados =="

node --test tests/warmup-qualification-runtime-pipeline.test.js

echo "== Testes globais =="

npm test

git add .
git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH" --force

echo "== Mergeando Sprint 112 na main =="

git checkout main
git reset --hard origin/main

git merge --no-ff "$BRANCH" \
  -m "merge: sprint 112 warmup qualification runtime pipeline"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 112 concluída e mergeada na main =="
