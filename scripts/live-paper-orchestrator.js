'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const { AnalyticsDecisionEngine } = require('../dist/application/runtime/AnalyticsDecisionEngine.js');
const { TriplicacaoAdvancedProbabilityEngine } = require('../dist/domain/analytics/TriplicacaoAdvancedProbabilityEngine.js');
const { FusionHeatmapIntegrationEngine } = require('../dist/application/runtime/FusionHeatmapIntegrationEngine.js');
const { InstitutionalContextScoreEngine } = require('../src/application/runtime/InstitutionalContextScoreEngine.js');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot.js');

const repoRoot = process.cwd();
const screenshotDir = path.join(repoRoot, 'data', 'paper-runtime', 'warmup-screenshots');
const importedTxtPath = path.join(screenshotDir, 'warmup-screenshot-imported-rounds.txt');

console.clear();
console.log('======================================================');
console.log(' 🛡️ RL.SYS COPILOTO INSTITUCIONAL (SPRINT 350)');
console.log('======================================================');

let warmupRounds = [];

if (fs.existsSync(importedTxtPath)) {
  warmupRounds = fs.readFileSync(importedTxtPath, 'utf8')
    .split(',').map(n => n.trim()).filter(n => n.length > 0).map(Number);
  console.log(`[+] Warmup carregado da base: ${warmupRounds.length} rodadas.`);
} else {
  console.log('[!] Nenhum Warmup detectado. Extraindo...');
  spawnSync('npm', ['run', 'warmup:gemini-extract'], { stdio: 'inherit' });
  if (fs.existsSync(importedTxtPath)) {
    warmupRounds = fs.readFileSync(importedTxtPath, 'utf8')
      .split(',').map(n => n.trim()).filter(n => n.length > 0).map(Number);
  }
}

const advancedTriplicacaoEngine = new TriplicacaoAdvancedProbabilityEngine();
const fusionHeatmapEngine = new FusionHeatmapIntegrationEngine();
const contextEngine = new InstitutionalContextScoreEngine();
const voiceCopilot = new TermuxTtsVoiceCopilot();

let liveRounds = [];
let sessionStartTime = Date.now();
let lastContextStatus = '';

function calculateSimulatedScores(allRounds) {
  const advTriplicacao = advancedTriplicacaoEngine.analyze(allRounds);
  const advHeatmap = fusionHeatmapEngine.analyze(allRounds);
  
  let tableScore = 50; 
  if (advHeatmap.mode === 'FUSION_READY' && advTriplicacao.selectedPatternKind !== 'NONE') tableScore = 85;
  else if (advHeatmap.mode === 'BLOCKED') tableScore = 30;

  const dataScore = allRounds.length >= 100 ? 95 : 40;
  const sessionMinutes = (Date.now() - sessionStartTime) / 60000;
  let disciplineScore = 100 - (liveRounds.length * 1.5) - (sessionMinutes * 0.5);
  disciplineScore = Math.max(10, Math.min(100, disciplineScore)); 
  const riskScore = 90; 

  return { tableScore, riskScore, disciplineScore, dataScore, advPattern: advTriplicacao.selectedPatternKind };
}

function renderTerminalHudAndSpeak() {
  const allRounds = [...warmupRounds, ...liveRounds];
  const scores = calculateSimulatedScores(allRounds);
  const context = contextEngine.evaluate(scores);

  // Lógica de Geração de Síntese de Voz (Voice Copilot)
  // Avisa sempre no primeiro carregamento ou quando o status da mesa/consenso mudar.
  let shouldSpeak = false;
  let speechMessage = '';

  if (context.status !== lastContextStatus) {
    shouldSpeak = true;
    lastContextStatus = context.status;
    
    // Traduz o status do sistema para uma frase humana natural
    const statusLimpo = context.status.toLowerCase().replace('contexto ', '');
    speechMessage = `Contexto ${statusLimpo}. `;
    
    if (context.vetoReason) {
      speechMessage += `Atenção. Operação bloqueada por: ${context.vetoReason}.`;
    } else {
      if (statusLimpo === 'favorável') {
        speechMessage += 'Mesa alinhada. Sugestão de entrada detectada.';
      } else {
        speechMessage += 'Aguardando melhoria das condições da mesa.';
      }
    }
    
    voiceCopilot.speak(speechMessage);
  }

  console.clear();
  console.log('======================================================');
  console.log(' 🎙️ RL.SYS CORE - VOICE COPILOT ACTIVE');
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

// Renderiza a primeira vez ao iniciar
renderTerminalHudAndSpeak();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'rodada (0-36) > '
});

rl.prompt();

rl.on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'exit' || cmd === 'quit') {
    voiceCopilot.speak('Sessão encerrada. Proteção de capital ativada.');
    console.log('Sessão encerrada. Proteção de capital ativada.');
    rl.close();
    return;
  }

  const num = parseInt(cmd, 10);
  if (!isNaN(num) && num >= 0 && num <= 36) {
    liveRounds.push(num);
    renderTerminalHudAndSpeak();
  } else {
    console.log('Entrada inválida. Digite um número ou "exit".');
  }
  rl.prompt();
});
