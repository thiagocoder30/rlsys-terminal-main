'use strict';

const readline = require('node:readline');
const { DynamicEmotionalCooldownGuard } = require('../src/domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { FileBankrollRepository } = require('../src/infrastructure/persistence/FileBankrollRepository.js');
const { AutoSettlementEngine } = require('../src/domain/financial/AutoSettlementEngine.js');

const voiceCopilot = new TermuxTtsVoiceCopilot();
const bankrollRepo = new FileBankrollRepository();
const settlementEngine = new AutoSettlementEngine();

let initialBankroll = bankrollRepo.load();
if (initialBankroll === null) initialBankroll = 100.00; 

let cooldownGuard;
let activeTrade = null; 

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function startOrchestrator() {
  cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll);
  renderTerminalHud();
  rl.setPrompt('roleta (0-36) > ');
  rl.prompt();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    if (cmd === 'exit' || cmd === 'quit') {
      bankrollRepo.save(cooldownGuard.currentBankroll);
      console.log('\n[!] Capital salvo no repositório. Saindo...');
      rl.close();
      return;
    }

    if (cmd === 'skip' || cmd === 'pass') {
      if (activeTrade) {
        activeTrade = null;
        voiceCopilot.speak('Entrada abortada pelo operador.');
      }
      renderTerminalHud();
      rl.prompt();
      return;
    }

    if (cmd.startsWith('sync ')) {
      activeTrade = null;
      voiceCopilot.speak('Histórico sincronizado. Operação fantasma evitada.');
      renderTerminalHud();
      rl.prompt();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida. Digite o número, "skip" ou "sync [nums]".');
      rl.prompt();
      return;
    }

    if (activeTrade && !cooldownGuard.isLocked()) {
      const result = settlementEngine.evaluate(num, activeTrade);
      
      if (result.isWin) {
        cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + result.netAmount);
        voiceCopilot.speak('Green confirmado.');
      } else {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - result.netAmount);
        voiceCopilot.speak('Red detectado.');
      }
      bankrollRepo.save(cooldownGuard.currentBankroll);
      activeTrade = null; 
    }

    if (cooldownGuard.isSessionEnded) {
       activeTrade = null;
       renderTerminalHud();
       rl.prompt();
       return;
    }

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
  console.log(' 🛡️ RL.SYS CORE - ZERO-TOUCH & MILESTONE LADDER');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  
  if (!cooldownGuard.isSessionEnded) {
    console.log(` PRÓXIMO DEGRAU .. R$ ${cooldownGuard.nextMilestone.toFixed(2)} (Parcial)`);
  }
  console.log(` META GLOBAL (10%) R$ ${cooldownGuard.globalStopWinTarget.toFixed(2)}`);
  console.log(` LOSS STREAK ..... ${cooldownGuard.consecutiveLosses} / 2`);
  console.log('------------------------------------------------------');
  
  if (lockStatus) {
    console.log(`\x1b[31m 🛑 COOLDOWN ATIVO: ${lockStatus.time}\x1b[0m`);
    console.log(` MOTIVO: ${lockStatus.reason}`);
  } else if (activeTrade) {
    console.log(` ESTRATÉGIA .. ${activeTrade.strategy}`);
    console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
    console.log(` STAKE ....... R$ ${activeTrade.stake.toFixed(2)}`);
    console.log(` (Digite o número, ou 'skip' se perdeu a entrada)`);
  } else {
    console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
    console.log(` MESA ........ Aguardando alinhamento institucional.`);
  }
  console.log('======================================================');
}

startOrchestrator();
