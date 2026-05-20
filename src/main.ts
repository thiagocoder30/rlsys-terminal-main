import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { join } from 'node:path';
import { RuntimeKernel, RuntimeShutdownCoordinator } from './application/runtime';
import { JsonLinesReplayRepository } from './infrastructure/replay';
import { JsonLinesRuntimeSessionJournalRepository } from './infrastructure/journal';

async function main(): Promise<void> {
  const replayPath = join(process.cwd(), 'data', 'replay');
  const journalPath = join(process.cwd(), 'data', 'journal');

  const replayRepository = new JsonLinesReplayRepository(replayPath);
  const journalRepository = new JsonLinesRuntimeSessionJournalRepository(journalPath);

  const kernel = new RuntimeKernel(
    replayRepository,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    journalRepository,
  );

  const shutdown = new RuntimeShutdownCoordinator(kernel, journalRepository);
  const terminal = createInterface({ input, output });

  const closeTerminal = (): void => {
    terminal.close();
  };

  const requestShutdown = (reason: 'SIGINT' | 'SIGTERM' | 'REPL_CLOSED'): void => {
    const result = shutdown.shutdown(reason);
    console.log(result.message);
    closeTerminal();

    if (reason !== 'REPL_CLOSED') {
      process.exitCode = 0;
    }
  };

  process.once('SIGINT', () => requestShutdown('SIGINT'));
  process.once('SIGTERM', () => requestShutdown('SIGTERM'));

  process.once('uncaughtException', (error: Error) => {
    const result = shutdown.shutdown('UNCAUGHT_EXCEPTION');
    console.error(result.message);
    console.error(error.message);
    closeTerminal();
    process.exitCode = 1;
  });

  process.once('unhandledRejection', (reason: unknown) => {
    const result = shutdown.shutdown('UNHANDLED_REJECTION');
    console.error(result.message);
    console.error(reason instanceof Error ? reason.message : String(reason));
    closeTerminal();
    process.exitCode = 1;
  });

  terminal.once('close', () => {
    if (!shutdown.isClosed()) {
      shutdown.shutdown('REPL_CLOSED');
    }
  });

  console.log('╔════════ RL.SYS CORE ════════╗');
  console.log('║ Institutional Runtime Kernel ║');
  console.log('║ Type 0-36, status, or quit   ║');
  console.log('╚══════════════════════════════╝');

  try {
    let shouldContinue = true;

    while (shouldContinue && !shutdown.isClosed()) {
      const command = await terminal.question('rlsys> ');
      const result = await kernel.handle(command);

      console.log(result.output);
      shouldContinue = result.shouldContinue;
    }

    if (!shutdown.isClosed()) {
      shutdown.shutdown('OPERATOR_QUIT');
    }
  } catch (error) {
    if (!shutdown.isClosed()) {
      shutdown.shutdown('UNKNOWN');
    }

    const message = error instanceof Error ? error.message : 'unknown runtime error';

    console.error('RL.SYS CORE entered fail-closed shutdown.');
    console.error(message);
    process.exitCode = 1;
  } finally {
    closeTerminal();
  }
}

void main();
