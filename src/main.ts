import { AppContainer } from './infrastructure/di/AppContainer';
import { ActionSignal } from './domain/decision/DecisionContracts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function startSession() {
  console.clear();
  console.log(`${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}${BOLD}   RL.SYS CORE — QUANTITATIVE OPERATIONAL TERMINAL${RESET}`);
  console.log(`${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);

  try {
    // Configuração de Arranque (Boot)
    const config = {
      storageDirectory: './storage/snapshots',
      targetSnapshotId: process.argv[2] || 'default_alpha',
      bootTimeMs: Date.now()
    };

    console.log(`[SYSTEM] Inicializando defesas e carregando Alpha: ${config.targetSnapshotId}...`);
    const coordinator = AppContainer.bootstrap(config);
    console.log(`${GREEN}[OK] Sistema Armado e Pronto.${RESET}\n`);

    // Mock de Loop de Entrada (Simulando OCR/Input)
    console.log(`${YELLOW}Aguardando telemetria da mesa... (Pressione Ctrl+C para sair)${RESET}\n`);
    
    // Interface de Monitorização Simples (TUI)
    const renderSignal = (signal: any) => {
      let color = RESET;
      if (signal.action === ActionSignal.SIGNAL) color = GREEN + BOLD;
      if (signal.action === ActionSignal.NO_GO) color = RED;
      if (signal.action === ActionSignal.OBSERVE) color = YELLOW;

      console.log(`${BLUE}-------------------------------------------------------------${RESET}`);
      console.log(` DECISÃO: ${color}${signal.action}${RESET} | RAZÃO: ${signal.reason}`);
      console.log(` EV: ${(signal.expectedEV * 100).toFixed(2)}% | CONFIDANÇA: ${(signal.confidence * 100).toFixed(2)}%`);
      console.log(`${BLUE}-------------------------------------------------------------${RESET}\n`);
    };

    // Para fins de teste desta Sprint, processamos uma rodada simulada
    const mockState = { dealerId: 'D_ALICE', wheelSpeedCategory: 'NORMAL' as any, targetSector: 32 };
    const decision = coordinator.processLiveSpin(mockState, Date.now());
    renderSignal(decision);

  } catch (error: any) {
    console.log(`${RED}${BOLD}❌ FALHA CRÍTICA NO BOOT:${RESET} ${error.message}`);
    process.exit(1);
  }
}

startSession();
