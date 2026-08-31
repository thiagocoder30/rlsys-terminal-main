import readline from 'node:readline/promises';

import { createCliApplication } from './application/cli/CliBootstrap.js';

import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import type {
  RuntimeShutdownReason,
} from './application/runtime/RuntimeShutdownCoordinator';

import { RuntimeStressSampler } from './application/stress/RuntimeStressSampler';
import { RuntimeHudTelemetryComposer } from './application/operator/RuntimeHudTelemetryComposer';

import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';
import { TrueEventLoopLagMonitor } from './infrastructure/runtime/TrueEventLoopLagMonitor';

import { RuntimeStateTransitionGate } from './application/runtime/RuntimeStateTransitionGate';

import { RuntimeMemoryPressureMonitor } from './domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeStressHarness } from './domain/stress/RuntimeStressHarness';
import { OperatorHudFormatter } from './domain/operator';


const STATUS_COMMAND = 'status';

const QUIT_COMMAND = 'quit';

const STATUS_ALIASES =
  new Set([
    STATUS_COMMAND,
    's',
  ]);

const QUIT_ALIASES =
  new Set([
    QUIT_COMMAND,
    'exit',
    'q',
  ]);


async function bootstrap(): Promise<void> {

  const repo =
    new JsonLinesReplayRepository(
      './data/replay.jsonl',
    );


  const kernel =
    new RuntimeKernel(
      repo,
      new RuntimeStateTransitionGate(),
      new RuntimeMemoryPressureMonitor(),
      new RuntimeStressSampler(),
      new RuntimeStressHarness(),
      new RuntimeHudTelemetryComposer(),
      new OperatorHudFormatter(),
      new TrueEventLoopLagMonitor(),
    );


  const cli =
    createCliApplication(
      kernel,
    );


  const shutdown =
    new RuntimeShutdownCoordinator(
      kernel,
    );


  const terminal =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });


  let shuttingDown = false;


  const closeRuntime = (
    reason: RuntimeShutdownReason,
  ): void => {

    if (shuttingDown) {
      return;
    }


    shuttingDown = true;


    console.log(
      `Shutting down: ${reason}`,
    );


    try {

      shutdown.shutdown(
        reason,
      );

    } catch (error) {

      console.error(
        '[SHUTDOWN_ERROR]',
        error,
      );

    }


    terminal.close();

  };


  process.on(
    'SIGINT',
    () => {

      closeRuntime(
        'SIGINT',
      );

    },
  );


  process.on(
    'SIGTERM',
    () => {

      closeRuntime(
        'SIGTERM',
      );

    },
  );


  process.on(
    'uncaughtException',
    error => {

      console.error(
        '[UNCAUGHT_EXCEPTION]',
        error,
      );


      closeRuntime(
        'UNCAUGHT_EXCEPTION',
      );

    },
  );


  process.on(
    'unhandledRejection',
    reason => {

      console.error(
        '[UNHANDLED_REJECTION]',
        reason,
      );


      closeRuntime(
        'UNHANDLED_REJECTION',
      );

    },
  );


  terminal.once('close', () => {

    if (!shuttingDown) {

      closeRuntime(
        'REPL_CLOSED',
      );

    }

  });


  console.log(
    'rlsys> CORE INITIALIZED',
  );

  console.log(
    cli.getBanner(),
  );


  while (!shuttingDown) {

    const input =
      await terminal.question(
        'rlsys> ',
      );


    const normalized =
      input
        .trim()
        .toLowerCase();


    if (
      QUIT_ALIASES.has(
        normalized,
      )
    ) {

      closeRuntime(
        'OPERATOR_QUIT',
      );

      break;

    }


    const routedInput =
      STATUS_ALIASES.has(
        normalized,
      )
        ? STATUS_COMMAND
        : input;


    const output =
      await cli.execute(
        routedInput,
      );


    console.log(
      output,
    );

  }

}


bootstrap()
  .catch(
    error => {

      console.error(
        '[FATAL]',
        error,
      );

      process.exit(1);

    },
  );
