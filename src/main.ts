import readline from 'node:readline/promises';

import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import {
  RuntimeShutdownCoordinator,
  type RuntimeShutdownReason,
} from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';

import { RuntimeStressSampler } from './application/stress/RuntimeStressSampler';
import { RuntimeHudTelemetryComposer } from './application/operator/RuntimeHudTelemetryComposer';
import { TrueEventLoopLagMonitor } from './infrastructure/runtime/TrueEventLoopLagMonitor';

import { RuntimeStateTransitionGate } from './application/runtime/RuntimeStateTransitionGate';
import { RuntimeMemoryPressureMonitor } from './domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeStressHarness } from './domain/stress/RuntimeStressHarness';
import { OperatorHudFormatter } from './domain/operator';

async function bootstrap() {
  const repo = new JsonLinesReplayRepository('./data/replay.jsonl');

  const kernel = new RuntimeKernel(
    repo,
    new RuntimeStateTransitionGate(),
    new RuntimeMemoryPressureMonitor(),
    new RuntimeStressSampler(),
    new RuntimeStressHarness(),
    new RuntimeHudTelemetryComposer(),
    new OperatorHudFormatter(),
    new TrueEventLoopLagMonitor()
  );

  const shutdown = new RuntimeShutdownCoordinator(kernel);

  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let shuttingDown = false;

  const terminate = (reason: RuntimeShutdownReason, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      shutdown.shutdown(reason);
    } finally {
      terminal.close();
      process.exit(exitCode);
    }
  };

  process.once('SIGINT', () => terminate('SIGINT'));
  process.once('SIGTERM', () => terminate('SIGTERM'));

  terminal.once('close', () => terminate('REPL_CLOSED'));

  process.once('uncaughtException', (error) => {
    console.error('[UNCAUGHT_EXCEPTION]', error);
    terminate('UNCAUGHT_EXCEPTION', 1);
  });

  process.once('unhandledRejection', (reason) => {
    console.error('[UNHANDLED_REJECTION]', reason);
    terminate('UNHANDLED_REJECTION', 1);
  });

  console.log('rlsys> CORE INITIALIZED');
  console.log('Commands: status | quit | exit');

  while (true) {
    const input = await terminal.question('rlsys> ');
    const cmd = input.trim().toUpperCase();

    if (cmd === 'STATUS' || cmd === 'S') {
      console.log({
        status: 'RUNNING',
        session: kernel.getSessionId?.() ?? 'unknown'
      });
      continue;
    }

    if (cmd === 'QUIT' || cmd === 'EXIT') {
      console.log('Shutting down...');
      terminate('OPERATOR_QUIT');
      return;
    }

    console.log(`Unknown command: ${cmd}`);
  }
}

bootstrap().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
