'use strict';

const readline = require('node:readline');
const { DynamicEmotionalCooldownGuard } = require('../src/domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { FileBankrollRepository } = require('../src/infrastructure/persistence/FileBankrollRepository.js');
const { AutoSettlementEngine } = require('../src/domain/financial/AutoSettlementEngine.js');

const voiceCopilot = new TermuxTtsVoiceCopilot();
const bankrollRepo = new FileBankrollRepository();
const settlementEngine = new AutoSettlementEngine();

console.clear();
console.log('======================================================');
console.log(' ⚙️ RL.SYS CORE - ZERO-TOUCH SETTLEMENT (SPRINT 353)');
console.log('======================================================');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// 1. Fase de Persistência (Boot)
let initialBankroll = bankrollRepo.load();
let cooldownGuard;
let activeTrade = null; // Memória da última ordem do sistema

function startOrchestrator() {
  cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll);
  voiceCopilot.speak(`Banca recuperada. Capital em ${initialBankroll.toFixed(2)} reais. Governança ativa.`);
  renderTerminalHud();

  rl.setPrompt('roleta (0-36) > ');
  rl.prompt();

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    if (cmd === 'exit' || cmd === 'quit') {
      bankrollRepo.save(cooldownGuard.currentBankroll);
      voiceCopilot.speak('Sessão encerrada. Capital preservado em disco.');
      console.log('\n[!] Capital salvo no repositório. Saindo...');
      rl.close();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida. Digite o número da roleta (0-36).');
      rl.prompt();
      return;
    }

    // 2. Fase de Auto-Settlement (Verifica se havia uma ordem aberta na rodada anterior)
    if (activeTrade && !cooldownGuard.isLocked()) {
      const result = settlementEngine.evaluate(num, activeTrade.targets, activeTrade.stake, activeTrade.payoutMultiplier);
      
      if (result.isWin) {
        cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll + result.netAmount);
        voiceCopilot.speak('Green confirmado. Lucro liquidado na banca.');
      } else {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll - result.netAmount);
        voiceCopilot.speak('Red detectado. Risco absorvido sem alavancagem.');
      }
      bankrollRepo.save(cooldownGuard.currentBankroll);
      activeTrade = null; // Limpa a ordem após a liquidação
    }

    // 3. Atualização do Motor de Decisão (Mock para HUD)
    // Aqui o AnalyticsDecisionEngine faria o recálculo com o novo número
    const isContextFavorable = Math.random() > 0.5; // Simulação de engine de consenso
    
    if (isContextFavorable && !cooldownGuard.isLocked()) {
      // Prepara a próxima entrada
      activeTrade = {
        strategy: 'FUSION REDUZIDA (Vermelhos)',
        targets: AutoSettlementEngine.getTargets().RED,
        stake: 1.90, // Calculado via InstitutionalPositionSizingEngine
        payoutMultiplier: 2
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
  console.log(' 🛡️ RL.SYS CORE - AUTO-SETTLEMENT ACTIVE');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  console.log(` LOSS STREAK ..... ${cooldownGuard.consecutiveLosses} / 2`);
  console.log('------------------------------------------------------');
  
  if (lockStatus) {
    console.log(`\x1b[31m 🛑 COOLDOWN ATIVO: ${lockStatus.time}\x1b[0m`);
    console.log(` MOTIVO: ${lockStatus.reason}`);
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

if (initialBankroll === null) {
  rl.question('Primeiro acesso detectado. Digite a Banca Inicial (R$): ', (answer) => {
    initialBankroll = parseFloat(answer) || 100.00;
    bankrollRepo.save(initialBankroll);
    startOrchestrator();
  });
} else {
  startOrchestrator();
}
