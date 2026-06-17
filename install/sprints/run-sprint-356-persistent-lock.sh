#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 356"
echo " PERSISTENT GOVERNANCE LOCK (ANTI-BYPASS)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/3] Atualizando Repositório para Persistência de Estado Completo..."
cat > src/infrastructure/persistence/FileBankrollRepository.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Repositório Avançado de Persistência.
 * Salva todo o estado da máquina de risco para evitar bypass por reinicialização.
 */
class FileBankrollRepository {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'financial', 'bankroll-state.json');
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  save(statePayload) {
    try {
      const payload = JSON.stringify({
        ...statePayload,
        lastUpdated: new Date().toISOString()
      }, null, 2);
      fs.writeFileSync(this.filePath, payload, 'utf8');
    } catch (error) {
      // Fail-safe passivo
    }
  }
}

module.exports = { FileBankrollRepository };
EOF

echo "[2/3] Reconstruindo o Motor de Risco com Hidratação de Memória..."
cat > src/domain/risk/DynamicEmotionalCooldownGuard.js <<'EOF'
'use strict';

/**
 * Motor de Cooldown com persistência de estado e proteção contra evasão.
 */
class DynamicEmotionalCooldownGuard {
  constructor(initialBankroll, hydratedState = null) {
    this.initialBankroll = initialBankroll;
    this.currentBankroll = initialBankroll;
    this.peakBankroll = initialBankroll;
    this.consecutiveLosses = 0;
    
    this.lockUntil = 0;
    this.lockReason = '';
    this.isSessionEnded = false;
    
    // Parâmetros de Riscos Fixos (Invioláveis)
    this.stepPercent = 0.02; 
    this.globalTargetPercent = 0.10; 
    
    this.milestoneStep = this.initialBankroll * this.stepPercent;
    this.globalStopWinTarget = this.initialBankroll * (1 + this.globalTargetPercent);

    // Se houver estado anterior salvo em disco, restaura a máquina de estados
    if (hydratedState) {
      this.currentBankroll = hydratedState.currentBankroll ?? initialBankroll;
      this.peakBankroll = hydratedState.peakBankroll ?? this.currentBankroll;
      this.consecutiveLosses = hydratedState.consecutiveLosses ?? 0;
      this.lockUntil = hydratedState.lockUntil ?? 0;
      this.lockReason = hydratedState.lockReason ?? '';
      this.isSessionEnded = hydratedState.isSessionEnded ?? false;
    }
    
    this.calculateNextMilestone();
  }

  calculateNextMilestone() {
    let currentStep = this.initialBankroll + this.milestoneStep;
    while (currentStep <= this.currentBankroll && currentStep < this.globalStopWinTarget) {
      currentStep += this.milestoneStep;
    }
    this.nextMilestone = currentStep;
  }

  registerOutcome(isWin, amount) {
    if (this.isSessionEnded) return { status: 'SESSION_ENDED' };
    
    if (this.isLocked()) {
      this.lockUntil += 120000; // Penalidade por tentar burlar/operar travado
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
      
      if (this.currentBankroll >= this.globalStopWinTarget) {
        this.isSessionEnded = true;
        this.triggerLock(24 * 60 * 60 * 1000, `GLOBAL STOP WIN ATINGIDO (+10%). Sessão Encerrada.`);
        return;
      }
      
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
    
    if (this.isSessionEnded) {
      return { reason: this.lockReason, time: 'SESSÃO FINALIZADA HOJE' };
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return {
      reason: this.lockReason,
      time: `${minutes}m ${seconds}s`
    };
  }

  exportState() {
    return {
      initialBankroll: this.initialBankroll,
      currentBankroll: this.currentBankroll,
      peakBankroll: this.peakBankroll,
      consecutiveLosses: this.consecutiveLosses,
      lockUntil: this.lockUntil,
      lockReason: this.lockReason,
      isSessionEnded: this.isSessionEnded
    };
  }
}

module.exports = { DynamicEmotionalCooldownGuard };
EOF

echo "[3/3] Vinculando a Persistência Robusta ao Orquestrador Principal..."
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
EOF

# Controle de Commits Requerido
git add src/infrastructure/persistence/FileBankrollRepository.js src/domain/risk/DynamicEmotionalCooldownGuard.js scripts/live-paper-orchestrator.js
git commit -m "fix(risk): make cooldown guard state completely persistent across process lifecycles (Sprint 356)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 356 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: ESCUDO ANTI-EVASÃO IMPLEMENTADO"
echo "======================================"

