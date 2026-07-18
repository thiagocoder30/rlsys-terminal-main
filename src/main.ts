import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

async function bootstrap() {
    console.clear();
    console.log('======================================');
    console.log('🚀 BOOTING RL.SYS INSTITUTIONAL CORE...');
    console.log('======================================');

    // Composition Root
    const replayRepository = new JsonLinesReplayRepository('data/replay');
    const kernel = new RuntimeKernel(replayRepository);
    const shutdownCoordinator = new RuntimeShutdownCoordinator(kernel);

    // Signal handling
    process.on('SIGINT', () => shutdownCoordinator.shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdownCoordinator.shutdown('SIGTERM'));
    process.on('uncaughtException', () => shutdownCoordinator.shutdown('UNCAUGHT_EXCEPTION'));
    process.on('unhandledRejection', () => shutdownCoordinator.shutdown('UNHANDLED_REJECTION'));

    // REPL interface
    const terminal = createInterface({ input: stdin, output: stdout });
    terminal.once('close', () => shutdownCoordinator.shutdown('REPL_CLOSED'));

    // Main loop
    while (!shutdownCoordinator.isClosed()) {
        const input = await terminal.question('rlsys> ');
        const result = await kernel.handle(input);
        console.log(result.output);
        
        // Handle status/quit commands explicitly
        if (input.trim().toLowerCase() === 'status') {
            console.log('System status: OPERATIONAL');
        }
        if (input.trim().toLowerCase() === 'quit') {
            break;
        }
    }

    console.log('RL.SYS CORE shutdown completed.');
    process.exit(0);
}

bootstrap().catch(err => {
    console.error('[FATAL BOOT ERROR]', err);
    process.exit(1);
});
