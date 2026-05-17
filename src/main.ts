import * as readline from 'node:readline';
import { AppContainer } from './infrastructure/di/AppContainer';
import { ActionSignal, DecisionResult } from './domain/decision/DecisionContracts';
import { WheelTopology } from './domain/research/WheelTopology';

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; 
const BLUE = '\x1b[34m'; const RESET = '\x1b[0m'; const BOLD = '\x1b[1m'; const MAGENTA = '\x1b[35m';

async function main() {
  console.clear();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  // Estado pendente enriquecido para a telemetria
  let pendingBet: { targetCluster: number[]; decision: DecisionResult; sector: number; latency: number } | null = null;

  try {
    const config = { storageDirectory: './storage/snapshots', targetSnapshotId: process.argv[2] || 'default_alpha', bootTimeMs: Date.now() };
    console.log(`${BLUE}${BOLD}RL.SYS CORE — TERMINAL OPERACIONAL ATIVO${RESET}`);
    
    const { coordinator, logger } = AppContainer.bootstrap(config);
    console.log(`${GREEN}[SISTEMA ARMADO]${RESET} Telemetria e Gravação Assíncrona Online.\n`);

    rl.on('line', (input) => {
      const val = input.trim();
      if (val.toLowerCase() === 'exit') process.exit(0);
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0 || num > 36) return;

      const now = Date.now();

      // 1. Resolve a Aposta Pendente e Grava Telemetria
      if (pendingBet) {
        const isWin = WheelTopology.isHit(num, pendingBet.targetCluster);
        const units = pendingBet.decision.recommendedUnits || 1;
        const pnl = isWin ? (35 * units) : -units; 
        
        coordinator.registerOutcome(pnl, now);
        console.log(`${isWin ? GREEN : RED}[RESULTADO ANTERIOR] PnL: ${pnl > 0 ? '+' : ''}${pnl} Unidades${RESET}`);
        
        // Gravação em Disco (Fire-and-Forget)
        logger.logSpin({
          timestampMs: now,
          dealerId: 'D_ALICE',
          wheelSpeed: 'NORMAL',
          targetSector: pendingBet.sector,
          action: pendingBet.decision.action,
          expectedEV: pendingBet.decision.expectedEV,
          confidence: pendingBet.decision.confidence,
          recommendedUnits: units,
          pnl: pnl,
          latencyMs: pendingBet.latency
        });

        pendingBet = null;
      }

      // 2. Processa a Nova Rodada
      const liveState = { dealerId: 'D_ALICE', wheelSpeedCategory: 'NORMAL' as any, targetSector: num };
      
      const t0 = performance.now();
      const decision = coordinator.processLiveSpin(liveState, now);
      const t1 = performance.now();
      const latency = t1 - t0;

      let color = RESET;
      let unitsStr = "";
      if (decision.action === ActionSignal.SIGNAL) { 
        color = GREEN + BOLD; 
        unitsStr = ` | ${MAGENTA}${BOLD}APOSTAR: ${decision.recommendedUnits} UNIDADES${RESET}`;
        pendingBet = { targetCluster: WheelTopology.getCluster(num, 5), decision, sector: num, latency }; 
      }
      if (decision.action === ActionSignal.NO_GO) color = RED;
      if (decision.action === ActionSignal.OBSERVE) color = YELLOW;

      console.log(`\n${BLUE}─── RODADA: ${num} ─────────────────────────────────────${RESET}`);
      console.log(` DECISÃO: ${color}${decision.action}${RESET}${unitsStr} | RAZÃO: ${decision.reason}`);
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
