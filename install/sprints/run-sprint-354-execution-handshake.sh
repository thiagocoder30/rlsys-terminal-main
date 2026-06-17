#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 354"
echo " EXECUTION HANDSHAKE & MILESTONE SYNC"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Aprimorando Motor de Governança (CooldownGuard)..."
cat > src/domain/risk/DynamicEmotionalCooldownGuard.js <<'EOF'
'use strict';

class DynamicEmotionalCooldownGuard {
  constructor(initialBankroll) {
    this.initialBankroll = initialBankroll;
    this.currentBankroll = initialBankroll;
    this.peakBankroll = initialBankroll;
    this.consecutiveLosses = 0;
    
    this.lockUntil = 0;
    this.lockReason = '';
    
    this.calculateNextMilestone();
  }

  calculateNextMilestone() {
    const milestoneStep = this.initialBankroll * 0.02; 
    // Garante que o milestone seja sempre um degrau acima da banca atual
    this.nextMilestone = this.currentBankroll + milestoneStep;
  }

  registerOutcome(isWin, amount) {
    if (this.isLocked()) {
      this.lockUntil += 120000; 
      return { status: 'PENALTY_APPLIED' };
    }

    this.currentBankroll = amount;
    if (amount > this.peakBankroll) this.peakBankroll = amount;

    if (!isWin) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= 2) {
        this.triggerLock(10 * 60 * 1000, 'SEQUÊNCIA DE PERDAS (Prevenção de Tilt)');
        this.consecutiveLosses = 0; 
      }
    } else {
      this.consecutiveLosses = 0;
      if (this.currentBankroll >= this.nextMilestone) {
        this.triggerLock(15 * 60 * 1000, `MILESTONE ATINGIDO (+2%). Proteja o Lucro.`);
        this.calculateNextMilestone(); // Recalcula a meta para o pós-cooldown
      }
    }
  }

  triggerLock(durationMs, reason) {
    this.lockUntil = Date.now() + durationMs;
    this.lockReason = reason;
  }

  isLocked() {
    return Date.now() < this.lockUntil;
  }

  getRemainingStatus() {
    if (!this.isLocked()) return null;
    const remainingMs = this.lockUntil - Date.now();
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return {
      reason: this.lockReason,
      time: `${minutes}m ${seconds}s`
    };
  }
}

module.exports = { DynamicEmotionalCooldownGuard };
EOF

echo "[2/2] Atualizando Orquestrador com Skip e Sync..."
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

    // Handshake: Pular a entrada caso não tenha dado tempo de apostar
    if (cmd === 'skip' || cmd === 'pass') {
      if (activeTrade) {
        activeTrade = null;
        voiceCopilot.speak('Entrada abortada pelo operador.');
      }
      renderTerminalHud();
      rl.prompt();
      return;
    }

    // Sincronização de Histórico em Massa: "sync 12, 14, 0"
    if (cmd.startsWith('sync ')) {
      // Apenas ingere os números na engine (mockado aqui) e anula ordens ativas
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

    // Fluxo Zero-Touch Normal
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

    // Lógica Mockada de Nova Entrada
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
  console.log(' 🛡️ RL.SYS CORE - ZERO-TOUCH & HANDSHAKE ACTIVE');
  console.log('======================================================');
  console.log(` BANCA ATUAL ..... R$ ${cooldownGuard.currentBankroll.toFixed(2)}`);
  console.log(` PRÓXIMA META .... R$ ${cooldownGuard.nextMilestone.toFixed(2)}`);
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

if (initialBankroll === null) initialBankroll = 100.00; 
startOrchestrator();
EOF

echo "======================================"
echo -e "\033[1;32m SPRINT 354 FINALIZADA COM SUCESSO \033[0m"
echo "======================================"

