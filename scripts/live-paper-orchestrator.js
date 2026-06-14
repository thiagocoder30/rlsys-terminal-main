'use strict';

const readline = require('node:readline');
const { DynamicEmotionalCooldownGuard } = require('../src/domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { FileBankrollRepository } = require('../src/infrastructure/persistence/FileBankrollRepository.js');
const { AutoSettlementEngine } = require('../src/domain/financial/AutoSettlementEngine.js');

const voiceCopilot = new TermuxTtsVoiceCopilot();
const bankrollRepo = new FileBankrollRepository();
const settlementEngine = new AutoSettlementEngine();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Carrega o estado persistido completo do disco
const savedState = bankrollRepo.load();
let initialBankroll = 100.00;

if (savedState && savedState.initialBankroll) {
  initialBankroll = savedState.initialBankroll;
}

// Inicializa o motor com injeção de dependência do estado persistido
const cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll, savedState);
let activeTrade = null;

function saveSystemState() {
  const currentSnapshot = cooldownGuard.exportState();
  bankrollRepo.save(currentSnapshot);
}

function startOrchestrator() {
  if (cooldownGuard.isLocked()) {
    voiceCopilot.speak('Acesso negado. Governança emocional ativa em disco.');
  } else {
    voiceCopilot.speak('Sessão iniciada. Monitoramento de capital ativo.');
  }
  
  renderTerminalHud();
  rl.setPrompt('roleta (0-36) > ');
  rl.prompt();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    if (cmd === 'exit' || cmd === 'quit') {
      saveSystemState();
      console.log('\n[!] Estado protegido e salvo no disco. Encerrando terminal...');
      rl.close();
      return;
    }

    if (cmd === 'skip' || cmd === 'pass') {
      if (activeTrade) {
        activeTrade = null;
        voiceCopilot.speak('Entrada abortada.');
      }
      renderTerminalHud();
      rl.prompt();
      return;
    }

    if (cmd.startsWith('sync ')) {
      activeTrade = null;
      voiceCopilot.speak('Sincronizado.');
      renderTerminalHud();
      rl.prompt();
      return;
    }

    // Se tentar burlar digitando números durante o Cooldown travado em disco
    if (cooldownGuard.isLocked()) {
      cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); // Aplica punição de +2 minutos
      saveSystemState();
      voiceCopilot.speak('Penalidade por tentativa de violação.');
      renderTerminalHud();
      rl.prompt();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida.');
      rl.prompt();
      return;
    }

    if (activeTrade && !cooldownGuard.isLocked()) {
      const result = settlementEngine.evaluate(num, activeTrade);
      
      if (result.isWin) {
        cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + result.netAmount);
        voiceCopilot.speak('Green.');
      } else {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - result.netAmount);
        voiceCopilot.speak('Red.');
      }
      saveSystemState();
      activeTrade = null; 
    }

    if (cooldownGuard.isSessionEnded) {
       activeTrade = null;
       renderTerminalHud();
       rl.prompt();
       return;
    }

    // Geração de sinal controlada
    const isContextFavorable = Math.random() > 0.6; 
    if (isContextFavorable && !cooldownGuard.isLocked()) {
      activeTrade = {
        strategy: 'FUSION REDUZIDA (Setor do 23)',
        type: 'FUSION_SECTOR',
        targets: AutoSettlementEngine.getTargets().FUSION_23,
        stake: 1.90
      };
    } else {
      activeTrade = null;
    }

    renderTerminalHud();
    rl.prompt();
  });
}

function renderTerminalHud() {
  console.clear();
  const lockStatus = cooldownGuard.getRemainingStatus();
  
  console.log('======================================================');
  console.log(' 🛡️ RL.SYS CORE - ANTI-EVASION PERSISTENCE ACTIVE');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  
  if (!cooldownGuard.isSessionEnded) {
    console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)} (Parcial)`);
  }
  console.log(` META GLOBAL (10%) R$ ${cooldownGuard.globalStopWinTarget.toFixed(2)}`);
  console.log(` LOSS STREAK ..... ${cooldownGuard.consecutiveLosses} / 2`);
  console.log('------------------------------------------------------');
  
  if (lockStatus) {
    console.log(`\x1b[31m 🛑 TRAVA INVIOLÁVEL ATIVA: ${lockStatus.time}\x1b[0m`);
    console.log(` MOTIVO: ${lockStatus.reason}`);
    console.log(' Sair do programa ou reiniciar NÃO quebrará este bloqueio.');
  } else if (activeTrade) {
    console.log(` ESTRATÉGIA .. ${activeTrade.strategy}`);
    console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
    console.log(` STAKE ....... R$ ${activeTrade.stake.toFixed(2)}`);
  } else {
    console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
    console.log(` MESA ........ Aguardando alinhamento institucional.`);
  }
  console.log('======================================================');
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
