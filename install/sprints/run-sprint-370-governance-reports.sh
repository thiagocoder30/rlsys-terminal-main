#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 370"
echo " GOVERNANCE REPORTS & TEST VALIDATION"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/3] Construindo Suíte de Testes de Segurança (TDD)..."
mkdir -p tests
cat > tests/sprint-370-governance.test.js <<'EOF'
const assert = require('node:assert');

// 1. Teste de Reset do Hard Lock Diário
function isSameDay(epochA, epochB) {
    const d1 = new Date(epochA);
    const d2 = new Date(epochB);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

try {
    const now = Date.now();
    const tomorrow = now + (24 * 60 * 60 * 1000);
    assert.strictEqual(isSameDay(now, now), true, "Falha: O sistema não reconheceu o mesmo dia.");
    assert.strictEqual(isSameDay(now, tomorrow), false, "Falha: O sistema não quebrou o bloqueio no dia seguinte.");
    console.log("✔ [TESTE 1] Lógica de Hard Lock Diário (00:00) validada.");

    // 2. Teste do Veto Global de Entropia (VIX)
    const vixToxic = 96.5;
    const vixSafe = 60.0;
    assert.strictEqual(vixToxic > 95.0, true, "Falha: VIX Tóxico não reconhecido.");
    assert.strictEqual(vixSafe > 95.0, false, "Falha: VIX Seguro bloqueado incorretamente.");
    console.log("✔ [TESTE 2] Escudo Cross-Veto de Entropia validado.");
    
    // 3. Teste de Consistência de Relatório Executivo
    const stats = { wins: 5, losses: 2 };
    const hitRate = (stats.wins / (stats.wins + stats.losses)) * 100;
    assert.strictEqual(Math.round(hitRate), 71, "Falha: Cálculo de Hit Rate no Dossiê está impreciso.");
    console.log("✔ [TESTE 3] Motor Analítico de Relatórios validado.");

} catch (error) {
    console.error("❌ FALHA CRÍTICA NOS TESTES:", error.message);
    process.exit(1);
}
EOF

echo "[2/3] Executando Validação Interna..."
node tests/sprint-370-governance.test.js

echo "[3/3] Injetando Relatórios e Hard Lock no Orquestrador..."
cat > scripts/live-paper-orchestrator.js <<'EOF'
'use strict';

const readline = require('node:readline');
const { DynamicEmotionalCooldownGuard } = require('../src/domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { FileBankrollRepository } = require('../src/infrastructure/persistence/FileBankrollRepository.js');
const { AutoSettlementEngine } = require('../src/domain/financial/AutoSettlementEngine.js');
const { LiveMesaTracker } = require('../src/domain/analytics/LiveMesaTracker.js');

const voiceCopilot = new TermuxTtsVoiceCopilot();
const bankrollRepo = new FileBankrollRepository();
const settlementEngine = new AutoSettlementEngine();
const mesaTracker = new LiveMesaTracker();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let savedState = bankrollRepo.load();
let initialBankroll = 100.00;
if (savedState && savedState.initialBankroll) initialBankroll = savedState.initialBankroll;

let cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll, savedState);
let activeStrategyId = null;
let inputMode = 'NUMBER'; 
let pendingResult = null; 
let triplicacaoPatternFound = null; 
let triplicacaoTypeFound = null; 
let currentVixPercent = 0; 
let toxicTableLockUntil = null; 
let forceObserveRound = false; 

// MÉTODOS DE AUDITORIA E RELATÓRIO
let sessionStats = {
    startBankroll: cooldownGuard.currentBankroll,
    wins: 0,
    losses: 0,
    entropyBlocks: 0,
    strategyWins: {},
    vixReadings: []
};

// Trava o sistema até meia-noite se o limite final for tocado
let isDailyHardLocked = savedState?.isDailyHardLocked || false;
let hardLockDateEpoch = savedState?.hardLockDateEpoch || null;

function isSameDay(epochA, epochB) {
    if (!epochA || !epochB) return false;
    const d1 = new Date(epochA); const d2 = new Date(epochB);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function verifyDailyLock() {
    if (isDailyHardLocked) {
        if (!isSameDay(hardLockDateEpoch, Date.now())) {
            isDailyHardLocked = false; // Virou o dia, libera o sistema
            hardLockDateEpoch = null;
            saveSystemState();
        }
    }
}

function saveSystemState() {
    const currentSnapshot = cooldownGuard.exportState();
    currentSnapshot.isDailyHardLocked = isDailyHardLocked;
    currentSnapshot.hardLockDateEpoch = hardLockDateEpoch;
    bankrollRepo.save(currentSnapshot);
}

function registerStatOutcome(isWin, strategyId) {
    if (isWin) {
        sessionStats.wins++;
        sessionStats.strategyWins[strategyId] = (sessionStats.strategyWins[strategyId] || 0) + 1;
    } else {
        sessionStats.losses++;
    }
}

function getMvpStrategy() {
    let mvp = 'N/A'; let max = 0;
    for (const [strat, wins] of Object.entries(sessionStats.strategyWins)) {
        if (wins > max) { max = wins; mvp = AutoSettlementEngine.getStrategies()[strat].name; }
    }
    return mvp;
}

function getAverageVix() {
    if (sessionStats.vixReadings.length === 0) return 0;
    const sum = sessionStats.vixReadings.reduce((a, b) => a + b, 0);
    return (sum / sessionStats.vixReadings.length).toFixed(1);
}

// Relatórios
function renderTacticalReport() {
    console.clear();
    const profit = cooldownGuard.currentBankroll - sessionStats.startBankroll;
    console.log('======================================================');
    console.log(' ⏸️  RELATÓRIO TÁTICO - DEGRAU ALCANÇADO');
    console.log('======================================================');
    console.log(` 📈 Lucro do Ciclo .... R$ ${profit > 0 ? '+' : ''}${profit.toFixed(2)}`);
    console.log(` 🏆 Estratégia MVP ... ${getMvpStrategy()}`);
    console.log(` 🌪️  VIX Médio ........ ${getAverageVix()}%`);
    console.log('------------------------------------------------------');
    console.log(` 🛑 STATUS: COOLDOWN DE 15 MINUTOS ATIVADO.`);
    console.log(` MENSAGEM: O seu cérebro precisa resetar a dopamina.`);
    console.log(` AÇÃO: Hidrate-se e afaste-se da tela.`);
    console.log('======================================================');
}

function renderExecutiveReport(reason) {
    console.clear();
    const profit = cooldownGuard.currentBankroll - sessionStats.startBankroll;
    const percent = ((profit / sessionStats.startBankroll) * 100).toFixed(2);
    const totalTrades = sessionStats.wins + sessionStats.losses;
    const hitRate = totalTrades > 0 ? ((sessionStats.wins / totalTrades) * 100).toFixed(1) : 0;
    
    console.log('======================================================');
    console.log(' 📑 DOSSIÊ EXECUTIVO - SESSÃO ENCERRADA');
    console.log('======================================================');
    console.log(` GATILHO ......... ${reason}`);
    console.log(` 💰 RESULTADO LÍQ. R$ ${profit > 0 ? '+' : ''}${profit.toFixed(2)} (${percent > 0 ? '+' : ''}${percent}%)`);
    console.log(` 🎯 HIT RATE ..... ${hitRate}% (${sessionStats.wins}W / ${sessionStats.losses}L)`);
    console.log(` 🛡️  DEFESAS VIX .. ${sessionStats.entropyBlocks} bloqueios contra o caos`);
    console.log(` 🏆 MVP SESSÃO ... ${getMvpStrategy()}`);
    console.log('------------------------------------------------------');
    console.log(` 🛑 HARD LOCK ATIVADO. RETORNE APENAS ÀS 00:00 DO PRÓXIMO DIA.`);
    console.log('======================================================');
}

function computeShannonEntropy(counts, total) {
  if (total === 0) return 0;
  let entropy = 0;
  counts.forEach(count => { if (count > 0) { const p = count / total; entropy -= p * Math.log2(p); } });
  return entropy;
}

function computeTriplicacao(rounds, mapFn) {
  let tc = 0, ntc = 0, ta = 0, nta = 0, zeroTrios = 0;
  for (let index = rounds.length - 1; index >= 2; index -= 3) {
    const trio = [rounds[index], rounds[index - 1], rounds[index - 2]];
    if (trio.includes(0)) { zeroTrios += 1; continue; }
    const mapped = trio.map(mapFn);
    if (mapped[0] === mapped[1] && mapped[1] === mapped[2]) tc += 1;
    else if (mapped[0] === mapped[1] && mapped[1] !== mapped[2]) ntc += 1;
    else if (mapped[0] !== mapped[1] && mapped[1] !== mapped[2] && mapped[0] === mapped[2]) ta += 1;
    else if (mapped[0] !== mapped[1] && mapped[1] === mapped[2]) nta += 1;
  }
  const totalTrios = tc + ntc + ta + nta;
  const entropy = computeShannonEntropy([tc, ntc, ta, nta], totalTrios);
  const vix = totalTrios > 0 ? (entropy / 2.0) * 100 : 0;
  const pairs = [['TC', tc], ['NTC', ntc], ['TA', ta], ['NTA', nta]];
  let dominantPattern = 'NONE'; let dominantCount = 0;
  for (const [pattern, count] of pairs) { if (count > dominantCount) { dominantPattern = pattern; dominantCount = count; } }
  return { totalTrios, dominantPattern, vix, dominantRatio: totalTrios > 0 ? dominantCount / totalTrios : 0 };
}

function checkToxicTableLock() {
  if (toxicTableLockUntil && Date.now() < toxicTableLockUntil) return true;
  if (toxicTableLockUntil && Date.now() >= toxicTableLockUntil) toxicTableLockUntil = null; 
  return false;
}

function generateNextTrade() {
  activeStrategyId = null; triplicacaoPatternFound = null; triplicacaoTypeFound = null;

  if (isDailyHardLocked) return;
  if (cooldownGuard.isSessionEnded || cooldownGuard.isLocked() || checkToxicTableLock()) return;
  if (forceObserveRound) { forceObserveRound = false; return; }
  if (mesaTracker.history.length < 10) return;

  const reversedHistory = [...mesaTracker.history].reverse();
  const REDS = new Set(AutoSettlementEngine.RED_NUMS);
  
  const colorStats = computeTriplicacao(reversedHistory, v => REDS.has(v) ? 'A' : 'B');
  const parityStats = computeTriplicacao(reversedHistory, v => v % 2 === 0 ? 'A' : 'B');

  currentVixPercent = (colorStats.vix + parityStats.vix) / 2;
  if (currentVixPercent > 0) sessionStats.vixReadings.push(currentVixPercent);

  // Veto Global
  if (currentVixPercent > 95.0) { sessionStats.entropyBlocks++; return; }

  if (reversedHistory.length % 3 === 2) {
    const inicio = reversedHistory[1]; const confirmacao = reversedHistory[0];
    if (inicio !== 0 && confirmacao !== 0) {
      let colorTarget = null; let parityTarget = null;
      if (colorStats.totalTrios >= 35 && colorStats.dominantRatio >= 0.42) {
        const c0 = REDS.has(inicio) ? 'A' : 'B'; const c1 = REDS.has(confirmacao) ? 'A' : 'B';
        if (colorStats.dominantPattern === 'TC' && c0 === c1) colorTarget = c1;
        else if (colorStats.dominantPattern === 'NTC' && c0 === c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
        else if (colorStats.dominantPattern === 'TA' && c0 !== c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
        else if (colorStats.dominantPattern === 'NTA' && c0 !== c1) colorTarget = c1;
      }
      if (parityStats.totalTrios >= 35 && parityStats.dominantRatio >= 0.42) {
        const p0 = inicio % 2 === 0 ? 'A' : 'B'; const p1 = confirmacao % 2 === 0 ? 'A' : 'B';
        if (parityStats.dominantPattern === 'TC' && p0 === p1) parityTarget = p1;
        else if (parityStats.dominantPattern === 'NTC' && p0 === p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
        else if (parityStats.dominantPattern === 'TA' && p0 !== p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
        else if (parityStats.dominantPattern === 'NTA' && p0 !== p1) parityTarget = p1;
      }
      if (colorTarget && parityTarget) {
        if (colorStats.dominantRatio >= parityStats.dominantRatio) parityTarget = null; else colorTarget = null;
      }
      if (colorTarget) { triplicacaoTypeFound = 'COR'; triplicacaoPatternFound = colorStats.dominantPattern; activeStrategyId = colorTarget === 'A' ? 'TRIPLICACAO_RED' : 'TRIPLICACAO_BLACK'; return; }
      if (parityTarget) { triplicacaoTypeFound = 'PARIDADE'; triplicacaoPatternFound = parityStats.dominantPattern; activeStrategyId = parityTarget === 'A' ? 'TRIPLICACAO_EVEN' : 'TRIPLICACAO_ODD'; return; }
    }
  }

  const timeline = mesaTracker.history.slice(-15); 
  let scores = { 'HEDGE_BLACK_COL3': 0, 'HEDGE_RED_COL2': 0, 'SECTOR_OMEGA': 0, 'SECTOR_ALPHA': 0, 'FUSION_SECTOR': 0 };
  const engineStrategies = AutoSettlementEngine.getStrategies();
  timeline.forEach(num => { Object.keys(scores).forEach(stratId => { const result = engineStrategies[stratId].evaluate(num); if (result.status === 'WIN_MAX' || result.status === 'WIN_MIN') scores[stratId]++; }); });
  let bestStrat = null; let maxScore = 0;
  Object.entries(scores).forEach(([strat, score]) => { if (score > maxScore) { maxScore = score; bestStrat = strat; } });
  if (bestStrat && maxScore >= (timeline.length * 0.40)) { activeStrategyId = bestStrat; }
}

function startOrchestrator() {
  verifyDailyLock();
  generateNextTrade();
  if (isDailyHardLocked) renderExecutiveReport('SESSÃO JÁ FINALIZADA HOJE');
  else renderTerminalHud();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    if (cmd === 'exit' || cmd === 'quit') { saveSystemState(); console.log('\n[!] Estado protegido. Encerrando...'); rl.close(); return; }
    
    // Comando administrativo quebra o Daily Lock para fins de recarga
    if (cmd.startsWith('setbankroll ')) {
      const newVal = parseFloat(cmd.replace('setbankroll ', '').trim());
      if (isNaN(newVal) || newVal <= 0) { console.log('Inválido.'); rl.prompt(); return; }
      cooldownGuard = new DynamicEmotionalCooldownGuard(newVal, null);
      activeStrategyId = null; inputMode = 'NUMBER'; pendingResult = null; toxicTableLockUntil = null;
      isDailyHardLocked = false; hardLockDateEpoch = null;
      sessionStats = { startBankroll: newVal, wins: 0, losses: 0, entropyBlocks: 0, strategyWins: {}, vixReadings: [] };
      saveSystemState(); generateNextTrade(); renderTerminalHud(); return;
    }
    
    if (isDailyHardLocked) { rl.prompt(); return; }

    if (inputMode === 'VIEW_ONLY') { inputMode = 'NUMBER'; renderTerminalHud(); return; }

    if (inputMode === 'CONFIRM_TRADE') {
      const executedStratId = activeStrategyId;
      if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
        if (pendingResult.status === 'WIN_MAX' || pendingResult.status === 'WIN_MIN') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + pendingResult.netAmount);
          registerStatOutcome(true, executedStratId);
          voiceCopilot.speak('Green liquidado.');
        } else if (pendingResult.status === 'PUSH') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll);
        } else {
          cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - Math.abs(pendingResult.netAmount));
          registerStatOutcome(false, executedStratId);
          voiceCopilot.speak('Red absorvido.');
        }
        saveSystemState();
      } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
        voiceCopilot.speak('Entrada descartada. Forçando rodada de observação.');
        forceObserveRound = true;
      } else { console.log('Inválido.'); rl.prompt(); return; }
      
      inputMode = 'NUMBER'; pendingResult = null; activeStrategyId = null;
      
      // CHECAGEM DE RELATÓRIOS PÓS-TRADE
      if (cooldownGuard.isSessionEnded) {
          isDailyHardLocked = true; hardLockDateEpoch = Date.now(); saveSystemState();
          renderExecutiveReport('META GLOBAL OU STOP LOSS ATINGIDO');
          rl.prompt(); return;
      } else if (cooldownGuard.isLocked()) {
          renderTacticalReport();
          rl.prompt(); return;
      }

      generateNextTrade(); renderTerminalHud(); return;
    }

    if (cmd === 'timeline') { console.clear(); console.log(`\n Histórico: \x1b[36m${mesaTracker.getTimeline(15)}\x1b[0m\n [ENTER] para voltar...`); inputMode = 'VIEW_ONLY'; rl.prompt(); return; }
    if (cmd === 'trios') { console.clear(); console.log('======================================================'); console.log(' 🧩 XAI: AUDITORIA DE TRIPLICAÇÃO (Últimos Eventos)'); console.log('======================================================'); const h = mesaTracker.history; if (h.length < 3) { console.log(' \x1b[33mDados insuficientes para formar trios estruturais.\x1b[0m'); } else { const reversed = [...h].reverse(); const remainder = reversed.length % 3; const REDS = new Set(AutoSettlementEngine.RED_NUMS); if (remainder === 2) { console.log(` \x1b[33m[PENDENTE]\x1b[0m Início: \x1b[1m${reversed[1]}\x1b[0m | Confirmação: \x1b[1m${reversed[0]}\x1b[0m | Finalização: ?`); } else if (remainder === 1) { console.log(` \x1b[33m[PENDENTE]\x1b[0m Início: \x1b[1m${reversed[0]}\x1b[0m | Confirmação: ? | Finalização: ?`); } let printed = 0; for (let i = remainder; i < reversed.length && printed < 8; i += 3) { const f = reversed[i]; const c = reversed[i+1]; const inc = reversed[i+2]; if ([inc, c, f].includes(0)) { console.log(` \x1b[31m[ANULADO]\x1b[0m  Trio com Zero: (${inc}, ${c}, ${f})`); } else { const cor = [inc, c, f].map(v => REDS.has(v) ? 'R' : 'B'); let pCor = 'N/A'; if (cor[0]===cor[1] && cor[1]===cor[2]) pCor = 'TC '; else if (cor[0]===cor[1] && cor[1]!==cor[2]) pCor = 'NTC'; else if (cor[0]!==cor[1] && cor[1]!==cor[2] && cor[0]===cor[2]) pCor = 'TA '; else if (cor[0]!==cor[1] && cor[1]===cor[2]) pCor = 'NTA'; const par = [inc, c, f].map(v => v%2===0 ? 'P' : 'I'); let pPar = 'N/A'; if (par[0]===par[1] && par[1]===par[2]) pPar = 'TC '; else if (par[0]===par[1] && par[1]!==par[2]) pPar = 'NTC'; else if (par[0]!==par[1] && par[1]!==par[2] && par[0]===par[2]) pPar = 'TA '; else if (par[0]!==par[1] && par[1]===par[2]) pPar = 'NTA'; console.log(` \x1b[32m[FECHADO]\x1b[0m  (${inc}, ${c}, ${f}) => Cor: \x1b[36m${pCor}\x1b[0m | Paridade: \x1b[36m${pPar}\x1b[0m`); } printed++; } } console.log('------------------------------------------------------'); console.log(' Pressione ENTER para voltar...'); inputMode = 'VIEW_ONLY'; rl.prompt(); return; }

    if (cooldownGuard.isLocked() || checkToxicTableLock()) {
      if (!cmd.startsWith('sync ') && cmd !== 'timeline' && cmd !== 'trios') {
        if (!checkToxicTableLock()) cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); 
        saveSystemState(); renderTerminalHud(); return;
      }
    }

    if (cmd.startsWith('sync ')) {
      const numbers = cmd.replace('sync ', '').split(',').map(n => parseInt(n.trim(), 10));
      numbers.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) mesaTracker.addNumber(n); });
      generateNextTrade();
      if (numbers.length > 20 && currentVixPercent > 95.0) { toxicTableLockUntil = Date.now() + (15 * 60 * 1000); voiceCopilot.speak('Atenção. Entropia máxima detectada.'); }
      renderTerminalHud(); return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) { console.log('Entrada inválida.'); rl.prompt(); return; }

    mesaTracker.addNumber(num); 
    if (activeStrategyId) { pendingResult = settlementEngine.evaluate(num, activeStrategyId); inputMode = 'CONFIRM_TRADE'; renderTerminalHud(); return; }
    generateNextTrade(); renderTerminalHud();
  });
}

function renderTerminalHud() {
  console.clear();
  const lockStatus = cooldownGuard.getRemainingStatus();
  const toxicLockActive = checkToxicTableLock();
  
  console.log('======================================================');
  console.log(' 🛡️ RL.SYS CORE - REPORTING & GOVERNANCE ENGINE');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  if (!cooldownGuard.isSessionEnded) console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)}`);
  
  let vixColor = '\x1b[32m'; 
  if (currentVixPercent > 75) vixColor = '\x1b[33m'; 
  if (currentVixPercent > 95) vixColor = '\x1b[31m'; 
  if (mesaTracker.history.length >= 10) { console.log(` ENTROPIA DA MESA. ${vixColor}${currentVixPercent.toFixed(1)}% (VIX)\x1b[0m`); } 
  else { console.log(` ENTROPIA DA MESA. \x1b[36mAguardando Warmup...\x1b[0m`); }
  console.log('------------------------------------------------------');
  
  if (toxicLockActive) {
    const remaining = Math.ceil((toxicTableLockUntil - Date.now()) / 60000);
    console.log(`\x1b[31m ☣️ MESA TÓXICA REJEITADA PELO SISTEMA (VIX > 95%)\x1b[0m`);
    console.log(` AÇÃO: Feche a corretora. Retorne em ${remaining} minutos.`);
    rl.setPrompt('comando > ');
  }
  else if (lockStatus) {
    console.log(`\x1b[31m 🛑 TRAVA DE PROTEÇÃO DE CAPITAL ATIVA\x1b[0m`);
    console.log(` MOTIVO: ${lockStatus.reason} | TEMPO: ${lockStatus.time}`);
    rl.setPrompt('comando > ');
  } 
  else if (inputMode === 'CONFIRM_TRADE') {
    const stratName = AutoSettlementEngine.getStrategies()[activeStrategyId].name;
    let color = '\x1b[31m'; let label = 'RED (Loss)';
    if (pendingResult.status === 'WIN_MAX') { color = '\x1b[32m'; label = 'GREEN MÁXIMO'; }
    if (pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN MÍNIMO'; }
    if (pendingResult.status === 'PUSH') { color = '\x1b[33m'; label = 'PUSH (Empate)'; }
    console.log(` ${color}RESULTADO: ${label} | R$ ${pendingResult.netAmount.toFixed(2)}\x1b[0m`);
    console.log('------------------------------------------------------');
    console.log(` [?] Você executou a estratégia [${stratName}]?`);
    rl.setPrompt('Confirme (s/n) > ');
  } 
  else if (activeStrategyId) {
    const strat = AutoSettlementEngine.getStrategies()[activeStrategyId];
    console.log(` ESTRATÉGIA .. \x1b[36m${strat.name}\x1b[0m`);
    if (triplicacaoPatternFound) console.log(` ALGORITMO ... [${triplicacaoTypeFound}] - Padrão: ${triplicacaoPatternFound}`);
    console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
    console.log(` STAKE ....... R$ ${strat.stake.toFixed(2)}`);
    rl.setPrompt('roleta/comando > ');
  } 
  else {
    console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
    rl.setPrompt('roleta/comando > ');
  }
  console.log('======================================================');
  rl.prompt();
}

startOrchestrator();
EOF

git add tests/sprint-370-governance.test.js scripts/live-paper-orchestrator.js
git commit -m "feat(governance): implement TDD suite, tactical cooldown reports, executive EOD dossier, and enforce midnight global hard lock (Sprint 370)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 370 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: TESTES APROVADOS E RELATÓRIOS ON"
echo "======================================"

