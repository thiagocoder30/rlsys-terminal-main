#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - HOTFIX 353.1"
echo " CORREÇÃO DE DOMÍNIO FUSION/TRIPLICAÇÃO"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Corrigindo Motor de Liquidação Automática..."
cat > src/domain/financial/AutoSettlementEngine.js <<'EOF'
'use strict';

class AutoSettlementEngine {
  
  evaluate(drawnNumber, activeTrade) {
    const { targets, stake, type } = activeTrade;
    
    // Se caiu zero e não é uma estratégia que cobre o zero, é Loss
    if (drawnNumber === 0 && !targets.includes(0)) {
      return { isWin: false, netAmount: stake };
    }

    const isWin = targets.includes(drawnNumber);
    
    if (isWin) {
      let netReturn = 0;
      
      if (type === 'COLOR') {
        // Exemplo Triplicação: Stake de 1.90 paga 3.80. Lucro = 1.90
        netReturn = (stake * 2) - stake;
      } 
      else if (type === 'FUSION_SECTOR') {
        // Exemplo Fusion: Stake 1.90 em 19 números = 0.10 por número.
        // Acertou 1 número: 0.10 * 36 = 3.60 bruto. Líquido = 3.60 - 1.90 = 1.70.
        const unitStake = stake / targets.length;
        const grossReturn = unitStake * 36;
        netReturn = grossReturn - stake;
      }

      return { isWin: true, netAmount: netReturn };
    } else {
      // Perdeu toda a stake investida
      return { isWin: false, netAmount: stake }; 
    }
  }

  static getTargets() {
    return {
      TRIPLICACAO_RED: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      TRIPLICACAO_BLACK: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
      // Ordem da Roleta Europeia: 9 vizinhos à esquerda e 9 à direita do 23 (Total 19 números)
      FUSION_23: [17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31]
    };
  }
}

module.exports = { AutoSettlementEngine };
EOF

echo "[2/2] Corrigindo Orquestrador..."
cat > scripts/live-paper-orchestrator.js <<'EOF'
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

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida. Digite o número da roleta (0-36).');
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

    // Mock alternando entre Fusion e Triplicação para demonstração correta
    const isContextFavorable = Math.random() > 0.5; 
    
    if (isContextFavorable && !cooldownGuard.isLocked()) {
      const useFusion = Math.random() > 0.5;
      
      if (useFusion) {
        activeTrade = {
          strategy: 'FUSION REDUZIDA (Setor do 23)',
          type: 'FUSION_SECTOR',
          targets: AutoSettlementEngine.getTargets().FUSION_23,
          stake: 1.90
        };
      } else {
        activeTrade = {
          strategy: 'TRIPLICAÇÃO (Vermelhos)',
          type: 'COLOR',
          targets: AutoSettlementEngine.getTargets().TRIPLICACAO_RED,
          stake: 1.90
        };
      }
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
  initialBankroll = 100.00; // Fallback seguro
}
startOrchestrator();
EOF

echo "======================================"
echo -e "\033[1;32m HOTFIX 353.1 APLICADO \033[0m"
echo "======================================"

