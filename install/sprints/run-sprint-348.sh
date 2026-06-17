#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 348"
echo " LIVE PAPER ORCHESTRATOR & GEMINI OCR"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

LOG_DIR="/sdcard/Download/rlsys/logs/sprint-348"
mkdir -p "$LOG_DIR"
mkdir -p scripts

MAIN_LOG="$LOG_DIR/execution.log"
BUILD_LOG="$LOG_DIR/build.log"
TEST_LOG="$LOG_DIR/test.log"
exec > >(tee -a "$MAIN_LOG") 2>&1

echo "[1/4] Atualizando o package.json de forma atômica..."
cp package.json package.json.bak.sprint348

cat > package.json <<'EOF'
{
  "name": "rl-sys-core",
  "version": "2.9.0",
  "description": "RL.sys Core - enterprise-grade institutional roulette research and risk engine",
  "main": "dist/main.js",
  "scripts": {
    "start": "node dist/main.js",
    "build": "tsc",
    "dev": "tsc -w & node --watch dist/main.js",
    "test": "node install/quality/run-all-tests.cjs",
    "check": "npm run build && npm test",
    "audit:deps": "npm audit --omit=dev",
    "release:check": "npm run check && npm run audit:deps",
    "clean": "rm -rf dist",
    "build:clean": "npm run clean && npm run build",
    "start:live": "node dist/main.js",
    "start:headless": "node dist/main.js --headless",
    "start:cybernetic": "python3 satellite/main.py | npm run start:headless",
    "research:update": "node dist/research.js",
    "check:modules": "node install/quality/check-module-compatibility.cjs",
    "soak:runtime": "node scripts/runtime-soak-runner.js",
    "certify:runtime": "node scripts/runtime-certify-baseline.js",
    "paper:runtime": "node scripts/paper-runtime-session.js",
    "paper:daily": "node scripts/paper-runtime-daily-operation-cli.js",
    "paper:trial": "node scripts/paper-runtime-24h-supervision-trial.js",
    "paper:readiness": "node scripts/production-readiness-review.js",
    "warmup:qualify": "node scripts/warmup-qualification-runtime.js",
    "warmup:ingest": "node scripts/warmup-upload-ingestion-cli.js",
    "test:audit": "node install/quality/audit-test-discovery.cjs",
    "deps:audit": "node install/quality/dependency-governance-engine.cjs artifacts/dependency-governance/sprint-247-npm-audit.json",
    "arch:audit": "node install/quality/architecture-governance-engine.cjs",
    "debt:audit": "node install/quality/technical-debt-engine.cjs",
    "cert:audit": "node install/quality/repository-certification-engine.cjs --audit-json artifacts/dependency-governance/sprint-250-npm-audit.json",
    "build:guard": "node install/quality/check-clean-build-artifacts.cjs",
    "warmup:gemini-extract": "node install/runtime/warmup-gemini-extract-latest.cjs",
    "paper": "node scripts/paper-runtime-session.js",
    "paper:live": "node scripts/live-paper-orchestrator.js"
  },
  "keywords": [
    "rl-sys",
    "high-performance",
    "distributed-systems",
    "typescript",
    "express"
  ],
  "author": "RL.sys Core Team",
  "license": "MIT",
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "@types/uuid": "^10.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@types/multer": "^2.1.0",
    "dotenv": "^17.4.2",
    "express": "^4.19.2",
    "multer": "^2.1.1",
    "uuid": "^14.0.0"
  }
}
EOF

echo "[2/4] Criando o Live Paper Orchestrator..."

cat > scripts/live-paper-orchestrator.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');

const { AnalyticsDecisionEngine } = require('../dist/application/runtime/AnalyticsDecisionEngine.js');
const { TriplicacaoAdvancedProbabilityEngine } = require('../dist/domain/analytics/TriplicacaoAdvancedProbabilityEngine.js');
const { FusionHeatmapIntegrationEngine } = require('../dist/application/runtime/FusionHeatmapIntegrationEngine.js');

const repoRoot = process.cwd();
const screenshotDir = path.join(repoRoot, 'data', 'paper-runtime', 'warmup-screenshots');
const importedTxtPath = path.join(screenshotDir, 'warmup-screenshot-imported-rounds.txt');

console.clear();
console.log('======================================================');
console.log(' 🎰 RL.SYS LIVE PAPER ORCHESTRATOR (SPRINT 348)');
console.log('======================================================');

console.log('[1/3] Invocando Inteligência Visual (Gemini OCR)...');
const extractProc = spawnSync('npm', ['run', 'warmup:gemini-extract'], { stdio: 'inherit' });

if (extractProc.status !== 0) {
  console.error('\n[X] Falha na extração OCR. Verifique se existe imagem na pasta warmup-screenshots e se a GEMINI_API_KEY está configurada.');
  process.exit(1);
}

if (!fs.existsSync(importedTxtPath)) {
  console.error('\n[X] Arquivo de warmup extraído não encontrado.');
  process.exit(1);
}

const warmupRounds = fs.readFileSync(importedTxtPath, 'utf8')
  .split(',')
  .map(n => n.trim())
  .filter(n => n.length > 0)
  .map(Number);

console.log(`\n[2/3] Warmup carregado: ${warmupRounds.length} rodadas válidas.`);

const legacyEngine = new AnalyticsDecisionEngine();
const advancedTriplicacaoEngine = new TriplicacaoAdvancedProbabilityEngine();
const fusionHeatmapEngine = new FusionHeatmapIntegrationEngine();

let liveRounds = [];

function renderTerminalHud() {
  const allRounds = [...warmupRounds, ...liveRounds];
  
  // Avaliação Oficial (Legado)
  const legacyResult = legacyEngine.evaluate({
    warmupRounds: warmupRounds.map(String),
    liveRounds: liveRounds.map(String),
    minimumLiveRounds: 6
  });

  // Avaliação Avançada (Novos Motores)
  const advTriplicacao = advancedTriplicacaoEngine.analyze(allRounds);
  const advHeatmap = fusionHeatmapEngine.analyze(allRounds);

  const advPattern = advTriplicacao.selectedPatternKind || 'NONE';
  const metric = (advTriplicacao.metrics || []).find(m => m.patternKind === advPattern);
  const advOccurrences = metric ? metric.occurrences : 0;

  const hotNumbers = advHeatmap.heatmap?.hotNumbers?.map(n => n.number).join(', ') || '-';
  const mode = advHeatmap.mode || 'UNKNOWN';
  const signal = advHeatmap.signalStrength || 'NONE';
  const dispersion = advHeatmap.dispersionScore || 0;

  console.clear();
  console.log('======================================================');
  console.log(' 🎰 RL.SYS LIVE PAPER HUD');
  console.log('======================================================');
  console.log(` WARMUP: ${warmupRounds.length} | LIVE: ${liveRounds.length} | ÚLTIMAS: ${liveRounds.slice(-5).join(', ') || '-'}`);
  console.log('------------------------------------------------------');
  
  console.log(' [ MOTOR LEGADO (Oficial Atual) ]');
  console.log(` STATUS:      ${legacyResult.recommendation}`);
  console.log(` CONFIANÇA:   ${(legacyResult.confidence * 100).toFixed(1)}% | RISCO: ${(legacyResult.risk * 100).toFixed(1)}%`);
  console.log('------------------------------------------------------');

  console.log(' [ MOTORES AVANÇADOS (Nova Geração) ]');
  console.log(` TRIPLICAÇÃO: ${advPattern} (Ocorrências: ${advOccurrences})`);
  console.log(` FUSION MODO: ${mode} (Sinal: ${signal})`);
  console.log(` QUENTES:     ${hotNumbers} (Dispersão: ${dispersion.toFixed(1)})`);
  
  let advStatus = 'AGUARDAR (Mín. 6 rodadas Live)';
  if (liveRounds.length >= 6) {
    if (mode === 'FUSION_READY' && advPattern !== 'NONE') {
       advStatus = '🚀 PAPER SINAL FORTE - ENTRAR';
    } else {
       advStatus = '⏳ PAPER_OBSERVAR';
    }
  }
  
  console.log(`\n CONCENSO AVANÇADO: ${advStatus}`);
  console.log('======================================================');
}

renderTerminalHud();

console.log('\n[3/3] Ambiente Paper Real ativo.');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'rodada (0-36) > '
});

rl.prompt();

rl.on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'exit' || cmd === 'quit') {
    console.log('Encerrando sessão Live Paper...');
    rl.close();
    return;
  }

  const num = parseInt(cmd, 10);
  if (!isNaN(num) && num >= 0 && num <= 36) {
    liveRounds.push(num);
    renderTerminalHud();
  } else {
    console.log('Entrada inválida. Digite um número de 0 a 36 ou "exit".');
  }
  rl.prompt();
});
EOF

echo "[3/4] Executando Build de Segurança..."
if ! npm run build > "$BUILD_LOG" 2>&1; then
  echo -e "\033[1;31m[ERROR] Falha de compilação detectada. Restaurando package.json...\033[0m"
  mv package.json.bak.sprint348 package.json
  exit 1
fi

echo "[4/4] Executando Validação Sandbox Institucional (CI/CD)..."
if ! npm test > "$TEST_LOG" 2>&1; then
  echo -e "\033[1;31m[ERROR] Falha na malha de testes. O Orquestrador quebrou as dependências!\033[0m"
  tail -n 30 "$TEST_LOG"
  mv package.json.bak.sprint348 package.json
  exit 1
fi

git add package.json scripts/live-paper-orchestrator.js
git commit -m "feat(paper): implement live paper orchestrator with Gemini OCR integration (Sprint 348)

- create side-by-side terminal HUD comparing legacy and advanced consensus
- preserve 100% test isolation by omitting domain file mutations
- automate Gemini python OCR wrapper invocation within the REPL lifecycle
- pass sandbox test grid without introducing new technical debt" > /dev/null

rm -f package.json.bak.sprint348
echo "======================================"
echo -e "\033[1;32m SPRINT 348 FINALIZADA COM SUCESSO \033[0m"
echo " STATUS: O VOO INAUGURAL ESTÁ PRONTO!"
echo " COMANDO: npm run paper:live"
echo "======================================"

