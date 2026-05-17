import * as readline from 'node:readline';
import { AppContainer } from './infrastructure/di/AppContainer';
import { ActionSignal } from './domain/decision/DecisionContracts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function main() {
  console.clear();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  try {
    const config = {
      storageDirectory: './storage/snapshots',
      targetSnapshotId: process.argv[2] || 'default_alpha',
      bootTimeMs: Date.now()
    };

    console.log(`${BLUE}${BOLD}RL.SYS CORE — TERMINAL OPERACIONAL ATIVO${RESET}`);
    const coordinator = AppContainer.bootstrap(config);
    console.log(`${GREEN}[SISTEMA ARMADO]${RESET} Alpha: ${config.targetSnapshotId}\n`);
    console.log(`${YELLOW}COMANDO: Insira o número da rodada (0-36) ou 'exit' para sair.${RESET}`);

    rl.on('line', (input) => {
      const val = input.trim();
      if (val.toLowerCase() === 'exit') process.exit(0);

      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0 || num > 36) {
        console.log(`${RED}[ERRO] Entrada inválida: ${val}${RESET}`);
        return;
      }

      // Simulação de Telemetria: No futuro, o Dealer e a Velocidade virão do OCR
      const liveState = {
        dealerId: 'D_ALICE',
        wheelSpeedCategory: 'NORMAL' as any,
        targetSector: num
      };

      const startTime = performance.now();
      const decision = coordinator.processLiveSpin(liveState, Date.now());
      const endTime = performance.now();

      // Renderização do Sinal TUI
      let color = RESET;
      if (decision.action === ActionSignal.SIGNAL) color = GREEN + BOLD;
      if (decision.action === ActionSignal.NO_GO) color = RED;
      if (decision.action === ActionSignal.OBSERVE) color = YELLOW;

      console.log(`\n${BLUE}─── RODADA REGISTADA: ${num} ──────────────────────────────${RESET}`);
      console.log(` DECISÃO: ${color}${decision.action}${RESET} | RAZÃO: ${decision.reason}`);
      console.log(` EV: ${(decision.expectedEV * 100).toFixed(2)}% | CONF: ${(decision.confidence * 100).toFixed(2)}%`);
      console.log(` LATÊNCIA: ${(endTime - startTime).toFixed(4)}ms`);
      console.log(`${BLUE}───────────────────────────────────────────────────────────${RESET}\n`);
    });

  } catch (error: any) {
    console.log(`${RED}${BOLD}❌ FALHA CRÍTICA:${RESET} ${error.message}`);
    process.exit(1);
  }
}

main();
