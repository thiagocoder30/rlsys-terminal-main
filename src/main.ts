import * as readline from 'node:readline';
import { AppContainer } from './infrastructure/di/AppContainer';
import { ActionSignal, DecisionResult } from './domain/decision/DecisionContracts';
import { WheelTopology } from './domain/research/WheelTopology';

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; 
const BLUE = '\x1b[34m'; const RESET = '\x1b[0m'; const BOLD = '\x1b[1m'; const MAGENTA = '\x1b[35m';

async function main() {
  // Deteção Automática de Ambiente (Se for piped, isTTY é false)
  const isInteractive = process.stdout.isTTY;
  const isHeadless = process.argv.includes('--headless') || !isInteractive;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: isInteractive });

  let pendingBet: { targetCluster: number[]; decision: DecisionResult; sector: number; latency: number } | null = null;
  let lastProcessedSector: number | null = null;
  let lastProcessTime: number = 0;

  try {
    const config = { storageDirectory: './storage/snapshots', targetSnapshotId: process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'default_alpha', bootTimeMs: Date.now() };
    
    const { coordinator, logger } = AppContainer.bootstrap(config);

    if (!isHeadless) {
      console.clear();
      console.log(`${BLUE}${BOLD}RL.SYS CORE — TERMINAL OPERACIONAL ATIVO${RESET}`);
      console.log(`${GREEN}[SISTEMA ARMADO]${RESET} OCR/Vision Bridge Online. Aguardando Telemetria...\n`);
    }

    rl.on('line', (input) => {
      const val = input.trim();
      if (!val) return;
      if (val.toLowerCase() === 'exit') process.exit(0);

      const now = Date.now();
      let num = -1;
      let dealer = 'D_ALICE';
      let speed = 'NORMAL';

      // Parse Adaptativo: Aceita número cru (Manual) ou JSON (OCR)
      try {
        if (val.startsWith('{')) {
          const payload = JSON.parse(val);
          num = payload.sector;
          if (payload.dealerId) dealer = payload.dealerId;
          if (payload.speed) speed = payload.speed;
        } else {
          num = parseInt(val, 10);
        }
      } catch (e) {
        if (!isHeadless) console.log(`${RED}[ERRO] Telemetria corrompida: ${val}${RESET}`);
        return;
      }

      if (isNaN(num) || num < 0 || num > 36) return;

      // Filtro de Ruído OCR (Debounce de 2 segundos para o mesmo número)
      if (num === lastProcessedSector && (now - lastProcessTime) < 2000) {
        return; // Ignora entrada duplicada (Idempotência O(1))
      }
      lastProcessedSector = num;
      lastProcessTime = now;

      // 1. Resolve a Aposta Pendente
      if (pendingBet) {
        const isWin = WheelTopology.isHit(num, pendingBet.targetCluster);
        const units = pendingBet.decision.recommendedUnits || 1;
        const pnl = isWin ? (35 * units) : -units; 
        
        coordinator.registerOutcome(pnl, now);
        
        logger.logSpin({
          timestampMs: now, dealerId: dealer, wheelSpeed: speed, targetSector: pendingBet.sector, action: pendingBet.decision.action,
          expectedEV: pendingBet.decision.expectedEV, confidence: pendingBet.decision.confidence, recommendedUnits: units,
          pnl: pnl, latencyMs: pendingBet.latency
        });

        if (!isHeadless) console.log(`${isWin ? GREEN : RED}[RESULTADO ANTERIOR] PnL: ${pnl > 0 ? '+' : ''}${pnl} Unidades${RESET}`);
        pendingBet = null;
      }

      // 2. Processa a Nova Rodada
      const liveState = { dealerId: dealer, wheelSpeedCategory: speed as any, targetSector: num };
      
      const t0 = performance.now();
      const decision = coordinator.processLiveSpin(liveState, now);
      const latency = performance.now() - t0;

      if (decision.action === ActionSignal.SIGNAL) { 
        pendingBet = { targetCluster: WheelTopology.getCluster(num, 5), decision, sector: num, latency }; 
      }

      // 3. Output Adaptativo
      if (isHeadless) {
        // Modo Máquina (JSON Puro para o Python ler)
        const response = {
          sector: num, action: decision.action, units: decision.recommendedUnits || 0,
          reason: decision.reason, latencyMs: latency
        };
        console.log(JSON.stringify(response));
      } else {
        // Modo Humano (TUI ANSI)
        let color = decision.action === ActionSignal.SIGNAL ? GREEN + BOLD : (decision.action === ActionSignal.NO_GO ? RED : YELLOW);
        let unitsStr = decision.action === ActionSignal.SIGNAL ? ` | ${MAGENTA}${BOLD}APOSTAR: ${decision.recommendedUnits} UNIDADES${RESET}` : "";

        console.log(`\n${BLUE}─── OCR LIDO: ${num} ──────────────────────────────────────${RESET}`);
        console.log(` DECISÃO: ${color}${decision.action}${RESET}${unitsStr} | RAZÃO: ${decision.reason}`);
        console.log(`${BLUE}───────────────────────────────────────────────────${RESET}\n`);
      }

      if (decision.reason === 'OPERATOR_IN_COOLDOWN' || decision.reason === 'FINANCIAL_DRAWDOWN_ACTIVE') {
         if (isHeadless) console.log(JSON.stringify({ action: 'SYSTEM_HALT', reason: decision.reason }));
         else console.log(`${RED}${BOLD}DEFESA ATIVADA: Operador bloqueado. Sistema desligando.${RESET}`);
         process.exit(1);
      }
    });
  } catch (error: any) {
    if (isHeadless) console.log(JSON.stringify({ action: 'FATAL_ERROR', message: error.message }));
    else console.log(`${RED}${BOLD}❌ FALHA CRÍTICA:${RESET} ${error.message}`);
    process.exit(1);
  }
}
main();
