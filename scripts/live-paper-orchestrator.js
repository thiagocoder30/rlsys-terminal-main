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

// Variáveis de Estado do Orquestrador
let activeTrade = null;
let inputMode = 'NUMBER'; // 'NUMBER', 'CONFIRM_TRADE', ou 'VIEW_ONLY'
let pendingResult = null; 

function saveSystemState() {
  const currentSnapshot = cooldownGuard.exportState();
  bankrollRepo.save(currentSnapshot);
}

function generateNextTrade() {
  if (cooldownGuard.isSessionEnded || cooldownGuard.isLocked()) {
    activeTrade = null;
    return;
  }
  
  const isContextFavorable = Math.random() > 0.6; // Mock analítico
  if (isContextFavorable) {
    activeTrade = {
      strategy: 'FUSION REDUZIDA (Setor do 23)',
      type: 'FUSION_SECTOR',
      targets: AutoSettlementEngine.getTargets().FUSION_23,
      stake: 1.90
    };
  } else {
    activeTrade = null;
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

    // MODO 3: VISUALIZAÇÃO DE RELATÓRIOS (ON-DEMAND)
    if (inputMode === 'VIEW_ONLY') {
      inputMode = 'NUMBER';
      renderTerminalHud();
      return;
    }

    // MODO 2: AGUARDANDO CONFIRMAÇÃO DO USUÁRIO
    if (inputMode === 'CONFIRM_TRADE') {
      if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
        if (pendingResult.isWin) {
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + pendingResult.netAmount);
          voiceCopilot.speak('Green liquidado.');
        } else {
          cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - pendingResult.netAmount);
          voiceCopilot.speak('Red absorvido.');
        }
        saveSystemState();
      } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
        voiceCopilot.speak('Entrada descartada.');
      } else {
        console.log('Comando inválido. Digite "s" para Sim ou "n" para Não.');
        rl.prompt();
        return;
      }

      inputMode = 'NUMBER';
      pendingResult = null;
      activeTrade = null;
      generateNextTrade();
      renderTerminalHud();
      return;
    }

    // COMANDOS DE INTERFACE ON-DEMAND
    if (cmd === 'timeline') {
      console.clear();
      console.log('======================================================');
      console.log(' ⏱️ TIMELINE (ÚLTIMAS 12 RODADAS)');
      console.log('======================================================');
      console.log(` Histórico: \x1b[36m${mesaTracker.getTimeline(12)}\x1b[0m`);
      console.log('======================================================');
      console.log(' Pressione ENTER para voltar ao painel principal...');
      inputMode = 'VIEW_ONLY';
      rl.prompt();
      return;
    }

    if (cmd === 'heatmap') {
      const stats = mesaTracker.getHeatmap();
      console.clear();
      console.log('======================================================');
      console.log(' 🔥 HEATMAP (ANÁLISE DE FREQUÊNCIA)');
      console.log('======================================================');
      console.log(` Giros Analisados : ${stats.totalSpins}`);
      console.log(` Números Quentes  : \x1b[31m${stats.hot}\x1b[0m`);
      console.log(` Números Frios    : \x1b[34m${stats.cold}\x1b[0m`);
      console.log('======================================================');
      console.log(' Pressione ENTER para voltar ao painel principal...');
      inputMode = 'VIEW_ONLY';
      rl.prompt();
      return;
    }

    // MODO 1: RECEBENDO NÚMEROS DA ROLETA
    if (cooldownGuard.isLocked()) {
      if (!cmd.startsWith('sync ') && cmd !== 'timeline' && cmd !== 'heatmap') {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); 
        saveSystemState();
        voiceCopilot.speak('Penalidade por ansiedade.');
        renderTerminalHud();
        return;
      }
    }

    if (cmd.startsWith('sync ')) {
      const numbers = cmd.replace('sync ', '').split(',').map(n => parseInt(n.trim(), 10));
      let syncedCount = 0;
      
      numbers.forEach(n => {
        if (!isNaN(n) && n >= 0 && n <= 36) {
          mesaTracker.addNumber(n);
          syncedCount++;
        }
      });
      
      activeTrade = null;
      generateNextTrade();
      voiceCopilot.speak(`${syncedCount} números sincronizados.`);
      renderTerminalHud();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida. Digite número, "sync", "timeline" ou "heatmap".');
      rl.prompt();
      return;
    }

    mesaTracker.addNumber(num); // Alimenta o motor analítico

    if (activeTrade) {
      pendingResult = settlementEngine.evaluate(num, activeTrade);
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
  console.log(' 🛡️ RL.SYS CORE - EXPLICIT HANDSHAKE & ANALYTICS');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  
  if (!cooldownGuard.isSessionEnded) {
    console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)}`);
  }
  console.log(` META GLOBAL (10%) R$ ${cooldownGuard.globalStopWinTarget.toFixed(2)}`);
  console.log(` LOSS STREAK ..... ${cooldownGuard.consecutiveLosses} / 2`);
  console.log('------------------------------------------------------');
  
  if (lockStatus) {
    console.log(`\x1b[31m 🛑 TRAVA INVIOLÁVEL ATIVA: ${lockStatus.time}\x1b[0m`);
    console.log(` MOTIVO: ${lockStatus.reason}`);
    console.log(` (Comandos permitidos: timeline, heatmap, sync)`);
    rl.setPrompt('comando > ');
  } 
  else if (inputMode === 'CONFIRM_TRADE') {
    const color = pendingResult.isWin ? '\x1b[32m' : '\x1b[31m';
    const label = pendingResult.isWin ? 'GREEN (Lucro)' : 'RED (Loss)';
    const amount = pendingResult.netAmount.toFixed(2);
    
    console.log(` ${color}RESULTADO DA ESTRATÉGIA: ${label} | R$ ${amount}\x1b[0m`);
    console.log('------------------------------------------------------');
    console.log(` [?] Você executou essa aposta na corretora?`);
    rl.setPrompt('Confirme (s/n) > ');
  } 
  else if (activeTrade) {
    console.log(` ESTRATÉGIA .. ${activeTrade.strategy}`);
    console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
    console.log(` STAKE ....... R$ ${activeTrade.stake.toFixed(2)}`);
    console.log(` (Digite o número sorteado ou use: timeline, heatmap)`);
    rl.setPrompt('roleta/comando > ');
  } 
  else {
    console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
    console.log(` MESA ........ Aguardando alinhamento institucional.`);
    console.log(` (Digite o número sorteado ou use: timeline, heatmap)`);
    rl.setPrompt('roleta/comando > ');
  }
  
  console.log('======================================================');
  rl.prompt();
}

if (savedState === null) {
  rl.question('Primeiro acesso detectado. Digite a Banca Inicial (R$): ', (answer) => {
    initialBankroll = parseFloat(answer) || 100.00;
    cooldownGuard.initialBankroll = initialBankroll;
    cooldownGuard.currentBankroll = initialBankroll;
    cooldownGuard.calculateNextMilestone();
    saveSystemState();
    startOrchestrator();
  });
} else {
  startOrchestrator();
}
