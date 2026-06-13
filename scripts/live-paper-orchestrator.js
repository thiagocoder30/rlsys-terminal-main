'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const { AnalyticsDecisionEngine } = require('../dist/application/runtime/AnalyticsDecisionEngine.js');
const { TriplicacaoAdvancedProbabilityEngine } = require('../dist/domain/analytics/TriplicacaoAdvancedProbabilityEngine.js');
const { FusionHeatmapIntegrationEngine } = require('../dist/application/runtime/FusionHeatmapIntegrationEngine.js');
const { InstitutionalContextScoreEngine } = require('../src/application/runtime/InstitutionalContextScoreEngine.js');

const repoRoot = process.cwd();
const screenshotDir = path.join(repoRoot, 'data', 'paper-runtime', 'warmup-screenshots');
const importedTxtPath = path.join(screenshotDir, 'warmup-screenshot-imported-rounds.txt');

console.clear();
console.log('======================================================');
console.log(' 🛡️ RL.SYS COPILOTO INSTITUCIONAL (SPRINT 349)');
console.log('======================================================');

let warmupRounds = [];

if (fs.existsSync(importedTxtPath)) {
  warmupRounds = fs.readFileSync(importedTxtPath, 'utf8')
    .split(',')
    .map(n => n.trim())
    .filter(n => n.length > 0)
    .map(Number);
  console.log(`[+] Warmup carregado da base: ${warmupRounds.length} rodadas.`);
} else {
  console.log('[!] Nenhum Warmup detectado. Executando extrator Gemini...');
  spawnSync('npm', ['run', 'warmup:gemini-extract'], { stdio: 'inherit' });
  if (fs.existsSync(importedTxtPath)) {
    warmupRounds = fs.readFileSync(importedTxtPath, 'utf8')
      .split(',').map(n => n.trim()).filter(n => n.length > 0).map(Number);
  }
}

const advancedTriplicacaoEngine = new TriplicacaoAdvancedProbabilityEngine();
const fusionHeatmapEngine = new FusionHeatmapIntegrationEngine();
const contextEngine = new InstitutionalContextScoreEngine();

let liveRounds = [];
let sessionStartTime = Date.now();

function calculateSimulatedScores(allRounds) {
  // 1. MESA (Table Score)
  const advTriplicacao = advancedTriplicacaoEngine.analyze(allRounds);
  const advHeatmap = fusionHeatmapEngine.analyze(allRounds);
  
  let tableScore = 50; // Neutro padrão
  if (advHeatmap.mode === 'FUSION_READY' && advTriplicacao.selectedPatternKind !== 'NONE') tableScore = 85;
  else if (advHeatmap.mode === 'BLOCKED') tableScore = 30;

  // 2. DADOS (Data Score)
  const dataScore = allRounds.length >= 100 ? 95 : 40;

  // 3. DISCIPLINA (Fadiga Operacional)
  const sessionMinutes = (Date.now() - sessionStartTime) / 60000;
  let disciplineScore = 100 - (liveRounds.length * 1.5) - (sessionMinutes * 0.5);
  disciplineScore = Math.max(10, Math.min(100, disciplineScore)); // Clamp

  // 4. RISCO (Mockup inicial, futuramente conectado ao Bankroll Guard)
  const riskScore = 90; // Drawdown Seguro provisório

  return { tableScore, riskScore, disciplineScore, dataScore, advPattern: advTriplicacao.selectedPatternKind };
}

function renderTerminalHud() {
  const allRounds = [...warmupRounds, ...liveRounds];
  const scores = calculateSimulatedScores(allRounds);
  const context = contextEngine.evaluate(scores);

  console.clear();
  console.log('======================================================');
  console.log(' 🛡️ RL.SYS CORE - COPILOTO INSTITUCIONAL');
  console.log('======================================================');
  console.log(` MESA ............. ${Math.round(scores.tableScore)}/100  [${context.pillars.table}]`);
  console.log(` RISCO ............ ${Math.round(scores.riskScore)}/100  [${context.pillars.risk}]`);
  console.log(` DISCIPLINA ....... ${Math.round(scores.disciplineScore)}/100  [${context.pillars.discipline}]`);
  console.log(` DADOS ............ ${Math.round(scores.dataScore)}/100  [${context.pillars.data}]`);
  console.log('');
  console.log(` CONTEXTO GERAL ... ${context.score}/100`);
  console.log('');
  
  const statusColor = context.status === 'CONTEXTO FAVORÁVEL' ? '\x1b[32m' : (context.status === 'CONTEXTO DESFAVORÁVEL' ? '\x1b[31m' : '\x1b[33m');
  console.log(` STATUS: ${statusColor}${context.status}\x1b[0m`);
  
  if (context.vetoReason) {
    console.log(` 🛑 VETO ATIVO: ${context.vetoReason}`);
  }

  console.log('======================================================');
  console.log(` INFO DE MESA: Triplicação [${scores.advPattern || 'N/A'}] | Total Rodadas: ${allRounds.length}`);
  console.log('------------------------------------------------------');
}

renderTerminalHud();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'rodada (0-36) > '
});

rl.prompt();

rl.on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'exit' || cmd === 'quit') {
    console.log('Sessão encerrada. Proteção de capital ativada.');
    rl.close();
    return;
  }

  const num = parseInt(cmd, 10);
  if (!isNaN(num) && num >= 0 && num <= 36) {
    liveRounds.push(num);
    renderTerminalHud();
  } else {
    console.log('Entrada inválida. Digite um número ou "exit".');
  }
  rl.prompt();
});
