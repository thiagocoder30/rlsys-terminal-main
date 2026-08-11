import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Server } from './infrastructure/http/Server';
import { GeminiAdapter } from './infrastructure/adapters/GeminiAdapter';
import { config } from './config';

async function bootstrap() {
    console.clear();
    console.log('======================================');
    console.log('🚀 BOOTING RL.SYS INSTITUTIONAL CORE...');
    console.log('======================================');

    // Composition Root
    const replayRepository = new JsonLinesReplayRepository('data/replay');
    const kernel = new RuntimeKernel(replayRepository);
    const shutdownCoordinator = new RuntimeShutdownCoordinator(kernel);
    
    // HTTP API Server
    const gemini = new GeminiAdapter(config.geminiApiKey || process.env.GEMINI_API_KEY || '');
    const port = parseInt('3001', 10);
    const server = new Server(port, '0.0.0.0', gemini);
    server.start();

    // Signal handling
    process.on('SIGINT', async () => {
        await server.stop();
        shutdownCoordinator.shutdown('SIGINT');
        console.log('RL.SYS CORE shutdown completed.');
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await server.stop();
        shutdownCoordinator.shutdown('SIGTERM');
        console.log('RL.SYS CORE shutdown completed.');
        process.exit(0);
    });
    process.on('uncaughtException', (err) => { 
        console.error('FATAL UNCAUGHT:', err); 
        process.exit(1); 
    });
    process.on('unhandledRejection', (err) => { 
        console.error('FATAL UNHANDLED:', err); 
        process.exit(1); 
    });

    console.log('🚀 RL.SYS CORE active and listening on port 3001.');
}

bootstrap().catch(err => {
    console.error('[FATAL BOOT ERROR]', err);
    process.exit(1);
});
