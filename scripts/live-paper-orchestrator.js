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
let toxicTableLockUntil = null; // Trava de Rejeição de Mesa (15 min)

function saveSystemState() {
  const currentSnapshot = cooldownGuard.exportState();
  bankrollRepo.save(currentSnapshot);
}

// ALGORITMO DE ENTROPIA DE SHANNON
function computeShannonEntropy(counts, total) {
  if (total === 0) return 0;
  let entropy = 0;
  counts.forEach(count => {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  });
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
  
  // Cálculo do VIX usando a Entropia de Shannon (Máx H para 4 padrões = 2.0)
  const entropy = computeShannonEntropy([tc, ntc, ta, nta], totalTrios);
  const vix = totalTrios > 0 ? (entropy / 2.0) * 100 : 0;

  const pairs = [['TC', tc], ['NTC', ntc], ['TA', ta], ['NTA', nta]];
  let dominantPattern = 'NONE';
  let dominantCount = 0;
  for (const [pattern, count] of pairs) {
    if (count > dominantCount) { dominantPattern = pattern; dominantCount = count; }
  }
  
  return {
    totalTrios, dominantPattern, vix,
    dominantRatio: totalTrios > 0 ? dominantCount / totalTrios : 0
  };
}

function checkToxicTableLock() {
  if (toxicTableLockUntil && Date.now() < toxicTableLockUntil) return true;
  if (toxicTableLockUntil && Date.now() >= toxicTableLockUntil) toxicTableLockUntil = null; // Libera
  return false;
}

function generateNextTrade() {
  activeStrategyId = null;
  triplicacaoPatternFound = null;
  triplicacaoTypeFound = null;

  if (cooldownGuard.isSessionEnded || cooldownGuard.isLocked() || checkToxicTableLock()) return;
  if (mesaTracker.history.length < 10) return;

  const reversedHistory = [...mesaTracker.history].reverse();
  const REDS = new Set(AutoSettlementEngine.RED_NUMS);
  
  const colorStats = computeTriplicacao(reversedHistory, v => REDS.has(v) ? 'A' : 'B');
  const parityStats = computeTriplicacao(reversedHistory, v => v % 2 === 0 ? 'A' : 'B');

  // VIX GLOBAL DA MESA (Média da Entropia de Cor e Paridade)
  currentVixPercent = (colorStats.vix + parityStats.vix) / 2;

  if (reversedHistory.length % 3 === 2) {
    const inicio = reversedHistory[1];
    const confirmacao = reversedHistory[0];
    
    if (inicio !== 0 && confirmacao !== 0) {
      let colorTarget = null;
      let parityTarget = null;

      if (colorStats.totalTrios >= 35 && colorStats.dominantRatio >= 0.42) {
        const c0 = REDS.has(inicio) ? 'A' : 'B';
        const c1 = REDS.has(confirmacao) ? 'A' : 'B';
        if (colorStats.dominantPattern === 'TC' && c0 === c1) colorTarget = c1;
        else if (colorStats.dominantPattern === 'NTC' && c0 === c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
        else if (colorStats.dominantPattern === 'TA' && c0 !== c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
        else if (colorStats.dominantPattern === 'NTA' && c0 !== c1) colorTarget = c1;
      }

      if (parityStats.totalTrios >= 35 && parityStats.dominantRatio >= 0.42) {
        const p0 = inicio % 2 === 0 ? 'A' : 'B';
        const p1 = confirmacao % 2 === 0 ? 'A' : 'B';
        if (parityStats.dominantPattern === 'TC' && p0 === p1) parityTarget = p1;
        else if (parityStats.dominantPattern === 'NTC' && p0 === p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
        else if (parityStats.dominantPattern === 'TA' && p0 !== p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
        else if (parityStats.dominantPattern === 'NTA' && p0 !== p1) parityTarget = p1;
      }

      if (colorTarget && parityTarget) {
        if (colorStats.dominantRatio >= parityStats.dominantRatio) parityTarget = null;
        else colorTarget = null;
      }

      if (colorTarget) {
        triplicacaoTypeFound = 'COR';
        triplicacaoPatternFound = colorStats.dominantPattern;
        activeStrategyId = colorTarget === 'A' ? 'TRIPLICACAO_RED' : 'TRIPLICACAO_BLACK';
        return; 
      }
      
      if (parityTarget) {
        triplicacaoTypeFound = 'PARIDADE';
        triplicacaoPatternFound = parityStats.dominantPattern;
        activeStrategyId = parityTarget === 'A' ? 'TRIPLICACAO_EVEN' : 'TRIPLICACAO_ODD';
        return;
      }
    }
  }

  const timeline = mesaTracker.history.slice(-15); 
  let scores = { 'HEDGE_BLACK_COL3': 0, 'HEDGE_RED_COL2': 0, 'SECTOR_OMEGA': 0, 'SECTOR_ALPHA': 0, 'FUSION_SECTOR': 0 };
  const engineStrategies = AutoSettlementEngine.getStrategies();

  timeline.forEach(num => {
    Object.keys(scores).forEach(stratId => {
       const result = engineStrategies[stratId].evaluate(num);
       if (result.status === 'WIN_MAX' || result.status === 'WIN_MIN') scores[stratId]++;
    });
  });

  let bestStrat = null;
  let maxScore = 0;
  Object.entries(scores).forEach(([strat, score]) => {
     if (score > maxScore) { maxScore = score; bestStrat = strat; }
  });

  if (bestStrat && maxScore >= (timeline.length * 0.40)) {
     activeStrategyId = bestStrat;
  }
}

function startOrchestrator() {
  generateNextTrade();
  renderTerminalHud();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    if (cmd === 'exit' || cmd === 'quit') {
      saveSystemState();
      console.log('\n[!] Estado protegido e salvo no disco. Encerrando terminal...');
      rl.close();
      return;
    }

    if (cmd.startsWith('setbankroll ')) {
      const newVal = parseFloat(cmd.replace('setbankroll ', '').trim());
      if (isNaN(newVal) || newVal <= 0) { console.log('Inválido.'); rl.prompt(); return; }
      cooldownGuard = new DynamicEmotionalCooldownGuard(newVal, null);
      activeStrategyId = null; inputMode = 'NUMBER'; pendingResult = null; toxicTableLockUntil = null;
      saveSystemState(); generateNextTrade(); renderTerminalHud(); return;
    }

    if (inputMode === 'VIEW_ONLY') { inputMode = 'NUMBER'; renderTerminalHud(); return; }

    if (inputMode === 'CONFIRM_TRADE') {
      if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
        if (pendingResult.status === 'WIN_MAX' || pendingResult.status === 'WIN_MIN') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + pendingResult.netAmount);
          voiceCopilot.speak('Green liquidado.');
        } else if (pendingResult.status === 'PUSH') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll);
        } else {
          cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - Math.abs(pendingResult.netAmount));
          voiceCopilot.speak('Red absorvido.');
        }
        saveSystemState();
      } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
        voiceCopilot.speak('Entrada descartada.');
      } else {
        console.log('Inválido.'); rl.prompt(); return;
      }
      inputMode = 'NUMBER'; pendingResult = null; activeStrategyId = null;
      generateNextTrade(); renderTerminalHud(); return;
    }

    if (cmd === 'timeline') { console.clear(); console.log(`\n Histórico: \x1b[36m${mesaTracker.getTimeline(15)}\x1b[0m\n [ENTER] para voltar...`); inputMode = 'VIEW_ONLY'; rl.prompt(); return; }
    if (cmd === 'heatmap') { const s = mesaTracker.getHeatmap(); console.clear(); console.log(`\n Quentes: \x1b[31m${s.hot}\x1b[0m | Frios: \x1b[34m${s.cold}\x1b[0m\n [ENTER] para voltar...`); inputMode = 'VIEW_ONLY'; rl.prompt(); return; }

    if (cooldownGuard.isLocked() || checkToxicTableLock()) {
      if (!cmd.startsWith('sync ') && cmd !== 'timeline' && cmd !== 'heatmap') {
        if (!checkToxicTableLock()) cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); 
        saveSystemState(); renderTerminalHud(); return;
      }
    }

    if (cmd.startsWith('sync ')) {
      const numbers = cmd.replace('sync ', '').split(',').map(n => parseInt(n.trim(), 10));
      numbers.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) mesaTracker.addNumber(n); });
      generateNextTrade();
      
      // TOXIC TABLE GOVERNANCE: Avalia a mesa após o Warmup
      if (numbers.length > 20 && currentVixPercent > 85.0) {
         toxicTableLockUntil = Date.now() + (15 * 60 * 1000); // 15 minutos de trava
         voiceCopilot.speak('Atenção. Entropia máxima detectada. Mesa rejeitada.');
      }
      
      renderTerminalHud(); return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) { console.log('Entrada inválida.'); rl.prompt(); return; }

    mesaTracker.addNumber(num); 
    if (activeStrategyId) {
      pendingResult = settlementEngine.evaluate(num, activeStrategyId);
      inputMode = 'CONFIRM_TRADE'; renderTerminalHud(); return;
    }

    generateNextTrade(); renderTerminalHud();
  });
}

function renderTerminalHud() {
  console.clear();
  const lockStatus = cooldownGuard.getRemainingStatus();
  const toxicLockActive = checkToxicTableLock();
  
  console.log('======================================================');
  console.log(' 🛡️ RL.SYS CORE - SHANNON ENTROPY & VIX ENGINE');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  if (!cooldownGuard.isSessionEnded) console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)}`);
  
  // MEDIDOR DE VIX / ENTROPIA
  let vixColor = '\x1b[32m'; // Verde (Low Entropy)
  if (currentVixPercent > 70) vixColor = '\x1b[33m'; // Amarelo (Med Entropy)
  if (currentVixPercent > 85) vixColor = '\x1b[31m'; // Vermelho (Toxic)
  if (mesaTracker.history.length >= 10) {
      console.log(` ENTROPIA DA MESA. ${vixColor}${currentVixPercent.toFixed(1)}% (VIX)\x1b[0m`);
  } else {
      console.log(` ENTROPIA DA MESA. \x1b[36mAguardando Warmup...\x1b[0m`);
  }
  
  console.log('------------------------------------------------------');
  
  if (toxicLockActive) {
    const remaining = Math.ceil((toxicTableLockUntil - Date.now()) / 60000);
    console.log(`\x1b[31m ☣️ MESA TÓXICA REJEITADA PELO SISTEMA\x1b[0m`);
    console.log(` MOTIVO: Entropia de Shannon confirmou ausência de padrões.`);
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
