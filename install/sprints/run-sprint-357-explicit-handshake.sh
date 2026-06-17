#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 357"
echo " EXPLICIT SETTLEMENT HANDSHAKE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/1] Injetando Máquina de Estados no Orquestrador..."
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

const savedState = bankrollRepo.load();
let initialBankroll = 100.00;
if (savedState && savedState.initialBankroll) initialBankroll = savedState.initialBankroll;

const cooldownGuard = new DynamicEmotionalCooldownGuard(initialBankroll, savedState);

// Variáveis de Estado do Orquestrador
let activeTrade = null;
let inputMode = 'NUMBER'; // Pode ser 'NUMBER' ou 'CONFIRM_TRADE'
let pendingResult = null; // Guarda o resultado para a confirmação do usuário

function saveSystemState() {
  const currentSnapshot = cooldownGuard.exportState();
  bankrollRepo.save(currentSnapshot);
}

function generateNextTrade() {
  if (cooldownGuard.isSessionEnded || cooldownGuard.isLocked()) {
    activeTrade = null;
    return;
  }
  
  const isContextFavorable = Math.random() > 0.6; // Mock da inteligência real
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

    // MODO 2: AGUARDANDO CONFIRMAÇÃO DO USUÁRIO (O Checkpoint)
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
        voiceCopilot.speak('Entrada descartada. Histórico sincronizado sem risco.');
      } else {
        console.log('Comando inválido. Digite "s" para Sim ou "n" para Não.');
        rl.prompt();
        return;
      }

      // Limpa o estado e volta a mapear a mesa
      inputMode = 'NUMBER';
      pendingResult = null;
      activeTrade = null;
      
      generateNextTrade();
      renderTerminalHud();
      return;
    }

    // MODO 1: RECEBENDO NÚMEROS DA ROLETA
    if (cooldownGuard.isLocked()) {
      // Bloqueia inputs fora de hora para evitar ansiedade, mas permite sincronizar
      if (!cmd.startsWith('sync ')) {
        cooldownGuard.registerOutcome(false, cooldownGuard.currentBankroll); 
        saveSystemState();
        voiceCopilot.speak('Penalidade por ansiedade.');
        renderTerminalHud();
        return;
      }
    }

    if (cmd.startsWith('sync ')) {
      activeTrade = null;
      generateNextTrade();
      renderTerminalHud();
      return;
    }

    const num = parseInt(cmd, 10);
    if (isNaN(num) || num < 0 || num > 36) {
      console.log('Entrada inválida.');
      rl.prompt();
      return;
    }

    if (activeTrade) {
      pendingResult = settlementEngine.evaluate(num, activeTrade);
      inputMode = 'CONFIRM_TRADE'; // Muda o estado para forçar a confirmação
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
  console.log(' 🛡️ RL.SYS CORE - EXPLICIT HANDSHAKE ACTIVE');
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
    rl.setPrompt('roleta (0-36) > ');
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
    rl.setPrompt('roleta (0-36) > ');
  } 
  else {
    console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
    console.log(` MESA ........ Aguardando alinhamento institucional.`);
    rl.setPrompt('roleta (0-36) > ');
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
EOF

git add scripts/live-paper-orchestrator.js
git commit -m "feat(orchestrator): add explicit two-way execution handshake to prevent ghost trades during history sync (Sprint 357)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 357 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: EXPLICIT HANDSHAKE ONLINE"
echo "======================================"

