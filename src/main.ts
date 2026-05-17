import * as readline from 'node:readline';
import { AppContainer } from './infrastructure/di/AppContainer';
import { ActionSignal, DecisionResult } from './domain/decision/DecisionContracts';
import { WheelTopology } from './domain/research/WheelTopology';

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; 
const BLUE = '\x1b[34m'; const RESET = '\x1b[0m'; const BOLD = '\x1b[1m';

async function main() {
  console.clear();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  let pendingBet: { targetCluster: number[]; decision: DecisionResult } | null = null;

  try {
    const config = { storageDirectory: './storage/snapshots', targetSnapshotId: process.argv[2] || 'default_alpha', bootTimeMs: Date.now() };
    console.log(`${BLUE}${BOLD}RL.SYS CORE — TERMINAL OPERACIONAL ATIVO${RESET}`);
    const coordinator = AppContainer.bootstrap(config);
    console.log(`${GREEN}[SISTEMA ARMADO]${RESET} Defesas Financeiras e Persistência Online.\n`);

    rl.on('line', (input) => {
      const val = input.trim();
      if (val.toLowerCase() === 'exit') process.exit(0);
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0 || num > 36) return;

      const now = Date.now();

      // 1. Resolve a Aposta Pendente (Feedback Loop)
      if (pendingBet) {
        const isWin = WheelTopology.isHit(num, pendingBet.targetCluster);
        const pnl = isWin ? 35 : -1; // Estrutura de PnL base
        coordinator.registerOutcome(pnl, now);
        console.log(`${isWin ? GREEN : RED}[RESULTADO ANTERIOR] PnL: ${pnl > 0 ? '+' : ''}${pnl} Unidades${RESET}`);
        pendingBet = null;
      }

      // 2. Processa a Nova Rodada
      const liveState = { dealerId: 'D_ALICE', wheelSpeedCategory: 'NORMAL' as any, targetSector: num };
      const decision = coordinator.processLiveSpin(liveState, now);

      let color = RESET;
      if (decision.action === ActionSignal.SIGNAL) { color = GREEN + BOLD; pendingBet = { targetCluster: WheelTopology.getCluster(num, 5), decision }; }
      if (decision.action === ActionSignal.NO_GO) color = RED;
      if (decision.action === ActionSignal.OBSERVE) color = YELLOW;

      console.log(`\n${BLUE}─── RODADA: ${num} ─────────────────────────────────────${RESET}`);
      console.log(` DECISÃO: ${color}${decision.action}${RESET} | RAZÃO: ${decision.reason}`);
      console.log(`${BLUE}───────────────────────────────────────────────────${RESET}\n`);

      if (decision.reason === 'OPERATOR_IN_COOLDOWN' || decision.reason === 'FINANCIAL_DRAWDOWN_ACTIVE') {
         console.log(`${RED}${BOLD}DEFESA ATIVADA: Operador bloqueado. Fechando terminal.${RESET}`);
         process.exit(1);
      }
    });
  } catch (error: any) {
    console.log(`${RED}${BOLD}❌ FALHA NO ARRANQUE:${RESET} ${error.message}`);
    process.exit(1);
  }
}
main();
