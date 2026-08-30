import readline from 'node:readline/promises';

import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import type { RuntimeShutdownReason } from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';

import { RuntimeStressSampler } from './application/stress/RuntimeStressSampler';
import { RuntimeHudTelemetryComposer } from './application/operator/RuntimeHudTelemetryComposer';
import { TrueEventLoopLagMonitor } from './infrastructure/runtime/TrueEventLoopLagMonitor';

import { RuntimeStateTransitionGate } from './application/runtime/RuntimeStateTransitionGate';
import { RuntimeMemoryPressureMonitor } from './domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeStressHarness } from './domain/stress/RuntimeStressHarness';
import { OperatorHudFormatter } from './domain/operator';


const STATUS_COMMAND = 'status';
const QUIT_COMMAND = 'quit';


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


  const closeRuntime = (reason: RuntimeShutdownReason) => {

    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(`Shutting down: ${reason}`);

    try {
      shutdown.shutdown(reason);
    } catch (error) {
      console.error('[SHUTDOWN_ERROR]', error);
    }

    terminal.close();

  };


  process.on('SIGINT', () => {
    closeRuntime('SIGINT');
  });


  process.on('SIGTERM', () => {
    closeRuntime('SIGTERM');
  });


  process.on('uncaughtException', error => {

    console.error('[UNCAUGHT_EXCEPTION]', error);

    closeRuntime('UNCAUGHT_EXCEPTION');

  });


  process.on('unhandledRejection', reason => {

    console.error('[UNHANDLED_REJECTION]', reason);

    closeRuntime('UNHANDLED_REJECTION');

  });


  terminal.once('close', () => {

    if (!shuttingDown) {
      closeRuntime('REPL_CLOSED');
    }

  });


  console.log('rlsys> CORE INITIALIZED');


  while (!shuttingDown) {

    const input = await terminal.question('rlsys> ');

    const cmd = input.trim().toUpperCase();


    if (
      cmd === STATUS_COMMAND.toUpperCase() ||
      cmd === 'S'
    ) {

      console.log({
        session: kernel.getSessionId?.() ?? 'unknown'
      });

      continue;

    }


    if (
      cmd === QUIT_COMMAND.toUpperCase() ||
      cmd === 'EXIT'
    ) {

      closeRuntime('OPERATOR_QUIT');

      break;

    }


    console.log(`Unknown command: ${cmd}`);

  }

}


bootstrap().catch(error => {

  console.error('[FATAL]', error);

  process.exit(1);

});
