#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 355"
echo " GLOBAL STOP WIN & MILESTONE LADDER"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Reconstruindo Motor de Governança com Escada de Metas..."
cat > src/domain/risk/DynamicEmotionalCooldownGuard.js <<'EOF'
'use strict';

/**
 * Motor de Cooldown Comportamental e Global Stop Win.
 * Arquitetura de Escada: Divide a meta de 10% em degraus de 2%.
 */
class DynamicEmotionalCooldownGuard {
  constructor(initialBankroll) {
    this.initialBankroll = initialBankroll;
    this.currentBankroll = initialBankroll;
    this.peakBankroll = initialBankroll;
    this.consecutiveLosses = 0;
    
    this.lockUntil = 0;
    this.lockReason = '';
    this.isSessionEnded = false;
    
    // Configurações Institucionais
    this.stepPercent = 0.02; // Degrau de 2%
    this.globalTargetPercent = 0.10; // Teto de 10%
    
    this.milestoneStep = this.initialBankroll * this.stepPercent;
    this.globalStopWinTarget = this.initialBankroll * (1 + this.globalTargetPercent);
    
    this.calculateNextMilestone();
  }

  calculateNextMilestone() {
    let currentStep = this.initialBankroll + this.milestoneStep;
    
    // Encontra o próximo degrau múltiplo de 2% acima da banca atual
    while (currentStep <= this.currentBankroll && currentStep < this.globalStopWinTarget) {
      currentStep += this.milestoneStep;
    }
    
    this.nextMilestone = currentStep;
  }

  registerOutcome(isWin, amount) {
    if (this.isSessionEnded) return { status: 'SESSION_ENDED' };
    
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
      
      // 1. Checagem do Teto (Global Stop Win de 10%)
      if (this.currentBankroll >= this.globalStopWinTarget) {
        this.isSessionEnded = true;
        // Trava o sistema por 24 horas simulando fim de expediente
        this.triggerLock(24 * 60 * 60 * 1000, `GLOBAL STOP WIN ATINGIDO (+10%). Expediente Encerrado!`);
        return;
      }
      
      // 2. Checagem do Degrau (Milestone Parcial de 2%)
      if (this.currentBankroll >= this.nextMilestone) {
        this.triggerLock(15 * 60 * 1000, `DEGRAU ATINGIDO (+2%). Proteja o Lucro.`);
        this.calculateNextMilestone(); 
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
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    
    let timeStr = `${minutes}m ${seconds}s`;
    if (hours > 0) timeStr = `SESSÃO FINALIZADA`;
    
    return {
      reason: this.lockReason,
      time: timeStr
    };
  }
}

module.exports = { DynamicEmotionalCooldownGuard };
EOF

echo "[2/2] Atualizando Orquestrador com Métricas Globais..."
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
EOF

git add src/domain/risk/DynamicEmotionalCooldownGuard.js scripts/live-paper-orchestrator.js
git commit -m "feat(risk): implement 10% global stop win and fixed 2% milestone ladder (Sprint 355)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 355 FINALIZADA COM SUCESSO \033[0m"
echo "======================================"

