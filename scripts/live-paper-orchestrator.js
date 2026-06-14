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

const savedState = bankrollRepo.load();
let initialBankroll = 100.00;
if (savedState && savedState.initialBankroll) initialBankroll = savedState.initialBankroll;

const cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll, savedState);

let activeStrategyId = null;
let inputMode = 'NUMBER'; 
let pendingResult = null; 

function saveSystemState() {
  const currentSnapshot = cooldownGuard.exportState();
  bankrollRepo.save(currentSnapshot);
}

function generateNextTrade() {
  if (cooldownGuard.isSessionEnded || cooldownGuard.isLocked()) {
    activeStrategyId = null;
    return;
  }
  
  // Seleção aleatória simulada entre o portfólio completo de estratégias ativas
  const strategies = ['HEDGE_BLACK_COL3', 'HEDGE_RED_COL2', 'SECTOR_OMEGA', 'SECTOR_ALPHA', 'FUSION_SECTOR'];
  const r = Math.random();
  if (r > 0.5) {
    const index = Math.floor(Math.random() * strategies.length);
    activeStrategyId = strategies[index];
  } else {
    activeStrategyId = null; 
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

    if (inputMode === 'VIEW_ONLY') {
      inputMode = 'NUMBER';
      renderTerminalHud();
      return;
    }

    if (inputMode === 'CONFIRM_TRADE') {
      if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
        if (pendingResult.status === 'WIN_MAX' || pendingResult.status === 'WIN_MIN') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + pendingResult.netAmount);
          voiceCopilot.speak('Green liquidado.');
        } else if (pendingResult.status === 'PUSH') {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll);
          voiceCopilot.speak('Empate tático.');
        } else {
          cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - Math.abs(pendingResult.netAmount));
          voiceCopilot.speak('Red absorvido.');
        }
        saveSystemState();
      } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
        voiceCopilot.speak('Entrada descartada.');
      } else {
        console.log('Comando inválido. Digite "s" ou "n".');
        rl.prompt();
        return;
      }

      inputMode = 'NUMBER';
      pendingResult = null;
      activeStrategyId = null;
      generateNextTrade();
      renderTerminalHud();
      return;
    }

    if (cmd === 'timeline') {
      console.clear();
      console.log('======================================================');
      console.log(` Histórico: \x1b[36m${mesaTracker.getTimeline(12)}\x1b[0m`);
      console.log(' Pressione ENTER para voltar...');
      inputMode = 'VIEW_ONLY';
      rl.prompt(); return;
    }
    if (cmd === 'heatmap') {
      const stats = mesaTracker.getHeatmap();
      console.clear();
      console.log('======================================================');
      console.log(` Quentes : \x1b[31m${stats.hot}\x1b[0m | Frios : \x1b[34m${stats.cold}\x1b[0m`);
      console.log(' Pressione ENTER para voltar...');
      inputMode = 'VIEW_ONLY';
      rl.prompt(); return;
    }

    if (cooldownGuard.isLocked()) {
      if (!cmd.startsWith('sync ') && cmd !== 'timeline' && cmd !== 'heatmap') {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); 
        saveSystemState();
        renderTerminalHud();
        return;
      }
    }

    if (cmd.startsWith('sync ')) {
      const numbers = cmd.replace('sync ', '').split(',').map(n => parseInt(n.trim(), 10));
      numbers.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) mesaTracker.addNumber(n); });
      activeStrategyId = null;
      generateNextTrade();
      renderTerminalHud();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida.'); rl.prompt(); return;
    }

    mesaTracker.addNumber(num); 

    if (activeStrategyId) {
      pendingResult = settlementEngine.evaluate(num, activeStrategyId);
      inputMode = 'CONFIRM_TRADE'; 
      renderTerminalHud();
      return;
    }

    generateNextTrade();
    renderTerminalHud();
  });
}

function renderTerminalHud() {
  console.clear();
  const lockStatus = cooldownGuard.getRemainingStatus();
  
  console.log('======================================================');
  console.log(' 🛡️ RL.SYS CORE - MULTI-STRATEGY PORTFOLIO');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  if (!cooldownGuard.isSessionEnded) console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)}`);
  console.log(` LOSS STREAK ..... ${cooldownGuard.consecutiveLosses} / 2`);
  console.log('------------------------------------------------------');
  
  if (lockStatus) {
    console.log(`\x1b[31m 🛑 TRAVA INVIOLÁVEL ATIVA: ${lockStatus.time}\x1b[0m`);
    rl.setPrompt('comando > ');
  } 
  else if (inputMode === 'CONFIRM_TRADE') {
    const stratName = AutoSettlementEngine.getStrategies()[activeStrategyId].name;
    let color = '\x1b[31m';
    let label = 'RED (Loss)';
    
    if (pendingResult.status === 'WIN_MAX') { color = '\x1b[32m'; label = 'GREEN MÁXIMO'; }
    if (pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN MÍNIMO'; }
    if (pendingResult.status === 'PUSH') { color = '\x1b[33m'; label = 'PUSH (Empate)'; }
    
    const amount = pendingResult.netAmount.toFixed(2);
    
    console.log(` ${color}RESULTADO: ${label} | R$ ${amount}\x1b[0m`);
    console.log('------------------------------------------------------');
    console.log(` [?] Você executou a estratégia [${stratName}]?`);
    rl.setPrompt('Confirme (s/n) > ');
  } 
  else if (activeStrategyId) {
    const strat = AutoSettlementEngine.getStrategies()[activeStrategyId];
    console.log(` ESTRATÉGIA .. ${strat.name}`);
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
