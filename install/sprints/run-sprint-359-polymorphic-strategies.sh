#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 359"
echo " POLYMORPHIC SETTLEMENT ENGINE (HEDGE STRATS)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Reconstruindo Motor de Liquidação para Suportar Hedges..."
cat > src/domain/financial/AutoSettlementEngine.js <<'EOF'
'use strict';

/**
 * Motor Polimórfico de Liquidação.
 * Suporta estratégias complexas com múltiplos níveis de retorno (Win, Min Win, Push, Loss).
 */
class AutoSettlementEngine {
  
  static get RED_NUMS() { return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]; }
  static get BLACK_NUMS() { return [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]; }
  static get COL2_NUMS() { return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]; }
  static get COL3_NUMS() { return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]; }

  evaluate(drawnNumber, strategyId) {
    const strat = AutoSettlementEngine.getStrategies()[strategyId];
    if (!strat) throw new Error('Estratégia não mapeada.');
    return strat.evaluate(drawnNumber);
  }

  static getStrategies() {
    return {
      'HEDGE_BLACK_COL3': {
        name: 'Hedge Black Col 3',
        stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isBlack = AutoSettlementEngine.BLACK_NUMS.includes(num);
          const isCol3 = AutoSettlementEngine.COL3_NUMS.includes(num);
          
          if (isBlack && isCol3) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isBlack && !isCol3) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isBlack && isCol3) return { status: 'PUSH', netAmount: 0.00 }; // Defesa
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      'HEDGE_RED_COL2': {
        name: 'Hedge Red Col 2',
        stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isRed = AutoSettlementEngine.RED_NUMS.includes(num);
          const isCol2 = AutoSettlementEngine.COL2_NUMS.includes(num);
          
          if (isRed && isCol2) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isRed && !isCol2) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isRed && isCol2) return { status: 'PUSH', netAmount: 0.00 }; // Defesa
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      // FUSION MANTIDA COMO LEGADO DA SPRINT ANTERIOR
      'FUSION_SECTOR': {
        name: 'Fusion Reduzida (Setor do 23)',
        stake: 1.90,
        evaluate: (num) => {
          const targets = [17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31];
          if (targets.includes(num)) return { status: 'WIN_MAX', netAmount: 1.70 };
          return { status: 'LOSS', netAmount: -1.90 };
        }
      }
    };
  }
}

module.exports = { AutoSettlementEngine };
EOF

echo "[2/2] Atualizando Orquestrador para PUSH e Multi-Retornos..."
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
  
  // Mock Analítico: Alterna entre as novas estratégias de Hedge
  const r = Math.random();
  if (r > 0.66) activeStrategyId = 'HEDGE_BLACK_COL3';
  else if (r > 0.33) activeStrategyId = 'HEDGE_RED_COL2';
  else activeStrategyId = null; 
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
          // Push é uma defesa: Não dá lucro, mas quebra o Loss Streak
          cooldownGuard.registerOutcome(true, cooldownGuard.currentBankroll);
          voiceCopilot.speak('Empate tático. Capital protegido.');
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
  console.log(' 🛡️ RL.SYS CORE - POLYMORPHIC HEDGE ENGINE');
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
    let color = '\x1b[31m'; // Default Red
    let label = 'RED (Loss)';
    
    if (pendingResult.status === 'WIN_MAX') { color = '\x1b[32m'; label = 'GREEN MÁXIMO'; }
    if (pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN MÍNIMO'; }
    if (pendingResult.status === 'PUSH') { color = '\x1b[33m'; label = 'PUSH (Empate Seguro)'; }
    
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

if (savedState === null) {
  rl.question('Banca Inicial (R$): ', (answer) => {
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
EOF

git add src/domain/financial/AutoSettlementEngine.js scripts/live-paper-orchestrator.js
git commit -m "feat(financial): implement polymorphic settlement for complex hedging (Sprint 359)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 359 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: HEDGE ENGINE ONLINE"
echo "======================================"

