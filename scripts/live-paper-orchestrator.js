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
