import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { join } from 'node:path';
import { RuntimeKernel } from './application/runtime';
import { JsonLinesReplayRepository } from './infrastructure/replay';

/**
 * RL.SYS CORE institutional runtime entrypoint.
 *
 * Text-only REPL:
 * - terminal-only operation
 * - no heavy interface layer
 * - append-only replay persistence
 * - fail-closed command handling
 */
async function main(): Promise<void> {
  const replayPath = join(process.cwd(), 'data', 'replay');
  const replayRepository = new JsonLinesReplayRepository(replayPath);
  const kernel = new RuntimeKernel(replayRepository);

  const terminal = createInterface({ input, output });

  console.log('╔════════ RL.SYS CORE ════════╗');
  console.log('║ Institutional Runtime Kernel ║');
  console.log('║ Type 0-36, status, or quit   ║');
  console.log('╚══════════════════════════════╝');

  try {
    let shouldContinue = true;

    while (shouldContinue) {
      const command = await terminal.question('rlsys> ');
      const result = await kernel.handle(command);

      console.log(result.output);
      shouldContinue = result.shouldContinue;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown runtime error';

    console.error('RL.SYS CORE entered fail-closed shutdown.');
    console.error(message);
    process.exitCode = 1;
  } finally {
    terminal.close();
  }
}

void main();
