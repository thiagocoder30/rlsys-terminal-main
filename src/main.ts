import { Server } from './infrastructure/http/Server';
import { GeminiAdapter } from './infrastructure/adapters/GeminiAdapter';
import { SQLiteSignalRepository } from './infrastructure/database/SQLiteSignalRepository';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const signalRepository = new SQLiteSignalRepository(config.sqliteDbPath);
  await signalRepository.init();

  const geminiAdapter = new GeminiAdapter(config.geminiApiKey);
  const server = new Server(config.serverPort, config.serverHost, geminiAdapter, signalRepository);

  server.start();

  const shutdown = async () => {
    await server.stop();
    await signalRepository.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(error => {
  console.error(error);
  process.exit(1);
});
